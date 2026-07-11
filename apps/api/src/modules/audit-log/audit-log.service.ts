import { Injectable, Logger } from '@nestjs/common';
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
      // 审计日志失败不应阻断业务流程，但要告警
      this.logger.error(`审计日志写入失败：${(err as Error).message}`);
    }
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}
