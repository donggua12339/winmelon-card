import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationService } from '../notification/notification.service';

/** 法务#3: 处罚申诉期 T+3 工作日 */
const APPEAL_BUSINESS_DAYS = 3;

type PenaltyType = 'FRAUD' | 'FALSE_INVITE' | 'SELF_INVITE' | 'OTHER';
type PenaltyAction = 'FREEZE_ACCOUNT' | 'REVERSE_COMMISSION' | 'SUSPEND_DISTRIBUTION';

/** 计算 T+3 工作日后的截止时间（跳过周六周日） */
function addBusinessDays(days: number): Date {
  const result = new Date();
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  // 截止时间设为当天 23:59:59
  result.setHours(23, 59, 59, 999);
  return result;
}

@Injectable()
export class PenaltyService {
  private readonly logger = new Logger(PenaltyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notification: NotificationService,
  ) {}

  /** 创建处罚（SUPER_ADMIN 触发） - 先标记 PENDING，等 T+3 工作日 */
  async createPenalty(params: {
    merchantId: string;
    type: PenaltyType;
    action: PenaltyAction;
    reason: string;
    amount?: number;
    operatorId: string;
    operatorName: string;
    ip?: string;
    ua?: string;
  }) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: params.merchantId },
      select: { id: true, name: true, penaltyStatus: true },
    });
    if (!merchant) throw new NotFoundException('商户不存在');
    if (merchant.penaltyStatus === 'PENDING_PENALTY') {
      throw new BadRequestException('该商户已有待申诉的处罚');
    }

    const deadline = addBusinessDays(APPEAL_BUSINESS_DAYS);

    const penalty = await this.prisma.merchantPenalty.create({
      data: {
        merchantId: params.merchantId,
        type: params.type,
        action: params.action,
        reason: params.reason,
        amount: params.amount ?? null,
        appealDeadline: deadline,
        operatorId: params.operatorId,
        operatorName: params.operatorName,
        status: 'PENDING',
      },
    });

    // 标记商户为 PENDING_PENALTY
    await this.prisma.merchant.update({
      where: { id: params.merchantId },
      data: {
        penaltyStatus: 'PENDING_PENALTY',
        penaltyReason: params.reason,
        penaltyStartedAt: new Date(),
      },
    });

    // 通知商户
    await this.notification.notifyMerchant({
      merchantId: params.merchantId,
      type: 'SYSTEM',
      title: `处罚通知 - ${params.type}`,
      content: `您因 ${params.reason} 被标记为待处罚。处罚内容：${params.action}。请在 ${deadline.toLocaleString('zh-CN')} 前提交申诉，逾期将自动执行。`,
    });

    await this.auditLog.record({
      actorId: params.operatorId,
      actorName: params.operatorName,
      action: 'merchant.penalty_create',
      resourceType: 'merchant_penalty',
      resourceId: penalty.id,
      afterData: {
        merchantId: params.merchantId,
        type: params.type,
        action: params.action,
        reason: params.reason,
        amount: params.amount,
        appealDeadline: deadline.toISOString(),
      },
      ip: params.ip,
      userAgent: params.ua,
    });

    this.logger.log(
      `处罚创建: merchant=${params.merchantId} type=${params.type} action=${params.action} deadline=${deadline.toISOString()}`,
    );

    return penalty;
  }

  /** 商户提交申诉 */
  async appealPenalty(penaltyId: string, merchantId: string, content: string) {
    const penalty = await this.prisma.merchantPenalty.findUnique({
      where: { id: penaltyId },
    });
    if (!penalty) throw new NotFoundException('处罚记录不存在');
    if (penalty.merchantId !== merchantId) throw new BadRequestException('无权申诉此处罚');
    if (penalty.status !== 'PENDING') throw new BadRequestException('该处罚已处理，不可申诉');
    if (new Date() > penalty.appealDeadline) {
      throw new BadRequestException('申诉期已过');
    }

    await this.prisma.merchantPenalty.update({
      where: { id: penaltyId },
      data: {
        status: 'APPEALED',
        appealContent: content,
        appealedAt: new Date(),
      },
    });

    this.logger.log(`商户申诉提交: penaltyId=${penaltyId} merchantId=${merchantId}`);
    return { ok: true };
  }

  /** admin 处理申诉 - DISMISSED(撤销) 或 EXECUTED(执行) */
  async processAppeal(
    penaltyId: string,
    decision: 'DISMISSED' | 'EXECUTED',
    adminUser: { userId: string; username: string; ip?: string; ua?: string },
  ) {
    const penalty = await this.prisma.merchantPenalty.findUnique({
      where: { id: penaltyId },
    });
    if (!penalty) throw new NotFoundException('处罚记录不存在');
    if (penalty.status !== 'APPEALED' && penalty.status !== 'PENDING') {
      throw new BadRequestException('该处罚状态不可处理');
    }

    if (decision === 'DISMISSED') {
      await this.prisma.merchantPenalty.update({
        where: { id: penaltyId },
        data: { status: 'DISMISSED', executedAt: new Date() },
      });
      // 清除商户处罚状态
      await this.prisma.merchant.update({
        where: { id: penalty.merchantId },
        data: {
          penaltyStatus: null,
          penaltyReason: null,
          penaltyStartedAt: null,
        },
      });
      await this.notification.notifyMerchant({
        merchantId: penalty.merchantId,
        type: 'SYSTEM',
        title: '处罚已撤销',
        content: `您的申诉已通过，处罚 ${penalty.type} 已撤销。`,
      });
    } else {
      await this.executePenalty(penalty);
    }

    await this.auditLog.record({
      actorId: adminUser.userId,
      actorName: adminUser.username,
      action: 'merchant.penalty_process',
      resourceType: 'merchant_penalty',
      resourceId: penaltyId,
      afterData: { decision, merchantId: penalty.merchantId },
      ip: adminUser.ip,
      userAgent: adminUser.ua,
    });

    return { ok: true };
  }

  /** cron: 每天凌晨 4 点检查到期的 PENDING/APPEALED 处罚 */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async executeExpiredPenalties(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.merchantPenalty.findMany({
      where: {
        status: { in: ['PENDING', 'APPEALED'] },
        appealDeadline: { lt: now },
      },
    });
    for (const penalty of expired) {
      // APPEALED 状态未处理的，不自动执行（等 admin 人工处理）
      if (penalty.status === 'APPEALED') continue;
      try {
        await this.executePenalty(penalty);
        this.logger.log(`自动执行到期处罚: penaltyId=${penalty.id} merchantId=${penalty.merchantId}`);
      } catch (err) {
        this.logger.error(`自动执行处罚失败 penaltyId=${penalty.id}: ${(err as Error).message}`);
      }
    }
  }

  /** 执行处罚 */
  private async executePenalty(penalty: {
    id: string;
    merchantId: string;
    action: string;
    amount?: unknown;
    type: string;
  }): Promise<void> {
    if (penalty.action === 'FREEZE_ACCOUNT') {
      await this.prisma.merchant.update({
        where: { id: penalty.merchantId },
        data: {
          status: 'SUSPENDED',
          frozenReason: `处罚冻结: ${penalty.type}`,
          frozenAt: new Date(),
          penaltyStatus: 'PENALTY_EXECUTED',
        },
      });
    } else if (penalty.action === 'SUSPEND_DISTRIBUTION') {
      await this.prisma.merchant.update({
        where: { id: penalty.merchantId },
        data: {
          distributionSuspendedAt: new Date(),
          allowBuyerInviteCode: false,
          penaltyStatus: 'PENALTY_EXECUTED',
        },
      });
    } else if (penalty.action === 'REVERSE_COMMISSION') {
      // 追回返佣:冻结提现（实际追回需要人工指定订单）
      await this.prisma.merchant.update({
        where: { id: penalty.merchantId },
        data: {
          withdrawalSuspendedAt: new Date(),
          penaltyStatus: 'PENALTY_EXECUTED',
        },
      });
    }

    await this.prisma.merchantPenalty.update({
      where: { id: penalty.id },
      data: { status: 'EXECUTED', executedAt: new Date() },
    });

    await this.notification.notifyMerchant({
      merchantId: penalty.merchantId,
      type: 'SYSTEM',
      title: '处罚已执行',
      content: `您的处罚 ${penalty.type} 已执行（${penalty.action}）。如有异议，请联系客服。`,
    });
  }

  /** 商户查看自己的处罚列表 */
  async listForMerchant(merchantId: string) {
    return this.prisma.merchantPenalty.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
