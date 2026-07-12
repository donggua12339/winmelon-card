#!/bin/bash
# 在服务器上执行的 B1 完整脚本
set -e

API=http://127.0.0.1:3000/api
PW=$(grep ADMIN_PASSWORD /opt/wm-card/.env.prod | cut -d= -f2)
echo "=== Admin Password: $PW ==="

# 1. 登录获取 token
LOGIN_RES=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"$PW\"}")
TOKEN=$(echo "$LOGIN_RES" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['accessToken'])")
MERCHANT_ID=$(echo "$LOGIN_RES" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['user']['merchantId'])")
# 查询 shop id
SHOP_ID=$(curl -s "$API/admin/shops/me" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['id'])")

if [ -z "$TOKEN" ]; then
    echo "登录失败：$LOGIN_RES"
    exit 1
fi
echo "=== 登录成功 ==="

# 2. 创建商品
PROD_RES=$(curl -s -X POST $API/admin/products \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"shopId\":\"$SHOP_ID\",\"name\":\"WM 演示会员卡\",\"description\":\"30 天会员，含全部基础权益\",\"price\":\"9.90\",\"originalPrice\":\"19.90\",\"isAutoDelivery\":true,\"purchaseLimit\":5}")
PROD_ID=$(echo "$PROD_RES" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['id'])" 2>/dev/null || echo "")
if [ -z "$PROD_ID" ]; then
    echo "创商品失败：$PROD_RES"
    exit 1
fi
echo "=== 商品创建 ==="
echo "ID: $PROD_ID"
echo "$PROD_RES" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'价格 ¥{d[\"data\"][\"price\"]}, 状态 {d[\"data\"][\"status\"]}')"

# 3. 导入 5 张卡密
IMPORT_RES=$(curl -s -X POST $API/admin/stock/import \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    --data-binary @<(python3 -c "
import json
print(json.dumps({
    'productId': '$PROD_ID',
    'csvContent': 'WM-DEMO-001-ABC123\nWM-DEMO-002-ABC123\nWM-DEMO-003-ABC123\nWM-DEMO-004-ABC123\nWM-DEMO-005-ABC123'
}))
"))
echo "=== 卡密导入 ==="
echo "$IMPORT_RES" | python3 -m json.tool

# 4. 库存检查
STATS=$(curl -s "$API/admin/stock/stats?productId=$PROD_ID" -H "Authorization: Bearer $TOKEN")
echo "=== 库存（导入后）==="
echo "$STATS" | python3 -m json.tool

# 5. 上架
ONLINE_RES=$(curl -s -X PATCH "$API/admin/products/$PROD_ID/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status":"ONLINE"}')
echo "=== 上架 ==="
echo "$ONLINE_RES" | python3 -c "import sys,json;d=json.load(sys.stdin);print('状态:', d['data']['status'])"

# 6. 买家下单（用公网 HTTPS）
BUYER_EMAIL="buyer$(date +%s)@demo.com"
ORDER_RES=$(curl -s -X POST https://winmelon.cn/api/shop/main/orders \
    -H "Content-Type: application/json" \
    -d "{\"shopCode\":\"main\",\"buyerEmail\":\"$BUYER_EMAIL\",\"idempotencyKey\":\"b1-$(openssl rand -hex 8)\",\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":1}]}")
ORDER_NO=$(echo "$ORDER_RES" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['orderNo'])" 2>/dev/null || echo "")
if [ -z "$ORDER_NO" ]; then
    echo "下单失败：$ORDER_RES"
    exit 1
fi
echo "=== 下单 ==="
echo "订单号: $ORDER_NO, 邮箱: $BUYER_EMAIL"
echo "$ORDER_RES" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'总额 ¥{d[\"data\"][\"totalAmount\"]}, 状态 {d[\"data\"][\"status\"]}')"

# 7. 触发模拟支付
PAY_RES=$(curl -s -X POST https://winmelon.cn/api/payment/mock-pay \
    -H "Content-Type: application/json" \
    -d "{\"orderNo\":\"$ORDER_NO\"}")
echo "=== 模拟支付 ==="
echo "$PAY_RES"

sleep 3

# 8. 查订单
QUERY_RES=$(curl -s -X POST https://winmelon.cn/api/orders/query \
    -H "Content-Type: application/json" \
    -d "{\"orderNo\":\"$ORDER_NO\",\"buyerEmail\":\"$BUYER_EMAIL\"}")
echo "=== 订单查询 ==="
echo "$QUERY_RES" | python3 -c "
import sys,json
d = json.load(sys.stdin)['data']
print(f'状态: {d[\"status\"]}')
print(f'支付: {d[\"paidAt\"]}')
print(f'发卡: {d[\"deliveredAt\"]}')
print('卡密:')
for c in d['cards']:
    print(f'  [{c[\"productName\"]}] {c[\"content\"]}')
"

# 9. 库存扣减
FINAL_STATS=$(curl -s "$API/admin/stock/stats?productId=$PROD_ID" -H "Authorization: Bearer $TOKEN")
echo "=== 最终库存 ==="
echo "$FINAL_STATS" | python3 -m json.tool

echo ""
echo "==========================================="
echo "B1 完成！"
echo "商品 ID: $PROD_ID"
echo "订单号: $ORDER_NO"
echo "买家邮箱: $BUYER_EMAIL"
echo "==========================================="
