<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { get, post } from '@/api/http';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: string;
  originalPrice?: string | null;
  purchaseLimit?: number | null;
  stock: number;
}
interface ShopInfo {
  id: string;
  code: string;
  name: string;
  announcement?: string;
}
interface CreateOrderResult {
  orderId: string;
  orderNo: string;
  status: string;
  totalAmount: string;
  expireAt: string;
  idempotentReplay: boolean;
}
interface CreatePaymentResult {
  paymentUrl: string;
  orderNo: string;
}

const route = useRoute();
const shopCode = route.params.merchantCode as string;

const shop = ref<ShopInfo | null>(null);
const products = ref<Product[]>([]);
const loading = ref(false);

const orderDialogVisible = ref(false);
const selectedProduct = ref<Product | null>(null);
const orderForm = ref({
  buyerEmail: '',
  buyerContact: '',
  quantity: 1,
  channel: 'mock' as 'mock' | 'usdt',
});
const submitting = ref(false);

async function fetchShop(): Promise<void> {
  try {
    shop.value = await get<ShopInfo>(`/shop/${shopCode}`);
  } catch {
    ElMessage.error('店铺不存在或已下线');
  }
}

async function fetchProducts(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<{ items: Product[] }>(`/shop/${shopCode}/products`);
    products.value = data.items;
  } finally {
    loading.value = false;
  }
}

function openOrder(product: Product): void {
  selectedProduct.value = product;
  orderForm.value = {
    buyerEmail: '',
    buyerContact: '',
    quantity: 1,
    channel: 'mock',
  };
  orderDialogVisible.value = true;
}

async function onSubmitOrder(): Promise<void> {
  if (!selectedProduct.value) return;
  if (!orderForm.value.buyerEmail) {
    ElMessage.warning('请填写邮箱');
    return;
  }
  if (selectedProduct.value.purchaseLimit && orderForm.value.quantity > selectedProduct.value.purchaseLimit) {
    ElMessage.warning(`单次限购 ${selectedProduct.value.purchaseLimit} 件`);
    return;
  }

  submitting.value = true;
  try {
    const idempotencyKey = `${orderForm.value.buyerEmail}_${selectedProduct.value.id}_${orderForm.value.quantity}_${Math.floor(Date.now() / 300000)}`;

    const order = await post<CreateOrderResult>(`/shop/${shopCode}/orders`, {
      shopCode,
      buyerEmail: orderForm.value.buyerEmail,
      buyerContact: orderForm.value.buyerContact || undefined,
      idempotencyKey,
      items: [{ productId: selectedProduct.value.id, quantity: orderForm.value.quantity }],
    });

    orderDialogVisible.value = false;

    const pay = await post<CreatePaymentResult>('/payments', {
      orderId: order.orderId,
      channel: orderForm.value.channel,
    });

    window.location.href = pay.paymentUrl;
  } catch (err) {
    console.error(err);
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  fetchShop();
  fetchProducts();
  // 上报页面访问（UV 统计，失败静默不影响用户体验）
  post(`/shop/${shopCode}/track`, { path: window.location.pathname })
    .then(() => undefined)
    .catch(() => undefined);
});
</script>

