import { Controller, Get, Post, Query, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FinanceService } from './finance.service';
import type { JwtRequestUser } from '../auth/jwt.strategy';

@Controller('admin/finance')
@UseGuards(JwtAuthGuard)
@Roles('SUPER_ADMIN')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  /** 日表 + 多维度报告（默认 7 天） */
  @Get('daily-report')
  async dailyReport(
    @Query('days') days?: string,
    @Query('channel') channel?: string,
    @Query('merchantId') merchantId?: string,
  ) {
    const n = days ? Math.min(Math.max(Number(days), 1), 90) : 7;
    return this.financeService.getMultiDimReport({ days: n, channel, merchantId });
  }

  /** 容差阈值 */
  @Get('tolerance')
  async getTolerance() {
    return { toleranceYuan: await this.financeService.getToleranceYuan() };
  }

  /** 设置容差阈值 */
  @Post('tolerance')
  async setTolerance(@Query('yuan') yuan: string, @CurrentUser() user: JwtRequestUser) {
    return this.financeService.setToleranceYuan(Number(yuan), {
      userId: user.userId,
      ip: '',
      ua: '',
    });
  }

  /** 差异告警列表 */
  @Get('alerts')
  async listAlerts(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('resolved') resolved?: string,
    @Query('severity') severity?: string,
  ) {
    return this.financeService.listAlerts({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
      severity,
    });
  }

  /** 标记告警已解决 */
  @Post('alerts/:id/resolve')
  async resolveAlert(@Query('id') id: string, @Query('note') note: string, @CurrentUser() user: JwtRequestUser) {
    return this.financeService.resolveAlert(id, note ?? '', {
      userId: user.userId,
      ip: '',
      ua: '',
    });
  }

  /** CSV 导出 */
  @Get('export')
  async exportCsv(@Query('days') days: string, @Res() res: Response) {
    const n = days ? Math.min(Math.max(Number(days), 1), 90) : 7;
    const csv = await this.financeService.exportCsv(n);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="finance-${n}d-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }
}
