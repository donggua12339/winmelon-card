import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ArticleType, ArticleStatus, Prisma } from '@prisma/client';
import { escapeHtml } from '../../common/utils/sanitize';

export interface ArticleInput {
  type: ArticleType;
  title: string;
  content: string;
  slug?: string;
  summary?: string;
  status?: ArticleStatus;
  sort?: number;
}

@Injectable()
export class ArticleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** 公开查询：按 type 获取已发布公告列表 */
  async listPublished(type?: ArticleType) {
    const where: Prisma.ArticleWhereInput = {
      status: 'PUBLISHED',
      publishedAt: { lte: new Date() },
    };
    if (type) where.type = type;
    return this.prisma.article.findMany({
      where,
      orderBy: [{ sort: 'asc' }, { publishedAt: 'desc' }],
      select: {
        id: true,
        type: true,
        title: true,
        slug: true,
        summary: true,
        publishedAt: true,
        sort: true,
      },
    });
  }

  /** 公开查询：按 slug 获取单篇 */
  async getPublishedBySlug(slug: string) {
    const article = await this.prisma.article.findFirst({
      where: { slug, status: 'PUBLISHED', publishedAt: { lte: new Date() } },
    });
    if (!article) throw new NotFoundException('文章不存在或未发布');
    return article;
  }

  /** 公开查询：按 type 获取最新一篇（用于店铺页底部免责声明等） */
  async getLatestByType(type: ArticleType) {
    return this.prisma.article.findFirst({
      where: { type, status: 'PUBLISHED', publishedAt: { lte: new Date() } },
      orderBy: [{ sort: 'asc' }, { publishedAt: 'desc' }],
    });
  }

  /** 后台：列表（含草稿） */
  async listForAdmin(query: { page: number; pageSize: number; type?: ArticleType; status?: ArticleStatus }) {
    const where: Prisma.ArticleWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    const [items, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.article.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** 后台：详情 */
  async findOneForAdmin(id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('文章不存在');
    return article;
  }

  /** 后台：创建 */
  async create(input: ArticleInput, ctx: { actorId?: string; actorName?: string; ip?: string; ua?: string }) {
    if (input.slug) {
      const existing = await this.prisma.article.findUnique({ where: { slug: input.slug } });
      if (existing) throw new BadRequestException(`slug "${input.slug}" 已存在`);
    }
    const article = await this.prisma.article.create({
      data: {
        type: input.type,
        title: input.title,
        content: input.content,
        slug: input.slug || null,
        summary: input.summary || null,
        status: input.status || 'DRAFT',
        sort: input.sort ?? 0,
        publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
      },
    });
    await this.auditLog.record({
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      action: 'article.create',
      resourceType: 'article',
      resourceId: article.id,
      afterData: { type: article.type, title: article.title, status: article.status },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });
    return article;
  }

  /** 后台：更新 */
  async update(
    id: string,
    input: Partial<ArticleInput>,
    ctx: { actorId?: string; actorName?: string; ip?: string; ua?: string },
  ) {
    const before = await this.prisma.article.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('文章不存在');

    if (input.slug && input.slug !== before.slug) {
      const existing = await this.prisma.article.findUnique({ where: { slug: input.slug } });
      if (existing) throw new BadRequestException(`slug "${input.slug}" 已存在`);
    }

    const data: Prisma.ArticleUpdateInput = {};
    if (input.type !== undefined) data.type = input.type;
    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = input.content;
    if (input.slug !== undefined) data.slug = input.slug || null;
    if (input.summary !== undefined) data.summary = input.summary || null;
    if (input.sort !== undefined) data.sort = input.sort;
    if (input.status !== undefined) {
      data.status = input.status;
      // 从非 PUBLISHED 转 PUBLISHED 时记录发布时间
      if (input.status === 'PUBLISHED' && before.status !== 'PUBLISHED') {
        data.publishedAt = new Date();
      }
    }

    const after = await this.prisma.article.update({ where: { id }, data });
    await this.auditLog.record({
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      action: 'article.update',
      resourceType: 'article',
      resourceId: id,
      beforeData: { title: before.title, status: before.status },
      afterData: { title: after.title, status: after.status },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });
    return after;
  }

  /** 后台：删除（软删归档） */
  async delete(id: string, ctx: { actorId?: string; actorName?: string; ip?: string; ua?: string }) {
    const before = await this.prisma.article.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('文章不存在');
    await this.prisma.article.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
    await this.auditLog.record({
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      action: 'article.archive',
      resourceType: 'article',
      resourceId: id,
      beforeData: { title: before.title },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });
    return { ok: true };
  }

  /** 店铺页底部公告摘要（HTML escape 防注入） */
  async getShopFooterNotices() {
    const [disclaimer, agreement, allowedGoods] = await Promise.all([
      this.getLatestByType('DISCLAIMER'),
      this.getLatestByType('AGREEMENT'),
      this.getLatestByType('ALLOWED_GOODS'),
    ]);
    return {
      disclaimer: disclaimer
        ? { title: disclaimer.title, summary: escapeHtml(disclaimer.summary ?? ''), slug: disclaimer.slug }
        : null,
      agreement: agreement
        ? { title: agreement.title, summary: escapeHtml(agreement.summary ?? ''), slug: agreement.slug }
        : null,
      allowedGoods: allowedGoods
        ? { title: allowedGoods.title, summary: escapeHtml(allowedGoods.summary ?? ''), slug: allowedGoods.slug }
        : null,
    };
  }
}
