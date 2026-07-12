#!/usr/bin/env python3
"""B1: 创建商品 + 导入卡密 + 上架 + E2E 演示"""
import paramiko
import secrets
import string
import sys
import json
import urllib.request

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = '162.251.93.5'
USER = 'root'
PASSWORD = 'lPdUNddxLzhbQr21'

def ssh_exec(client, cmd, timeout=60):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    code = stdout.channel.recv_exit_status()
    return code, out, err

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

# 从 .env.prod 读取管理员密码
_, admin_pw, _ = ssh_exec(client, "grep ADMIN_PASSWORD /opt/wm-card/.env.prod | cut -d= -f2")
print(f'管理员密码: {admin_pw}')

API_INT = 'http://127.0.0.1:3000/api'
API_PUB = 'https://winmelon.cn/api'

def http_json(method, url, body=None, token=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {'error': e.code, 'body': e.read().decode('utf-8', errors='replace')[:300]}

# ============= B1.1: 登录 =============
print('\n=== B1.1: 管理员登录 ===')
res = http_json('POST', f'{API_INT}/auth/login', {'username': 'admin', 'password': admin_pw})
if 'error' in res:
    print('❌ 登录失败', res); sys.exit(1)
token = res['data']['accessToken']
shop_id = res['data']['user']['merchantId']
print(f'✓ 登录成功')

# ============= B1.2: 创建商品 =============
print('\n=== B1.2: 创建商品 ===')
res = http_json('POST', f'{API_INT}/admin/products', {
    'shopId': shop_id,
    'name': 'WM 演示会员卡',
    'description': '30 天会员，含全部基础权益。',
    'price': '9.90',
    'originalPrice': '19.90',
    'isAutoDelivery': True,
    'purchaseLimit': 5,
}, token=token)
if 'error' in res:
    print('❌', res); sys.exit(1)
product = res['data']
print(f'✓ 商品: {product["name"]} (ID: {product["id"]})')
print(f'  价格: ¥{product["price"]}')

# ============= B1.3: 导入卡密 =============
print('\n=== B1.3: 导入 5 张卡密 ===')
cards = [f'WM-DEMO-{i:03d}-ABC123' for i in range(1, 6)]
csv_content = '\n'.join(cards)
res = http_json('POST', f'{API_INT}/admin/stock/import', {
    'productId': product['id'],
    'csvContent': csv_content,
}, token=token)
print(f'✓ 导入结果: imported={res["data"]["imported"]}, duplicated={res["data"]["duplicated"]}, failed={res["data"]["failed"]}')

# ============= B1.4: 查询库存 =============
print('\n=== B1.4: 库存检查 ===')
res = http_json('GET', f'{API_INT}/admin/stock/stats?productId={product["id"]}', token=token)
print(f'  available={res["data"]["available"]}, locked={res["data"]["locked"]}, sold={res["data"]["sold"]}, total={res["data"]["total"]}')

# ============= B1.5: 上架 =============
print('\n=== B1.5: 商品上架 ===')
res = http_json('PATCH', f'{API_INT}/admin/products/{product["id"]}/status', {'status': 'ONLINE'}, token=token)
print(f'✓ 状态: {res["data"]["status"]}')

# ============= B1.6: 买家下单 =============
print('\n=== B1.6: 买家下单 ===')
buyer_email = f'test{secrets.choice(string.ascii_lowercase)}@demo.com'
res = http_json('POST', f'{API_PUB}/shop/main/orders', {
    'shopCode': 'main',
    'buyerEmail': buyer_email,
    'idempotencyKey': f'b1-{secrets.token_hex(8)}',
    'items': [{'productId': product['id'], 'quantity': 1}],
})
if 'error' in res:
    print('❌', res); sys.exit(1)
order = res['data']
print(f'✓ 订单号: {order["orderNo"]}')
print(f'  总额: ¥{order["totalAmount"]}')
print(f'  状态: {order["status"]}, 过期时间: {order["expireAt"]}')

# ============= B1.7: 触发模拟支付 =============
print('\n=== B1.7: 模拟支付 ===')
res = http_json('POST', f'{API_PUB}/payment/mock-pay', {'orderNo': order['orderNo']})
print(f'✓ 回调触发: {res}')

# 等发卡
import time
time.sleep(3)

# ============= B1.8: 买家查询订单 + 卡密 =============
print('\n=== B1.8: 买家查询订单 ===')
res = http_json('POST', f'{API_PUB}/orders/query', {
    'orderNo': order['orderNo'],
    'buyerEmail': buyer_email,
})
order_full = res['data']
print(f'✓ 查询成功')
print(f'  状态: {order_full["status"]}')
print(f'  支付: {order_full["paidAt"]}')
print(f'  发卡: {order_full["deliveredAt"]}')
print(f'  卡密:')
for c in order_full['cards']:
    print(f'    [{c["productName"]}] {c["content"]}')

# ============= B1.9: 检查库存扣减 =============
print('\n=== B1.9: 库存扣减确认 ===')
res = http_json('GET', f'{API_INT}/admin/stock/stats?productId={product["id"]}', token=token)
print(f'  available={res["data"]["available"]}, locked={res["data"]["locked"]}, sold={res["data"]["sold"]}')

client.close()

print('\n========================')
print(f'✅ B1 完成！')
print(f'商品 ID: {product["id"]}')
print(f'订单号: {order["orderNo"]}')
print(f'买家邮箱: {buyer_email}')
print('========================')
