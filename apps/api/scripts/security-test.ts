/**
 * 安全测试：验签绕过 + 越权 + SQL 注入
 *
 * 运行方式：
 *   cd apps/api
 *   npx ts-node scripts/security-test.ts
 *
 * 前置条件：
 *   - 后端运行在 http://localhost:3000
 *   - 已 seed
 */
import axios from 'axios';
import { createAdminClient, createPublicClient } from './test-utils';

const API = 'http://localhost:3000/api';
const SHOP_CODE = 'main';

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
}

const results: TestResult[] = [];

function record(name: string, pass: boolean, detail: string): void {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}`);
  console.log(`   ${detail}\n`);
}

async function main(): Promise<void> {
  console.log('=== 安全测试 ===\n');

  await testUnauthorizedAccess();
  await testSignatureBypass();
  await testSqlInjection();
  await testOrderQueryBruteForce();

  console.log('\n=== 汇总 ===');
  const passed = results.filter((r) => r.pass).length;
  console.log(`通过 ${passed}/${results.length}`);
  if (passed === results.length) {
    console.log('✅ 全部通过');
  } else {
    console.log('❌ 存在失败项');
  }
  process.exit(passed === results.length ? 0 : 1);
}

// ====== 1. 越权测试 ======
async function testUnauthorizedAccess(): Promise<void> {
  console.log('--- 越权测试 ---\n');

  // 1.1 无 token 访问 admin 接口
  try {
    await axios.get(`${API}/admin/products`);
    record('无 token 访问 /admin/products', false, '应该 401 但请求成功');
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    record('无 token 访问 /admin/products', status === 401, `HTTP ${status}`);
  }

  // 1.2 无效 token
  try {
    await axios.get(`${API}/admin/products`, { headers: { Authorization: 'Bearer invalid.token.here' } });
    record('无效 token 访问 /admin/products', false, '应该 401 但请求成功');
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    record('无效 token 访问 /admin/products', status === 401, `HTTP ${status}`);
  }

  // 1.3 买家侧接口不应要求登录
  try {
    const res = await axios.get(`${API}/shop/${SHOP_CODE}`);
    record('买家访问 /shop/main 无需登录', res.status === 200, `HTTP ${res.status}`);
  } catch (err) {
    record('买家访问 /shop/main 无需登录', false, `请求失败: ${(err as Error).message}`);
  }
}

// ====== 2. 验签绕过测试 ======
async function testSignatureBypass(): Promise<void> {
  console.log('--- 验签绕过测试 ---\n');

  // 准备：创建商品 + 导入卡密 + 下单
  const admin = await createAdminClient(API);
  const shop = await admin.get<{ id: string; code: string }>('/admin/shops/me');
  const product = await admin.post<{ id: string }>('/admin/products', {
    shopId: shop.id,
    name: '安全测试商品',
    price: 0.01,
    isAutoDelivery: true,
  });
  await admin.post('/admin/stock/import', {
    productId: product.id,
    csvContent: 'SEC-TEST-001',
  });
  await admin.patch(`/admin/products/${product.id}/status`, { status: 'ONLINE' });

  const buyer = createPublicClient(API);
  const order = await buyer.post<{ orderId: string; orderNo: string }>('/shop/main/orders', {
    shopCode: SHOP_CODE,
    buyerEmail: 'security@test.com',
    idempotencyKey: `sec-test-${Date.now()}`,
    items: [{ productId: product.id, quantity: 1 }],
  });

  // 2.1 伪造 mock 回调（错误签名）
  const fakeBody = new URLSearchParams({
    out_trade_no: order.orderNo,
    money: '0.01',
    sign: 'fake_invalid_signature',
  }).toString();

  try {
    const res = await axios.post(`${API}/payment/notify/mock`, fakeBody, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    // ResponseInterceptor 包装：{ code, data, requestId }
    const result = res.data?.data ?? res.data;
    record('伪造回调（错误签名）被拒绝', result === 'fail', `返回: ${result}`);

    // 验证订单状态未变
    const queryRes = await axios.post(`${API}/orders/query`, {
      orderNo: order.orderNo,
      buyerEmail: 'security@test.com',
    });
    const orderStatus = queryRes.data.data.status;
    record('伪造回调后订单仍为 PENDING', orderStatus === 'PENDING', `status=${orderStatus}`);
  } catch (err) {
    record('伪造回调请求异常', false, (err as Error).message);
  }

  // 2.2 篡改金额（签名正确但金额不匹配）
  const admin2 = await createAdminClient(API);
  const channel = await admin2.get<{ code: string; config: { key: string } }>('/admin/payment-channels/mock');
  const crypto = await import('crypto');
  const correctSign = crypto
    .createHash('md5')
    .update(`${order.orderNo}0.99${channel.config.key}`, 'utf8')
    .digest('hex');
  const tamperedBody = new URLSearchParams({
    out_trade_no: order.orderNo,
    money: '0.99', // 篡改金额
    sign: correctSign,
  }).toString();

  try {
    await axios.post(`${API}/payment/notify/mock`, tamperedBody, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    // 验签通过，但金额校验应该失败
    const queryRes = await axios.post(`${API}/orders/query`, {
      orderNo: order.orderNo,
      buyerEmail: 'security@test.com',
    });
    const orderStatus = queryRes.data.data.status;
    record('篡改金额回调被拦截', orderStatus === 'PENDING', `status=${orderStatus}（应仍为 PENDING）`);
  } catch (err) {
    record('篡改金额请求异常', false, (err as Error).message);
  }
}

// ====== 3. SQL 注入测试 ======
async function testSqlInjection(): Promise<void> {
  console.log('--- SQL 注入测试 ---\n');

  const payloads = [`' OR '1'='1`, `'; DROP TABLE orders;--`, `' UNION SELECT * FROM users--`, `1' OR 1=1#`];

  for (const payload of payloads) {
    // 3.1 订单查询接口
    try {
      await axios.post(`${API}/orders/query`, {
        orderNo: payload,
        buyerEmail: payload,
      });
      record(`订单查询 SQL 注入: ${payload}`, true, '未触发 500 错误');
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      // 404 是正常的（订单不存在），500 说明可能存在注入
      record(`订单查询 SQL 注入: ${payload}`, status !== 500, `HTTP ${status}`);
    }

    // 3.2 商品搜索
    try {
      const admin = await createAdminClient(API);
      await admin.get(`/admin/products?keyword=${encodeURIComponent(payload)}`);
      record(`商品搜索 SQL 注入: ${payload}`, true, '未触发 500 错误');
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      record(`商品搜索 SQL 注入: ${payload}`, status !== 500, `HTTP ${status}`);
    }
  }
}

// ====== 4. 订单爆破测试 ======
async function testOrderQueryBruteForce(): Promise<void> {
  console.log('--- 订单爆破测试 ---\n');

  // 用不存在的订单号 + 错误邮箱查询，应该都返回 404
  // 且不应泄露订单是否存在
  const fakeOrderNos = ['123456789', '987654321', '111111111', '000000000'];

  for (const orderNo of fakeOrderNos) {
    try {
      await axios.post(`${API}/orders/query`, {
        orderNo,
        buyerEmail: 'anyone@test.com',
      });
      record(`订单爆破: ${orderNo}`, false, '应该 404 但请求成功');
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      // 404（订单不存在）和 429（限流）都不泄露订单是否存在，是安全的
      const safe = status === 404 || status === 429;
      record(`订单爆破: ${orderNo}`, safe, `HTTP ${status} msg=${message}`);
    }
  }
}

main().catch((err) => {
  console.error('测试脚本异常:', err);
  process.exit(1);
});
