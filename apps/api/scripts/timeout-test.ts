/**
 * 超时释放验证：创建订单 -> 改 expireAt 为过去 -> 等定时任务 -> 检查释放
 *
 * 运行方式：
 *   cd apps/api
 *   npx ts-node scripts/timeout-test.ts
 */
import { PrismaClient } from '@prisma/client';
import { createAdminClient, createPublicClient } from './test-utils';

const API = 'http://localhost:3000/api';
const SHOP_CODE = 'main';

async function main(): Promise<void> {
  console.log('=== 超时释放验证 ===\n');

  const prisma = new PrismaClient();
  try {
    // 1. 准备商品 + 卡密
    const admin = await createAdminClient(API);
    const shop = await admin.get<{ id: string }>('/admin/shops/me');
    const product = await admin.post<{ id: string }>('/admin/products', {
      shopId: shop.id,
      name: '超时测试商品',
      price: 0.01,
      isAutoDelivery: true,
    });
    await admin.post('/admin/stock/import', {
      productId: product.id,
      csvContent: 'TIMEOUT-001',
    });
    await admin.patch(`/admin/products/${product.id}/status`, { status: 'ONLINE' });
    console.log('✓ 商品+卡密准备完成');

    // 2. 下单
    const buyer = createPublicClient(API);
    const order = await buyer.post<{ orderId: string; orderNo: string }>('/shop/main/orders', {
      shopCode: SHOP_CODE,
      buyerEmail: 'timeout@test.com',
      idempotencyKey: `timeout-${Date.now()}`,
      items: [{ productId: product.id, quantity: 1 }],
    });
    console.log(`✓ 下单成功: ${order.orderNo}`);

    // 3. 检查下单后库存
    const statsBefore = await admin.get<{ available: number; locked: number }>(
      `/admin/stock/stats?productId=${product.id}`,
    );
    console.log(`  下单后库存: available=${statsBefore.available}, locked=${statsBefore.locked}`);

    if (statsBefore.locked !== 1) {
      console.log('❌ 库存未正确锁定');
      process.exit(1);
    }

    // 4. 用 SQL 把 expireAt 改成 2 分钟前
    await prisma.order.update({
      where: { id: order.orderId },
      data: { expireAt: new Date(Date.now() - 2 * 60 * 1000) },
    });
    console.log('✓ 已把 expireAt 改成 2 分钟前');

    // 5. 等定时任务执行（每 30 秒跑一次，等 40 秒足够）
    console.log('  等待定时任务执行（40 秒）...');
    await new Promise((resolve) => setTimeout(resolve, 40000));

    // 6. 检查订单状态和库存
    const orderAfter = await prisma.order.findUnique({
      where: { id: order.orderId },
      select: { status: true },
    });
    const statsAfter = await admin.get<{ available: number; locked: number; sold: number }>(
      `/admin/stock/stats?productId=${product.id}`,
    );

    console.log(`\n--- 结果 ---`);
    console.log(`订单状态: ${orderAfter?.status}（期望 EXPIRED）`);
    console.log(`库存: available=${statsAfter.available}, locked=${statsAfter.locked}, sold=${statsAfter.sold}`);

    const orderExpired = orderAfter?.status === 'EXPIRED';
    const stockReleased = statsAfter.available === 1 && statsAfter.locked === 0;

    if (orderExpired && stockReleased) {
      console.log('\n✅ 测试通过：超时订单已释放，库存已回收');
    } else {
      console.log('\n❌ 测试失败');
      console.log(`  订单超时: ${orderExpired}`);
      console.log(`  库存释放: ${stockReleased}`);
    }

    // 清理
    await prisma.product.update({
      where: { id: product.id },
      data: { deletedAt: new Date(), status: 'OFFLINE' },
    });
    console.log('\n✓ 已清理测试商品');
  } finally {
    await prisma.$disconnect();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('测试脚本异常:', err);
  process.exit(1);
});
