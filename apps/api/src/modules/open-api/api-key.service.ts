import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { createHash, randomBytes } from 'crypto';

export interface ApiKeyPayload {
  apiKeyId: string;
  merchantId: string;
  scopes: string[];
  name: string;
}

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** 生成 sk_live_ + 32 字节 base64url */
  generateKeyString(): string {
    const raw = randomBytes(32).toString('base64url');
    return `sk_live_${raw}`;
  }

  /** sha256(key) hex，用于存储和查询 */
  private hashKey(key: string): string {
    return createHash('sha256').update(key, 'utf8').digest('hex');
  }

  /** 列出商户的 API Key（不返回完整 key） */
  async listByMerchant(merchantId: string) {
    return this.prisma.apiKey.findMany({
      where: { merchantId, isActive: true },
      select: {
        id: true,
        keyHint: true,
        name: true,
        scopes: true,
        rateLimitPerMin: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 创建 API Key，返回完整 key（仅此一次） */
  async create(
    merchantId: string,
    params: { name: string; scopes?: string[]; rateLimitPerMin?: number; expiresAt?: Date },
    auditCtx?: { userId: string; ip: string; ua: string },
  ) {
    const fullKey = this.generateKeyString();
    const keyHint = `sk_live_...${fullKey.slice(-4)}`;
    const scopes = (params.scopes ?? ['read', 'write']).join(',');
    const rateLimitPerMin = params.rateLimitPerMin ?? 60;

    const apiKey = await this.prisma.apiKey.create({
      data: {
        keyHash: this.hashKey(fullKey),
        keyHint,
        name: params.name,
        merchantId,
        scopes,
        rateLimitPerMin,
        expiresAt: params.expiresAt ?? null,
      },
    });

    if (auditCtx) {
      await this.auditLog.record({
        actorId: auditCtx.userId,
        action: 'api_key.create',
        resourceType: 'api_key',
        resourceId: apiKey.id,
        afterData: { name: params.name, scopes },
        ip: auditCtx.ip,
        userAgent: auditCtx.ua,
      });
    }

    return {
      id: apiKey.id,
      key: fullKey,
      keyHint,
      name: apiKey.name,
      scopes,
      rateLimitPerMin,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    };
  }

  /** 吊销 API Key */
  async revoke(merchantId: string, id: string, auditCtx?: { userId: string; ip: string; ua: string }) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id, merchantId, isActive: true },
    });
    if (!apiKey) {
      throw new UnauthorizedException('API Key 不存在或已吊销');
    }
    await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    });
    if (auditCtx) {
      await this.auditLog.record({
        actorId: auditCtx.userId,
        action: 'api_key.revoke',
        resourceType: 'api_key',
        resourceId: id,
        beforeData: { name: apiKey.name },
        ip: auditCtx.ip,
        userAgent: auditCtx.ua,
      });
    }
    return { id, revoked: true };
  }

  /** 通过完整 key 验证，返回 payload；同时更新 lastUsedAt */
  async validate(rawKey: string): Promise<ApiKeyPayload> {
    if (!rawKey || !rawKey.startsWith('sk_live_')) {
      throw new UnauthorizedException('API Key 格式错误');
    }
    const keyHash = this.hashKey(rawKey);
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
    });
    if (!apiKey || !apiKey.isActive) {
      throw new UnauthorizedException('API Key 无效或已吊销');
    }
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API Key 已过期');
    }
    // 异步更新 lastUsedAt，不阻塞请求
    this.prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    return {
      apiKeyId: apiKey.id,
      merchantId: apiKey.merchantId,
      scopes: apiKey.scopes.split(',').filter(Boolean),
      name: apiKey.name,
    };
  }
}
