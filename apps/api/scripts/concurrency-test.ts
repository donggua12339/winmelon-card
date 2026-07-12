/**
 * 并发测试：100 并发下单同一商品（库存 10），验证无超卖
 *
 * 运行方式：
 *   cd apps/api
 *   npx ts-node scripts/concurrency-test.ts
 *
 * 前置条件：
 *   - 后端运行在 http://localhost:3000
 *   - 已 seed（admin 账号可用）
 *   - main 店铺存在
 */
import { createPublicClient, createAdminClient } from './test-utils';

const API = 'http://localhost:3000/api';
const SHOP_CODE = 'main';
const CONCURRENCY = 100;
const STOCK_COUNT = 10;

async function main() {
  console.log('=== 并发超卖测试 ===\n');

  // 1. 管理员登录
  const admin = await createAdminClient(API);
  console.log('✓ 管理员登录');

  // 2. 获取店铺
  const shop = await admin.get<{ id: string; code: string }>(`/admin/shops/me`);
  console.log(`✓ 店铺: ${shop.code} (${shop.id})`);

  // 3. 创建测试商品
  const product = await admin.post<{ id: string }>('/admin/products', {
    shopId: shop.id,
    name: '并发测试商品',
    price: 0.01,
    description: '仅用于并发测试',
    isAutoDelivery: true,
  });
  console.log(`✓ 创建商品: ${product.id}`);

  // 4. 导入 10 张卡密
  const csvContent = Array.from({ length: STOCK_COUNT }, (_, i) => `CONTEST-${String(i).padStart(3, '0')}`).join('\n');
  const importResult = await admin.post<{ imported: number }>('/admin/stock/import', {
    productId: product.id,
    csvContent,
  });
  console.log(`✓ 导入卡密: ${importResult.imported} 张`);

  // 5. 上架
  await admin.patch(`/admin/products/${product.id}/status`, { status: 'ONLINE' });
  console.log('✓ 商品上架\n');

  // 6. 并发下单
  console.log(`开始 ${CONCURRENCY} 并发下单（库存 ${STOCK_COUNT}）...`);
  const buyer = createPublicClient(API);
  const startTime = Date.now();

  const requests = Array.from({ length: CONCURRENCY }, (_, i) =>
    buyer
      .post<{ orderId: string; orderNo: string }>('/shop/main/orders', {
        shopCode: SHOP_CODE,
        buyerEmail: `test${i}@concurrency.test`,
        idempotencyKey: `concurrent-${i}-${Date.now()}`,
        items: [{ productId: product.id, quantity: 1 }],
      })
      .then((res) => ({ success: true, orderNo: res.orderNo }))
      .catch((err: unknown) => ({
        success: false,
        error: (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? '未知错误',
      })),
  );

  const results = await Promise.all(requests);
  const elapsed = Date.now() - startTime;

  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  console.log(`\n--- 结果 (${elapsed}ms) ---`);
  console.log(`成功下单: ${successes.length}`);
  console.log(`失败下单: ${failures.length}`);

  // 失败原因统计
  const failReasons = new Map<string, number>();
  for (const f of failures) {
    const reason = (f as { error: string }).error;
    failReasons.set(reason, (failReasons.get(reason) ?? 0) + 1);
  }
  console.log('\n失败原因:');
  for (const [reason, count] of failReasons) {
    console.log(`  ${reason}: ${count} 次`);
  }

  // 7. 查询库存
  const stats = await admin.get<{ available: number; locked: number; sold: number; total: number }>(
    `/admin/stock/stats?productId=${product.id}`,
  );
  console.log('\n--- 库存状态 ---');
  console.log(`可用: ${stats.available}`);
  console.log(`锁定: ${stats.locked}`);
  console.log(`已售: ${stats.sold}`);
  console.log(`总计: ${stats.total}`);

  // 8. 判定
  console.log('\n--- 判定 ---');
  const overSold = successes.length > STOCK_COUNT;
  const correctLock = stats.locked === successes.length;
  const noOverSold = !overSold && stats.locked <= STOCK_COUNT;

  if (noOverSold && correctLock) {
    console.log(`✅ 测试通过：成功 ${successes.length} 单，库存锁定 ${stats.locked}，无超卖`);
  } else {
    console.log(`❌ 测试失败：超卖=${overSold}，成功=${successes.length}，锁定=${stats.locked}`);
  }

  // 9. 清理：等待订单超时释放（或手动删除商品）
  console.log('\n等待订单超时释放库存（10 分钟）或手动删除测试商品...');
  console.log('提示：可手动删除测试商品，LOCKED 卡密会阻止删除');

  process.exit(0);
}

main().catch((err) => {
  console.error('测试脚本异常:', err);
  process.exit(1);
});
