#!/bin/bash
# B1: 通过 SSH 在服务器上完成商品+卡密+E2E 演示
# 用法：bash deploy/scripts/b1-bootstrap.sh

set -e
HOST="162.251.93.5"
USER="root"
PASS="lPdUNddxLzhbQr21"

# 通过 python + paramiko 复用现有 SSH 工具
python3 - "$@" <<'PYEOF'
import paramiko, secrets, string, sys, time, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST, USER, PASS = '162.251.93.5', 'root', 'lPdUNddxLzhbQr21'

def ssh(client, cmd, t=60):
    i, o, e = client.exec_command(cmd, timeout=t)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    return i, out, err

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30)

# 读 admin 密码
_, pw, _ = ssh(c, "grep ADMIN_PASSWORD /opt/wm-card/.env.prod | cut -d= -f2")
print(f'📌 Admin password: {pw}\n')

API_INT = 'http://127.0.0.1:3000/api'
API_PUB = 'https://winmelon.cn/api'
HEADERS_JSON = 'Content-Type: application/json'

def curl(method, url, body=None, token=None):
    hdrs = f"-H '{HEADERS_JSON}'"
    if token: hdrs += f" -H 'Authorization: Bearer {token}'"
    data = f"-d '{json.dumps(body)}'" if body else ''
    cmd = f"curl -s -X {method} '{url}' {hdrs} {data} | tail -1"
    _, out, _ = ssh(c, cmd, t=30)
    return out

print('=== B1.1 登录 ===')
res_str = curl('POST', f'{API_INT}/auth/login', {'username': 'admin', 'password': pw})
if 'Unauthorized' in res_str:
    print('❌ 登录失败:', res_str); sys.exit(1)
res = json.loads(res_str)
token = res['data']['accessToken']
shop_id = res['data']['user']['merchantId']
print(f'✓ 登录成功')

print('\n=== B1.2 创建商品 ===')
product_body = {
    'shopId': shop_id,
    'name': 'WM 演示会员卡',
    'description': '30 天会员，含全部基础权益。',
    'price': '9.90',
    'originalPrice': '19.90',
    'isAutoDelivery': True,
    'purchaseLimit': 5,
}
res = json.loads(curl('POST', f'{API_INT}/admin/products', product_body, token))
product = res['data']
print(f'✓ 商品: {product["name"]} (ID: {product["id"]})')
print(f'  价格 ¥{product["price"]} (原价 ¥{product["originalPrice"]})')

print('\n=== B1.3 导入 5 张卡密 ===')
cards = '\n'.join([f'WM-DEMO-{i:03d}-ABC123' for i in range(1, 6)])
res = json.loads(curl('POST', f'{API_INT}/admin/stock/import', {'productId': product['id'], 'csvContent': cards}, token))
print(f'  imported={res["data"]["imported"]}, duplicated={res["data"]["duplicated"]}, failed={res["data"]["failed"]}')

print('\n=== B1.4 库存检查 ===')
res = json.loads(curl('GET', f'{API_INT}/admin/stock/stats?productId={product["id"]}', token=token))
s = res['data']
print(f'  available={s["available"]}, locked={s["locked"]}, sold={s["sold"]}, total={s["total"]}')

print('\n=== B1.5 上架 ===')
res = json.loads(curl('PATCH', f'{API_INT}/admin/products/{product["id"]}/status', {'status': 'ONLINE'}, token))
print(f'✓ 状态: {res["data"]["status"]}')

print('\n=== B1.6 买家下单 ===')
buyer_email = f'buyer{secrets.choice(string.ascii_lowercase)}@demo.com'
order_body = {
    'shopCode': 'main',
    'buyerEmail': buyer_email,
    'idempotencyKey': f'b1-{secrets.token_hex(8)}',
    'items': [{'productId': product['id'], 'quantity': 1}],
}
res = json.loads(curl('POST', f'{API_PUB}/shop/main/orders', order_body))
order = res['data']
print(f'✓ 订单号: {order["orderNo"]}, 总额 ¥{order["totalAmount"]}, 状态 {order["status"]}')

print('\n=== B1.7 模拟支付 ===')
res = json.loads(curl('POST', f'{API_PUB}/payment/mock-pay', {'orderNo': order['orderNo']}))
print(f'✓ 回调触发: {res}')

time.sleep(3)

print('\n=== B1.8 买家查询 ===')
res = json.loads(curl('POST', f'{API_PUB}/orders/query', {'orderNo': order['orderNo'], 'buyerEmail': buyer_email}))
o = res['data']
print(f'✓ 订单 {o["orderNo"]} 状态 {o["status"]}')
print(f'  支付: {o["paidAt"]}')
print(f'  发卡: {o["deliveredAt"]}')
print(f'  卡密:')
for c_item in o['cards']:
    print(f'    [{c_item["productName"]}] {c_item["content"]}')

print('\n=== B1.9 库存扣减 ===')
res = json.loads(curl('GET', f'{API_INT}/admin/stock/stats?productId={product["id"]}', token=token))
s = res['data']
print(f'  available={s["available"]}, locked={s["locked"]}, sold={s["sold"]}')

c.close()
print('\n========================')
print('✅ B1 完成')
print('========================')
PYEOF
