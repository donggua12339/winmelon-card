import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AesGcmService } from '../../infrastructure/crypto/aes-gcm.service';
import { StockQueryDto } from './dto/stock-query.dto';
import type { AuditCtx } from '../product/product.service';

const MAX_IMPORT_ROWS = 5000;
const MAX_CARD_LENGTH = 4096;

export interface ImportResult {
  imported: number;
  duplicated: number;
  failed: number;
  errors: string[];
}

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly crypto: AesGcmService,
  ) {}

  /**
   * 批量导入卡密
   * - 解析 CSV → 逐行加密 → 去重（contentHash） → 批量入库
   * - 单次最多 5000 条，避免长事务
   */
  async import(merchantId: string, dto: { productId: string; csvContent: string }, ctx: AuditCtx): Promise<ImportResult> {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, merchantId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException('商品不存在或无权操作');
    }

    const lines = this.parseCsv(dto.csvContent);
    if (lines.length === 0) {
      throw new ConflictException('CSV 内容为空');
    }
    if (lines.length > MAX_IMPORT_ROWS) {
      throw new ConflictException(`单次最多导入 ${MAX_IMPORT_ROWS} 条，当前 ${lines.length} 条`);
    }

    const errors: string[] = [];
    const seen = new Set<string>(); // 本次批次内去重
    const toCreate: Prisma.StockCardCreateManyInput[] = [];
    let duplicated = 0;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const content = raw.trim();
      if (!content) continue;
      if (content.length > MAX_CARD_LENGTH) {
        errors.push(`第 ${i + 1} 行：超过 ${MAX_CARD_LENGTH} 字符`);
        continue;
      }
      const hash = this.crypto.sha256(content);
      if (seen.has(hash)) {
        duplicated++;
        continue;
      }
      seen.add(hash);
      const { ciphertext, iv, tag } = this.crypto.encrypt(content);
      toCreate.push({
        productId: dto.productId,
        contentCiphertext: ciphertext,
        contentIv: iv,
        contentTag: tag,
        contentHash: hash,
        status: 'AVAILABLE',
      });
    }

    if (toCreate.length === 0) {
      return { imported: 0, duplicated, failed: errors.length, errors: errors.slice(0, 20) };
    }

    // 数据库层去重：跳过已存在的 contentHash
    const existingHashes = await this.prisma.stockCard.findMany({
      where: { productId: dto.productId, contentHash: { in: Array.from(seen) } },
      select: { contentHash: true },
    });
    const existingSet = new Set(existingHashes.map((s) => s.contentHash));
    const finalCreate = toCreate.filter((c) => !existingSet.has(c.contentHash));
    duplicated += toCreate.length - finalCreate.length;

    // 批量插入，遇到唯一索引冲突跳过
    let imported = 0;
    if (finalCreate.length > 0) {
      try {
        const result = await this.prisma.stockCard.createMany({
          data: finalCreate,
          skipDuplicates: true,
        });
        imported = result.count;
      } catch (err) {
        // 若仍因并发冲突，回退到逐条插入
        for (const item of finalCreate) {
          try {
            await this.prisma.stockCard.create({ data: item });
            imported++;
          } catch {
            duplicated++;
          }
        }
      }
    }

    await this.auditLog.record({
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      action: 'stock.import',
      resourceType: 'product',
      resourceId: dto.productId,
      afterData: { imported, duplicated, failed: errors.length, totalLines: lines.length },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return { imported, duplicated, failed: errors.length, errors: errors.slice(0, 20) };
  }

  async list(merchantId: string, query: StockQueryDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: query.productId, merchantId, deletedAt: null },
      select: { id: true },
    });
    if (!product) {
      throw new ForbiddenException('无权查看该商品的卡密');
    }

    const where: Prisma.StockCardWhereInput = { productId: query.productId };
    if (query.status) where.status = query.status;

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const [items, total] = await Promise.all([
      this.prisma.stockCard.findMany({
        where,
        orderBy: { importedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          productId: true,
          status: true,
          contentHash: true,
          orderId: true,
          importedAt: true,
          soldAt: true,
        },
      }),
      this.prisma.stockCard.count({ where }),
    ]);

    return {
      items: items.map((it) => ({
        ...it,
        contentPreview: this.maskHash(it.contentHash),
      })),
      total,
      page,
      pageSize,
    };
  }

  async stats(merchantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, merchantId, deletedAt: null },
      select: { id: true },
    });
    if (!product) {
      throw new ForbiddenException('无权查看该商品');
    }

    const grouped = await this.prisma.stockCard.groupBy({
      by: ['status'],
      where: { productId },
      _count: { _all: true },
    });

    const stats = { available: 0, locked: 0, sold: 0, disabled: 0, total: 0 };
    for (const g of grouped) {
      const n = g._count._all;
      stats.total += n;
      if (g.status === 'AVAILABLE') stats.available = n;
      else if (g.status === 'LOCKED') stats.locked = n;
      else if (g.status === 'SOLD') stats.sold = n;
      else if (g.status === 'DISABLED') stats.disabled = n;
    }
    return stats;
  }

  /**
   * 查看单条卡密明文
   * - 仅 AVAILABLE/LOCKED/DISABLED 可查看，SOLD 状态需走订单查询
   * - 每次查看写审计日志
   */
  async reveal(merchantId: string, cardId: string, ctx: AuditCtx): Promise<{ content: string; status: string }> {
    const card = await this.prisma.stockCard.findUnique({
      where: { id: cardId },
      include: { product: { select: { merchantId: true, name: true } } },
    });
    if (!card || card.product.merchantId !== merchantId) {
      throw new NotFoundException('卡密不存在或无权查看');
    }
    if (card.status === 'SOLD') {
      throw new ConflictException('已售卡密请通过订单查询');
    }

    const content = this.crypto.decrypt({
      ciphertext: card.contentCiphertext,
      iv: card.contentIv,
      tag: card.contentTag,
    });

    await this.auditLog.record({
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      action: 'stock.reveal',
      resourceType: 'stock_card',
      resourceId: cardId,
      afterData: { productId: card.productId, status: card.status },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return { content, status: card.status };
  }

  async delete(merchantId: string, cardId: string, ctx: AuditCtx): Promise<void> {
    const card = await this.prisma.stockCard.findUnique({
      where: { id: cardId },
      include: { product: { select: { merchantId: true } } },
    });
    if (!card || card.product.merchantId !== merchantId) {
      throw new NotFoundException('卡密不存在或无权操作');
    }
    if (card.status === 'SOLD' || card.status === 'LOCKED') {
      throw new ConflictException(`卡密状态为 ${card.status}，无法删除`);
    }

    await this.prisma.stockCard.delete({ where: { id: cardId } });

    await this.auditLog.record({
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      action: 'stock.delete',
      resourceType: 'stock_card',
      resourceId: cardId,
      afterData: { productId: card.productId, hash: this.maskHash(card.contentHash) },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }

  /**
   * 解析 CSV：支持双引号包裹
   * 简化实现：按行分割，去掉首尾空白，处理 \"\" 转义
   */
  private parseCsv(text: string): string[] {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      // 处理双引号包裹（含逗号的情况）
      const parsed = this.parseCsvLine(line);
      // 一行只取第一列（卡密内容），其余忽略
      if (parsed.length > 0 && parsed[0].trim()) {
        result.push(parsed[0]);
      }
    }
    return result;
  }

  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === ',') {
          fields.push(current);
          current = '';
        } else if (ch === '"' && current === '') {
          inQuotes = true;
        } else {
          current += ch;
        }
      }
    }
    fields.push(current);
    return fields;
  }

  private maskHash(hash: string): string {
    if (hash.length <= 12) return '***';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  }
}
