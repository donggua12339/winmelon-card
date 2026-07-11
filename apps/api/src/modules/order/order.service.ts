import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { SnowflakeService } from '../../infrastructure/id/snowflake.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AesGcmService } from '../../infrastructure/crypto/aes-gcm.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

const ORDER_TTL_MINUTES = 10;
const ORDER_TTL_MS = ORDER_TTL_MINUTES * 60 * 1000;

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly snowflake: SnowflakeService,
    private readonly auditLog: AuditLogService,
    private readonly crypto: AesGcmService,
  ) {}

  /**
   * 下单：事务内 FOR UPDATE 锁卡 + 创建订单 + 关联卡密
   * 幂等：idempotencyKey 唯一索引兜底
   */
  async create(dto: CreateOrderDto, ctx: { ip: string; userAgent?: string; requestId?: string }) {
    // 1. 幂等检查
    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      select: { id: true, orderNo: true, status: true, totalAmount: true, expireAt: true },
    });
    if (existing) {
      return {
        orderId: existing.id,
        orderNo: existing.orderNo,
        status: existing.status,
        totalAmount: existing.totalAmount.toString(),
        expireAt: existing.expireAt.toISOString(),
        idempotentReplay: true,
      };
    }

    // 2. 校验店铺
    const shop = await this.prisma.shop.findFirst({
      where: { code: dto.shopCode, isOnline: true },
      select: { id: true, name: true, merchantId: true },
    });
    if (!shop) {
      throw new NotFoundException('店铺不存在或已下线');
    }

    // 3. 校验商品（一次查全部）
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, shopId: shop.id, status: 'ONLINE', deletedAt: null },
      select: { id: true, name: true, price: true, purchaseLimit: true },
    });
    if (products.length !== dto.items.length) {
      throw new NotFoundException('部分商品不存在或已下架');
    }

    // 4. 校验限购
    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId)!;
      if (product.purchaseLimit && item.quantity > product.purchaseLimit) {
        throw new BadRequestException(`商品「${product.name}」单次限购 ${product.purchaseLimit} 件`);
      }
    }

    const orderNo = this.snowflake.next();
    const expireAt = new Date(Date.now() + ORDER_TTL_MS);

    // 5. 事务：FOR UPDATE 锁卡 + 创建订单
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        let totalAmount = 0;
        const orderItems: Prisma.OrderItemCreateManyOrderInput[] = [];
        const lockedCardIds: string[] = [];

        for (const item of dto.items) {
          const product = products.find((p) => p.id === item.productId)!;

          // SELECT ... FOR UPDATE 锁住 N 张可用卡
          const cards = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM stock_cards
            WHERE product_id = ${item.productId} AND status = 'AVAILABLE'
            LIMIT ${item.quantity}
            FOR UPDATE
          `;
          if (cards.length < item.quantity) {
            throw new ConflictException(`商品「${product.name}」库存不足`);
          }

          const cardIds = cards.map((c) => c.id);
          // 标记为 LOCKED
          await tx.stockCard.updateMany({
            where: { id: { in: cardIds } },
            data: { status: 'LOCKED' },
          });
          lockedCardIds.push(...cardIds);

          const unitPrice = Number(product.price);
          const subtotal = unitPrice * item.quantity;
          totalAmount += subtotal;
          orderItems.push({
            productId: item.productId,
            productName: product.name,
            unitPrice: product.price,
            quantity: item.quantity,
            subtotal: new Prisma.Decimal(subtotal),
          });
        }

        // 创建订单
        const order = await tx.order.create({
          data: {
            orderNo,
            shopId: shop.id,
            buyerEmail: dto.buyerEmail,
            buyerContact: dto.buyerContact,
            buyerIp: ctx.ip,
            buyerUserAgent: ctx.userAgent,
            totalAmount: new Prisma.Decimal(totalAmount),
            status: 'PENDING',
            expireAt,
            idempotencyKey: dto.idempotencyKey,
            items: { create: orderItems },
          },
        });

        // 关联卡到订单
        await tx.stockCard.updateMany({
          where: { id: { in: lockedCardIds } },
          data: { orderId: order.id },
        });

        return { order, totalAmount };
      });

      await this.auditLog.record({
        action: 'order.create',
        resourceType: 'order',
        resourceId: result.order.id,
        afterData: { orderNo, totalAmount: result.totalAmount, shopCode: dto.shopCode },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });

      return {
        orderId: result.order.id,
        orderNo,
        status: 'PENDING' as const,
        totalAmount: result.totalAmount.toString(),
        expireAt: expireAt.toISOString(),
        idempotentReplay: false,
      };
    } catch (err) {
      // 唯一索引冲突（并发同 idempotencyKey）
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const replay = await this.prisma.order.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          select: { id: true, orderNo: true, status: true, totalAmount: true, expireAt: true },
        });
        if (replay) {
          return {
            orderId: replay.id,
            orderNo: replay.orderNo,
            status: replay.status,
            totalAmount: replay.totalAmount.toString(),
            expireAt: replay.expireAt.toISOString(),
            idempotentReplay: true,
          };
        }
      }
      throw err;
    }
  }

  /**
   * 买家查询订单（orderNo + email）
   * 防爆破：orderNo 是雪花 ID（18-19 位数字），email 必填
   */
  async findByOrderNo(orderNo: string, buyerEmail: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNo, buyerEmail },
      select: {
        id: true,
        orderNo: true,
        status: true,
        totalAmount: true,
        expireAt: true,
        paidAt: true,
        deliveredAt: true,
        viewedAt: true,
        items: {
          select: {
            productName: true,
            unitPrice: true,
            quantity: true,
            subtotal: true,
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 已发卡订单：解密卡密内容 + 首次查看记录 viewedAt
    let cards: { productName: string; content: string }[] = [];
    if (order.status === 'DELIVERED') {
      const dbCards = await this.prisma.stockCard.findMany({
        where: { orderId: order.id, status: 'SOLD' },
        include: { product: { select: { name: true } } },
      });
      cards = dbCards.map((c) => ({
        productName: c.product.name,
        content: this.crypto.decrypt({
          ciphertext: c.contentCiphertext,
          iv: c.contentIv,
          tag: c.contentTag,
        }),
      }));

      // 首次查看：记录 viewedAt（作为"确认收货"依据）
      if (!order.viewedAt) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { viewedAt: new Date() },
        });
      }
    }

    return {
      ...order,
      totalAmount: order.totalAmount.toString(),
      items: order.items.map((it) => ({
        ...it,
        unitPrice: it.unitPrice.toString(),
        subtotal: it.subtotal.toString(),
      })),
      cards,
    };
  }

  /**
   * 后台：订单列表
   */
  async listForAdmin(
    merchantId: string | undefined,
    query: { page: number; pageSize: number; status?: string; keyword?: string },
  ) {
    const where: Prisma.OrderWhereInput = {};
    if (merchantId) {
      where.shop = { merchantId };
    }
    if (query.status) {
      where.status = query.status as Prisma.OrderWhereInput['status'];
    }
    if (query.keyword) {
      where.OR = [{ orderNo: { contains: query.keyword } }, { buyerEmail: { contains: query.keyword } }];
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          orderNo: true,
          buyerEmail: true,
          totalAmount: true,
          status: true,
          expireAt: true,
          paidAt: true,
          deliveredAt: true,
          createdAt: true,
          shop: { select: { name: true } },
          items: { select: { productName: true, quantity: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((o) => ({
        ...o,
        totalAmount: o.totalAmount.toString(),
        items: o.items.map((it) => ({ productName: it.productName, quantity: it.quantity })),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findOneForAdmin(merchantId: string | undefined, orderId: string) {
    const where: Prisma.OrderWhereInput = { id: orderId };
    if (merchantId) {
      where.shop = { merchantId };
    }
    const order = await this.prisma.order.findFirst({
      where,
      include: {
        items: true,
        shop: { select: { name: true } },
        stockCards: {
          select: { id: true, status: true, productId: true },
        },
        payments: {
          select: { id: true, channel: true, amount: true, status: true, paidAt: true },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    return {
      ...order,
      totalAmount: order.totalAmount.toString(),
      items: order.items.map((it) => ({
        ...it,
        unitPrice: it.unitPrice.toString(),
        subtotal: it.subtotal.toString(),
      })),
      payments: order.payments.map((p) => ({ ...p, amount: p.amount.toString() })),
    };
  }

  /**
   * 定时任务：每 30 秒扫描超时未支付订单，释放库存
   * 事务内：订单 PENDING -> EXPIRED，关联卡 LOCKED -> AVAILABLE
   * 用 status='PENDING' 条件避免误释放已支付订单
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async expireOrders(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.order.findMany({
      where: { status: 'PENDING', expireAt: { lt: now } },
      select: { id: true, orderNo: true },
      take: 100, // 单批最多处理 100 个，避免长事务
    });
    if (expired.length === 0) return;

    this.logger.log(`扫描到 ${expired.length} 个超时订单，开始释放库存`);

    for (const order of expired) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // 用条件更新防并发：只有 PENDING 才能转 EXPIRED
          const updated = await tx.order.updateMany({
            where: { id: order.id, status: 'PENDING' },
            data: { status: 'EXPIRED' },
          });
          if (updated.count === 0) return; // 已被其他流程处理

          // 释放关联的 LOCKED 卡
          await tx.stockCard.updateMany({
            where: { orderId: order.id, status: 'LOCKED' },
            data: { status: 'AVAILABLE', orderId: null },
          });
        });
      } catch (err) {
        this.logger.error(`订单 ${order.orderNo} 释放失败：${(err as Error).message}`);
      }
    }
  }
}
