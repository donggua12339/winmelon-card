import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * 风控服务
 * - 黑名单检查（IP + 邮箱，支持过期）
 * - 行为计数（同 IP/邮箱 N 分钟内某动作次数）
 * - 自动拉黑（超阈值自动加入黑名单）
 *
 * 熔断规则（可配置）：
 * - 同 IP 60 分钟内未支付订单 > 5 次 -> 自动拉黑 1 小时
 * - 同邮箱 60 分钟内未支付订单 > 3 次 -> 自动拉黑 1 小时
 * - 同 IP 60 分钟内登录失败 > 10 次 -> 自动拉黑 24 小时
 */
@Injectable()
export class RiskControlService {
  private readonly logger = new Logger(RiskControlService.name);

  /** 同 IP 未支付订单熔断阈值 */
  private static readonly IP_PENDING_THRESHOLD = 5;
  /** 同邮箱未支付订单熔断阈值 */
  private static readonly EMAIL_PENDING_THRESHOLD = 3;
  /** 统计窗口（分钟） */
  private static readonly WINDOW_MINUTES = 60;
  /** 自动拉黑时长（分钟） */
  private static readonly AUTO_BLOCK_MINUTES = 60;

  constructor(private readonly prisma: PrismaService) {}

  /** 下单前风控检查 */
  async checkOrder(ip: string, email: string): Promise<void> {
    // 1. IP 黑名单
    const ipBlocked = await this.isIpBlocked(ip);
    if (ipBlocked) {
      throw new ForbiddenException(`IP 已被临时限制（原因：${ipBlocked.reason}）`);
    }

    // 2. 邮箱黑名单
    const emailBlocked = await this.isEmailBlocked(email);
    if (emailBlocked) {
      throw new ForbiddenException(`邮箱已被限制（原因：${emailBlocked.reason}）`);
    }

    // 3. 同 IP 未支付订单熔断
    const ipPending = await this.countRecent('ip', ip, 'order.pending', RiskControlService.WINDOW_MINUTES);
    if (ipPending >= RiskControlService.IP_PENDING_THRESHOLD) {
      await this.autoBlockIp(ip, `60 分钟内未支付订单 ${ipPending} 次，触发熔断`);
      throw new ForbiddenException('该 IP 短时间内未支付订单过多，已被临时限制');
    }

    // 4. 同邮箱未支付订单熔断
    const emailPending = await this.countRecent('email', email, 'order.pending', RiskControlService.WINDOW_MINUTES);
    if (emailPending >= RiskControlService.EMAIL_PENDING_THRESHOLD) {
      await this.autoBlockEmail(email, `60 分钟内未支付订单 ${emailPending} 次，触发熔断`);
      throw new ForbiddenException('该邮箱短时间内未支付订单过多，已被临时限制');
    }
  }

  /** 记录行为 */
  async record(action: string, ctx: { ip: string; email?: string; detail?: string }): Promise<void> {
    try {
      await this.prisma.riskRecord.create({
        data: {
          ip: ctx.ip,
          email: ctx.email,
          action,
          detail: ctx.detail,
        },
      });
    } catch (err) {
      this.logger.error(`风控记录写入失败: ${(err as Error).message}`);
    }
  }

