import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ApiTags } from '@nestjs/swagger';

/**
 * 法务#优化2: 税务数据接口预留
 * 提供返佣记录的查询 + CSV 导出，方便未来对接税务系统
 */
@ApiTags('admin-tax')
@Controller('admin/tax')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminTaxController {
  constructor(private readonly prisma: PrismaService) {}

  /** 查询某月返佣记录（JSON） */
  @Get('records')
  async listRecords(@Query('year') year: string, @Query('month') month: string) {
    const y = Number(year);
    const m = Number(month);
    if (!y || !m || m < 1 || m > 12) {
      return { error: 'invalid year/month' };
    }
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    const records = await this.prisma.commissionRecord.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: {
        id: true,
        orderNo: true,
        inviterMerchantId: true,
        sourceMerchantId: true,
        level: true,
        baseAmount: true,
        rate: true,
        amount: true,
        status: true,
        createdAt: true,
        reversedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const summary = await this.prisma.commissionRecord.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { createdAt: { gte: start, lt: end }, status: 'SETTLED' },
    });
    return {
      period: `${y}-${String(m).padStart(2, '0')}`,
      records: records.map((r) => ({
        ...r,
        baseAmount: Number(r.baseAmount),
        rate: Number(r.rate),
        amount: Number(r.amount),
      })),
      summary: {
        settledCount: summary._count,
        settledTotalAmount: Number(summary._sum.amount ?? 0),
      },
    };
  }

  /** 导出某月返佣记录（CSV） */
  @Get('export')
  async exportCsv(@Query('year') year: string, @Query('month') month: string, @Res() res: Response) {
    const y = Number(year);
    const m = Number(month);
    if (!y || !m || m < 1 || m > 12) {
      res.status(400).send('invalid year/month');
      return;
    }
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    const records = await this.prisma.commissionRecord.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: {
        id: true,
        orderNo: true,
        inviterMerchantId: true,
        sourceMerchantId: true,
        level: true,
        baseAmount: true,
        rate: true,
        amount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const csvLines = [
      'id,orderNo,inviterMerchantId,sourceMerchantId,level,baseAmount,rate,amount,status,createdAt',
      ...records.map((r) =>
        [
          r.id,
          r.orderNo,
          r.inviterMerchantId,
          r.sourceMerchantId,
          r.level,
          r.baseAmount,
          r.rate,
          r.amount,
          r.status,
          r.createdAt.toISOString(),
        ].join(','),
      ),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="commission-${y}${String(m).padStart(2, '0')}.csv"`);
    res.send('\ufeff' + csvLines.join('\n')); // BOM 让 Excel 正确识别 UTF-8
  }
}
