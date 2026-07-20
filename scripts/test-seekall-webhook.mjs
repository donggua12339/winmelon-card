/**
 * SeekAll Webhook 签名算法验证脚本
 *
 * 用法: node scripts/test-seekall-webhook.mjs
 *
 * 验证:
 * 1. HMAC-SHA256 签名算法正确
 * 2. amount 规范化("18.00" -> "18")
 * 3. tier 小写化
 * 4. 与 SeekAll 端验证逻辑兼容
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = 'test-secret-for-verification-only';

function sign(orderNo, tier, amount) {
  const normalizedAmount = String(Number(amount));
  return createHmac('sha256', SECRET)
    .update(`${orderNo}|${tier.toLowerCase()}|${normalizedAmount}`)
    .digest('hex');
}

// SeekAll 端验证逻辑(模拟 license.service.ts:handleWmWebhook)
function seekallVerify(body) {
  const expected = sign(body.wmOrderId, body.tier, String(body.amount));
  if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(body.signature, 'hex'))) {
    return { ok: false, error: 'invalid signature' };
  }
  return { ok: true, tier: body.tier, amount: body.amount };
}

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

console.log('=== SeekAll Webhook 签名算法验证 ===\n');

console.log('1. 签名算法');
{
  const sig = sign('WM20260720001', 'trial', '1');
  // 手算 expected
  const expected = createHmac('sha256', SECRET).update('WM20260720001|trial|1').digest('hex');
  assert(sig === expected, `签名匹配: ${sig.slice(0, 16)}...`);
}

console.log('\n2. amount 规范化');
{
  const sig1 = sign('WM001', 'monthly', '18');
  const sig2 = sign('WM001', 'monthly', '18.00');
  assert(sig1 === sig2, '"18" 与 "18.00" 签名一致');
}
{
  const sig1 = sign('WM001', 'lifetime', '68');
  const sig2 = sign('WM001', 'lifetime', '68.00');
  assert(sig1 === sig2, '"68" 与 "68.00" 签名一致');
}

console.log('\n3. tier 大小写不敏感');
{
  const sig1 = sign('WM001', 'TRIAL', '1');
  const sig2 = sign('WM001', 'trial', '1');
  assert(sig1 === sig2, 'TRIAL 与 trial 签名一致');
}

console.log('\n4. SeekAll 端验证兼容性');
{
  const body = {
    wmOrderId: 'WM20260720001',
    tier: 'trial',
    amount: 1,
    signature: sign('WM20260720001', 'trial', '1'),
  };
  const result = seekallVerify(body);
  assert(result.ok === true, '合法签名通过验证');
}
{
  const body = {
    wmOrderId: 'WM20260720001',
    tier: 'trial',
    amount: 1,
    signature: sign('WM-OTHER', 'trial', '1'),
  };
  const result = seekallVerify(body);
  assert(result.ok === false, '篡改订单号被拒绝');
}
{
  const body = {
    wmOrderId: 'WM20260720001',
    tier: 'monthly', // 篡改档位
    amount: 1,
    signature: sign('WM20260720001', 'trial', '1'),
  };
  const result = seekallVerify(body);
  assert(result.ok === false, '篡改 tier 被拒绝');
}

console.log('\n5. 完整 body 生成(模拟 webhook 触发)');
{
  // 模拟 SeekallWebhookService.handleOrderPaid 的输出
  const payload = {
    orderId: 'uuid-xxx',
    orderNo: 'WM20260720001',
    amount: '1.00', // 来自支付通道,可能带小数
  };
  const tier = 'TRIAL'; // 来自 Product.seekallTier
  const normalizedAmount = String(Number(payload.amount));
  const signature = createHmac('sha256', SECRET)
    .update(`${payload.orderNo}|${tier.toLowerCase()}|${normalizedAmount}`)
    .digest('hex');
  const body = {
    wmOrderId: payload.orderNo,
    tier: tier.toLowerCase(),
    amount: Number(normalizedAmount),
    signature,
  };
  console.log('  body:', JSON.stringify(body, null, 2));
  const result = seekallVerify(body);
  assert(result.ok === true, '完整流程通过 SeekAll 验证');
}

console.log(`\n=== 结果: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