  /** 检查 IP 是否在黑名单（未过期） */
  async isIpBlocked(ip: string) {
    return this.prisma.ipBlacklist.findFirst({
      where: {
        ip,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  /** 检查邮箱是否在黑名单 */
  async isEmailBlocked(email: string) {
    return this.prisma.emailBlacklist.findFirst({
      where: {
        email,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  /** 统计最近 N 分钟某行为次数 */
  async countRecent(field: 'ip' | 'email', value: string, action: string, minutes: number): Promise<number> {
    const since = new Date(Date.now() - minutes * 60_000);
    return this.prisma.riskRecord.count({
      where: {
        action,
        createdAt: { gte: since },
        ...(field === 'ip' ? { ip: value } : { email: value }),
      },
    });
  }

  /** 自动拉黑 IP */
  async autoBlockIp(ip: string, reason: string): Promise<void> {
    const expiresAt = new Date(Date.now() + RiskControlService.AUTO_BLOCK_MINUTES * 60_000);
    await this.prisma.ipBlacklist.upsert({
      where: { ip },
      create: { ip, reason, source: 'auto', expiresAt },
      update: { reason, source: 'auto', expiresAt },
    });
    this.logger.warn(`IP 自动拉黑: ${ip}（${reason}），到期 ${expiresAt.toISOString()}`);
  }

  /** 自动拉黑邮箱 */
  async autoBlockEmail(email: string, reason: string): Promise<void> {
    const expiresAt = new Date(Date.now() + RiskControlService.AUTO_BLOCK_MINUTES * 60_000);
    await this.prisma.emailBlacklist.upsert({
      where: { email },
      create: { email, reason, source: 'auto', expiresAt },
      update: { reason, source: 'auto', expiresAt },
    });
    this.logger.warn(`邮箱自动拉黑: ${email}（${reason}）`);
  }

  // ====== 后台管理 ======

  async listIpBlacklist(query: { page: number; pageSize: number; keyword?: string }) {
    const where = query.keyword ? { ip: { contains: query.keyword } } : {};
    const [items, total] = await Promise.all([
      this.prisma.ipBlacklist.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.ipBlacklist.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async listEmailBlacklist(query: { page: number; pageSize: number; keyword?: string }) {
    const where = query.keyword ? { email: { contains: query.keyword } } : {};
    const [items, total] = await Promise.all([
      this.prisma.emailBlacklist.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.emailBlacklist.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async addIpBlacklist(ip: string, reason: string, hours?: number) {
    const expiresAt = hours ? new Date(Date.now() + hours * 3600_000) : null;
    return this.prisma.ipBlacklist.upsert({
      where: { ip },
      create: { ip, reason, source: 'manual', expiresAt },
      update: { reason, source: 'manual', expiresAt },
    });
  }

  async addEmailBlacklist(email: string, reason: string, hours?: number) {
    const expiresAt = hours ? new Date(Date.now() + hours * 3600_000) : null;
    return this.prisma.emailBlacklist.upsert({
      where: { email },
      create: { email, reason, source: 'manual', expiresAt },
      update: { reason, source: 'manual', expiresAt },
    });
  }

  async removeIpBlacklist(id: string) {
    return this.prisma.ipBlacklist.delete({ where: { id } });
  }

  async removeEmailBlacklist(id: string) {
    return this.prisma.emailBlacklist.delete({ where: { id } });
  }

  /** 风控统计 */
  async stats(days = 7) {
    const since = new Date(Date.now() - days * 86400_000);

    const [ipBlocked, emailBlocked, records, topActions] = await Promise.all([
      this.prisma.ipBlacklist.count(),
      this.prisma.emailBlacklist.count(),
      this.prisma.riskRecord.count({ where: { createdAt: { gte: since } } }),
      this.prisma.riskRecord.groupBy({
        by: ['action'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
    ]);

    // 高频 IP（最近 N 天）
    const topIps = await this.prisma.riskRecord.groupBy({
      by: ['ip'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { ip: 'desc' } },
      take: 10,
    });

    return {
      ipBlockedCount: ipBlocked,
      emailBlockedCount: emailBlocked,
      recordCount: records,
      topActions: topActions.map((g) => ({ action: g.action, count: g._count._all })),
      topIps: topIps.map((g) => ({ ip: g.ip, count: g._count._all })),
    };
  }

  /** 清理过期黑名单（定时任务用） */
  async cleanExpired(): Promise<{ ip: number; email: number }> {
    const now = new Date();
    const ip = await this.prisma.ipBlacklist.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    const email = await this.prisma.emailBlacklist.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return { ip: ip.count, email: email.count };
  }
}