<template>
  <div class="shop">
    <!-- 店铺 Hero -->
    <header class="shop-header">
      <div class="hero-glow"></div>
      <div class="hero-content">
        <div v-if="shop" class="shop-info">
          <h1 class="shop-name">{{ shop.name }}</h1>
          <p v-if="shop.announcement" class="announcement">{{ shop.announcement }}</p>
        </div>
        <RouterLink to="/" class="back-link">← 返回首页</RouterLink>
      </div>
    </header>

    <!-- 商品列表 -->
    <main class="products-section">
      <div class="section-header">
        <h2>在售商品</h2>
        <span class="count">{{ products.length }} 件</span>
      </div>

      <div v-loading="loading" class="products-grid">
        <el-empty v-if="!loading && products.length === 0" description="暂无在售商品" />
        <div
          v-for="(p, i) in products"
          :key="p.id"
          class="glass product-card"
          :style="{ animationDelay: `${i * 0.08}s` }"
        >
          <div class="product-main">
            <h3 class="product-name">{{ p.name }}</h3>
            <p v-if="p.description" class="product-desc">{{ p.description }}</p>
            <div class="product-meta">
              <span v-if="p.purchaseLimit" class="meta-tag limit">限购 {{ p.purchaseLimit }}</span>
              <span class="meta-tag stock">库存 {{ p.stock }}</span>
            </div>
          </div>
          <div class="product-footer">
            <div class="price-area">
              <span class="price">¥{{ p.price }}</span>
              <span v-if="p.originalPrice" class="original">¥{{ p.originalPrice }}</span>
            </div>
            <button class="buy-btn" :disabled="p.stock === 0" @click="openOrder(p)">
              {{ p.stock === 0 ? '已售罄' : '立即购买' }}
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- 底部 -->
    <footer class="shop-footer">
      <RouterLink to="/query">订单查询</RouterLink>
    </footer>

    <!-- 下单弹窗 -->
    <el-dialog v-model="orderDialogVisible" title="确认订单" width="440px" class="order-dialog">
      <div class="order-product">
        <div class="order-product-name">{{ selectedProduct?.name }}</div>
        <div class="order-product-price">¥{{ selectedProduct?.price }}</div>
      </div>

      <div class="order-row">
        <label>数量</label>
        <el-input-number v-model="orderForm.quantity" :min="1" :max="selectedProduct?.purchaseLimit || 99" />
      </div>

      <div class="order-row total-row">
        <label>合计</label>
        <span class="total-price">¥{{ (Number(selectedProduct?.price || 0) * orderForm.quantity).toFixed(2) }}</span>
      </div>

      <div class="order-row">
        <label>邮箱 <span class="required">*</span></label>
        <el-input v-model="orderForm.buyerEmail" placeholder="用于接收卡密和查询订单" />
      </div>

      <div class="order-row">
        <label>手机</label>
        <el-input v-model="orderForm.buyerContact" placeholder="可选" />
      </div>

      <div class="order-row">
        <label>支付方式</label>
        <el-radio-group v-model="orderForm.channel">
          <el-radio value="mock">模拟支付（测试）</el-radio>
          <el-radio value="usdt">USDT（TRC20）</el-radio>
        </el-radio-group>
      </div>

      <template #footer>
        <el-button @click="orderDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmitOrder">去支付</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.shop {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 店铺 Hero */
.shop-header {
  position: relative;
  padding: 48px 24px 32px;
  overflow: hidden;
  border-bottom: 1px solid var(--wm-border-glass);
}

.hero-glow {
  position: absolute;
  top: -50%;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  height: 400px;
  background: radial-gradient(ellipse, rgba(124, 58, 237, 0.2) 0%, transparent 60%);
  pointer-events: none;
}

.hero-content {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
}

.shop-name {
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 800;
  margin: 0 0 12px;
  background: var(--wm-gradient-aurora);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}

.announcement {
  color: var(--wm-text-secondary);
  font-size: 14px;
  margin: 0;
  max-width: 600px;
}

.back-link {
  color: var(--wm-text-tertiary);
  text-decoration: none;
  font-size: 13px;
  transition: color 0.3s ease;
}

.back-link:hover {
  color: var(--wm-accent-cyan);
}

/* 商品区 */
.products-section {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 32px 24px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}

.count {
  color: var(--wm-text-tertiary);
  font-size: 13px;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  min-height: 200px;
}

.product-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: fade-in-up 0.6s ease-out backwards;
  transition: all 0.4s ease;
}

.product-card:hover {
  transform: translateY(-4px);
  border-color: var(--wm-border-glass-hover);
  box-shadow: 0 12px 40px rgba(124, 58, 237, 0.2);
}

.product-main {
  flex: 1;
}

.product-name {
  font-size: 17px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--wm-text-primary);
}

.product-desc {
  font-size: 13px;
  color: var(--wm-text-secondary);
  line-height: 1.6;
  margin: 0 0 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-tag {
  padding: 2px 10px;
  border-radius: var(--wm-radius-pill);
  font-size: 11px;
  font-weight: 500;
}

.meta-tag.limit {
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
}

.meta-tag.stock {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
}

.product-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid var(--wm-border-glass);
}

.price-area {
  display: flex;
  flex-direction: column;
}

.price {
  font-size: 24px;
  font-weight: 800;
  color: var(--wm-accent-pink);
  text-shadow: 0 0 16px rgba(244, 114, 182, 0.4);
  line-height: 1;
}

.original {
  font-size: 12px;
  color: var(--wm-text-tertiary);
  text-decoration: line-through;
  margin-top: 4px;
}

.buy-btn {
  padding: 10px 20px;
  background: var(--wm-gradient-primary);
  color: white;
  border: none;
  border-radius: var(--wm-radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
}

.buy-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5);
}

.buy-btn:disabled {
  background: rgba(255, 255, 255, 0.08);
  color: var(--wm-text-tertiary);
  cursor: not-allowed;
  box-shadow: none;
}

/* 底部 */
.shop-footer {
  padding: 24px;
  text-align: center;
}

.shop-footer a {
  color: var(--wm-text-secondary);
  text-decoration: none;
  font-size: 13px;
  transition: color 0.3s ease;
}

.shop-footer a:hover {
  color: var(--wm-accent-cyan);
}

/* 下单弹窗 */
.order-product {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--wm-glass-bg);
  border-radius: var(--wm-radius-md);
  margin-bottom: 20px;
}

.order-product-name {
  font-weight: 600;
}

.order-product-price {
  color: var(--wm-accent-pink);
  font-weight: 700;
}

.order-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.order-row label {
  width: 60px;
  color: var(--wm-text-secondary);
  font-size: 14px;
}

.required {
  color: var(--wm-accent-red);
}

.order-row .el-input,
.order-row .el-input-number {
  flex: 1;
}

.total-row {
  padding: 12px 0;
  border-top: 1px dashed var(--wm-border-glass);
  border-bottom: 1px dashed var(--wm-border-glass);
}

.total-price {
  font-size: 22px;
  font-weight: 800;
  color: var(--wm-accent-pink);
  text-shadow: 0 0 12px rgba(244, 114, 182, 0.3);
}
</style>
