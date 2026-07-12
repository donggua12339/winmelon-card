#!/usr/bin/env python3
"""直接 SSH 执行 b1-bootstrap 流程"""
import paramiko
import secrets, string, sys, time, json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST, USER, PASS = '162.251.93.5', 'root', 'lPdUNddxLzhbQr21'

def ssh(client, cmd, t=60):
    i, o, e = client.exec_command(cmd, timeout=t)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    return i, out, err

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)

# 读 admin 密码
_, pw, _ = ssh(client, "grep ADMIN_PASSWORD /opt/wm-card/.env.prod | cut -d= -f2")
print(f'Admin PW: {pw}\n')

API_INT = 'http://127.0.0.1:3000/api'
API_PUB = 'https://winmelon.cn/api'

def curl(method, url, body=None, token=None):
    parts = [f"-X {method}", '-H "Content-Type: application/json"']
    if token: parts.append(f"-H 'Authorization: Bearer {token}'")
    if body is not None:
        body_str = json.dumps(body).replace("'", "'\\''")
        parts.append(f"-d '{body_str}'")
    cmd = f"curl -s {(' '.join(parts))} '{url}' | tail -1"
    _, out, _ = ssh(client, cmd, t=30)
    return out

# ============= B1.1 登录 =============
print('=== B1.1 Login ===')
res = json.loads(curl('POST', f'{API_INT}/auth/login', {'username': 'admin', 'password': pw}))
if 'error' in res or 'Unauthorized' in str(res):
    print(f'FAILED: {res}'); sys.exit(1)
token = res['data']['accessToken']
shop_id = res['data']['user']['merchantId']
print('OK')

# ============= B1.2 创商品 =============
print('\n=== B1.2 Create Product ===')
product_body = {
    'shopId': shop_id,
    'name': 'WM Demo Member Card',
    'description': '30 days membership.',
    'price': '9.90',
    'originalPrice': '19.90',
    'isAutoDelivery': True,
    'purchaseLimit': 5,
}
res = json.loads(curl('POST', f'{API_INT}/admin/products', product_body, token))
product = res['data']
print(f'Product ID: {product["id"]}')
print(f'Price: ¥{product["price"]}')

# ============= B1.3 导入卡密 =============
print('\n=== B1.3 Import Stock ===')
cards = '\n'.join([f'WM-DEMO-{i:03d}-ABC123' for i in range(1, 6)])
res = json.loads(curl('POST', f'{API_INT}/admin/stock/import', {'productId': product['id'], 'csvContent': cards}, token))
print(f'Imported: {res["data"]["imported"]}')

# ============= B1.4 库存 =============
print('\n=== B1.4 Stock Stats ===')
res = json.loads(curl('GET', f'{API_INT}/admin/stock/stats?productId={product["id"]}', token=token))
s = res['data']
print(f'available={s["available"]}, locked={s["locked"]}, sold={s["sold"]}, total={s["total"]}')

# ============= B1.5 上架 =============
print('\n=== B1.5 Online ===')
res = json.loads(curl('PATCH', f'{API_INT}/admin/products/{product["id"]}/status', {'status': 'ONLINE'}, token))
print(f'Status: {res["data"]["status"]}')

# ============= B1.6 下单 =============
print('\n=== B1.6 Buyer Order ===')
buyer_email = f'buyer{secrets.choice(string.ascii_lowercase)}@demo.com'
order_body = {
    'shopCode': 'main',
    'buyerEmail': buyer_email,
    'idempotencyKey': f'b1-{secrets.token_hex(8)}',
    'items': [{'productId': product['id'], 'quantity': 1}],
}
res = json.loads(curl('POST', f'{API_PUB}/shop/main/orders', order_body))
order = res['data']
print(f'Order: {order["orderNo"]}, ¥{order["totalAmount"]}')

# ============= B1.7 支付 =============
print('\n=== B1.7 Mock Pay ===')
res = json.loads(curl('POST', f'{API_PUB}/payment/mock-pay', {'orderNo': order['orderNo']}))
print(f'Trigger: {res}')
time.sleep(3)

# ============= B1.8 查订单 =============
print('\n=== B1.8 Query Order ===')
res = json.loads(curl('POST', f'{API_PUB}/orders/query', {'orderNo': order['orderNo'], 'buyerEmail': buyer_email}))
o = res['data']
print(f'Status: {o["status"]}')
print(f'Paid: {o["paidAt"]}')
print(f'Delivered: {o["deliveredAt"]}')
print('Cards:')
for c in o['cards']:
    print(f'  [{c["productName"]}] {c["content"]}')

# ============= B1.9 库存 =============
print('\n=== B1.9 Stock After ===')
res = json.loads(curl('GET', f'{API_INT}/admin/stock/stats?productId={product["id"]}', token=token))
s = res['data']
print(f'available={s["available"]}, locked={s["locked"]}, sold={s["sold"]}')

client.close()
print('\n=========================')
print('B1 DONE')
print(f'Product ID: {product["id"]}')
print(f'Order No: {order["orderNo"]}')
print(f'Buyer Email: {buyer_email}')
print('=========================')
