import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface AuditLogInput {
  actorId?: string;
  actorName?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  beforeData?: unknown;
  afterData?: unknown;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  action?: string;
  resourceType?: string;
  actorName?: string;
  ip?: string;
  requestId?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId,
          actorName: input.actorName,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          beforeData: input.beforeData !== undefined ? safeStringify(input.beforeData) : undefined,
          afterData: input.afterData !== undefined ? safeStringify(input.afterData) : undefined,
          ip: input.ip,
          userAgent: input.userAgent,
          requestId: input.requestId,
        },
      });
    } catch (err) {
      this.logger.error(`审计日志写入失败：${(err as Error).message}`);
    }
  }

  /**
   * P2-9: 关键操作的审计日志（如提现、密码重置）
   * 写入失败会抛异常，配合 $transaction 让业务回滚
   * 用于合规要求 100% 审计覆盖的场景
   */
  async recordCritical(input: AuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        actorName: input.actorName,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        beforeData: input.beforeData !== undefined ? safeStringify(input.beforeData) : undefined,
        afterData: input.afterData !== undefined ? safeStringify(input.afterData) : undefined,
        ip: input.ip,
        userAgent: input.userAgent,
        requestId: input.requestId,
      },
    });
  }

  /** 后台查询审计日志 */
  async list(query: AuditLogQuery) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = { contains: query.action };
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.actorName) where.actorName = { contains: query.actorName };
    if (query.ip) where.ip = { contains: query.ip };
    if (query.requestId) where.requestId = query.requestId;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((it) => ({
        ...it,
        beforeData: it.beforeData ? tryParse(it.beforeData) : null,
        afterData: it.afterData ? tryParse(it.afterData) : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** 聚合统计（按 action 分组） */
  async stats(days = 7) {
    const since = new Date(Date.now() - days * 86400_000);
    const grouped = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    return grouped.map((g) => ({ action: g.action, count: g._count._all }));
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
