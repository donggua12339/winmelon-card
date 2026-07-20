/**
 * SeekAll Webhook e2e 测试
 *
 * 用法: node scripts/test-seekall-webhook-e2e.mjs
 *
 * 流程:
 * 1. 启动 mock HTTP server 模拟 SeekAll 端
 * 2. 加载 SeekallWebhookService(通过 ts-node 或编译后的 dist)
 * 3. 直接调用 handleOrderPaid(用 mock 数据)
 * 4. 验证 mock server 收到正确的 POST 请求
 *
 * 注意: 此测试需要先 build API(nest build),然后用 dist 里的 service
 */
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = 'e2e-test-secret-not-for-production';
const MOCK_PORT = 9876;
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}/api/v1/license/wm-webhook`;

let receivedRequest = null;

// 1. 启动 mock server
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    receivedRequest = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: JSON.parse(body || '{}'),
    };
    // 模拟 SeekAll 端验证
    const data = receivedRequest.body;
    const expected = createHmac('sha256', SECRET)
      .update(`${data.wmOrderId}|${data.tier}|${String(data.amount)}`)
      .digest('hex');
    if (timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(data.signature, 'hex'))) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'OK', data: { licenseCode: 'TEST-LICENSE-XXX' } }));
    } else {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'INVALID_SIGNATURE' }));
    }
  });
});

await new Promise((resolve) => server.listen(MOCK_PORT, resolve));
console.log(`Mock SeekAll server listening on ${MOCK_URL}\n`);

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    pass++;
  } else {
    console.error(`  ✗ ${msg}`);
    fail++;
  }
}

try {
  // 2. 动态 import 编译后的 service
  // 注意:需要先 cd apps/api && npx nest build
  const { SeekallWebhookService } = await import('../apps/api/dist/modules/webhook/seekall-webhook.service.js');

  // 3. 构造 mock 依赖
  const fakePrisma = {
    orderItem: {
      findMany: async ({ where, select }) => {
        console.log('  [mock prisma] orderItem.findMany', where.orderId);
        return [
          {
            quantity: 1,
            product: { seekallTier: 'TRIAL', name: 'SeekAll 试用' },
          },
        ];
      },
    },
  };
  const fakeConfig = {
    get: (key) => {
      if (key === 'SEEKALL_WEBHOOK_URL') return MOCK_URL;
      if (key === 'WM_WEBHOOK_SECRET') return SECRET;
      return undefined;
    },
  };

  const service = new SeekallWebhookService(fakePrisma, fakeConfig);

  console.log('=== 测试 1: 合法 SeekAll 商品触发 webhook ===');
  receivedRequest = null;
  await service.handleOrderPaid({
    orderId: 'order-uuid-1',
    orderNo: 'WM20260720001',
    paymentId: '',
    channel: 'mock',
    amount: '1.00',
    paidAt: new Date(),
  });
  assert(receivedRequest !== null, 'mock server 收到请求');
  assert(receivedRequest?.method === 'POST', '是 POST 请求');
  assert(receivedRequest?.body.wmOrderId === 'WM20260720001', 'wmOrderId 正确');
  assert(receivedRequest?.body.tier === 'trial', 'tier 小写');
  assert(receivedRequest?.body.amount === 1, 'amount 是数字 1(不是 "1.00")');
  assert(typeof receivedRequest?.body.signature === 'string' && receivedRequest.body.signature.length === 64, 'signature 是 64 字符 hex');

  console.log('\n=== 测试 2: 非 SeekAll 商品不触发 ===');
  receivedRequest = null;
  fakePrisma.orderItem.findMany = async () => [
    { quantity: 1, product: { seekallTier: null, name: '普通商品' } },
  ];
  await service.handleOrderPaid({
    orderId: 'order-uuid-2',
    orderNo: 'WM20260720002',
    paymentId: '',
    channel: 'mock',
    amount: '99.00',
    paidAt: new Date(),
  });
  assert(receivedRequest === null, '非 SeekAll 商品不触发 webhook');

  console.log('\n=== 测试 3: webhook URL 不通时不抛错(失败不阻塞) ===');
  receivedRequest = null;
  const badConfig = {
    get: (key) => {
      if (key === 'SEEKALL_WEBHOOK_URL') return 'http://127.0.0.1:65535/nonexistent'; // 不通的端口
      if (key === 'WM_WEBHOOK_SECRET') return SECRET;
      return undefined;
    },
  };
  const badService = new SeekallWebhookService(fakePrisma, badConfig);
  // fakePrisma 还返回 SeekAll 商品(用 test 1 的覆盖)
  fakePrisma.orderItem.findMany = async () => [
    { quantity: 1, product: { seekallTier: 'TRIAL', name: 'SeekAll 试用' } },
  ];
  let threw = false;
  try {
    await badService.handleOrderPaid({
      orderId: 'order-uuid-3',
      orderNo: 'WM20260720003',
      paymentId: '',
      channel: 'mock',
      amount: '1.00',
      paidAt: new Date(),
    });
  } catch (err) {
    threw = true;
    console.log('  错误:', err.message);
  }
  assert(threw === false, 'webhook 失败不抛异常(不阻塞订单)');

  console.log('\n=== 测试 4: 未配置环境变量时跳过 ===');
  receivedRequest = null;
  const noConfigService = new SeekallWebhookService(fakePrisma, { get: () => undefined });
  await noConfigService.handleOrderPaid({
    orderId: 'order-uuid-4',
    orderNo: 'WM20260720004',
    paymentId: '',
    channel: 'mock',
    amount: '1.00',
    paidAt: new Date(),
  });
  assert(receivedRequest === null, '未配置时跳过');

  console.log(`\n=== 结果: ${pass} passed, ${fail} failed ===`);
} catch (err) {
  console.error('测试执行失败:', err);
  fail++;
} finally {
  server.close();
}

process.exit(fail > 0 ? 1 : 0);
