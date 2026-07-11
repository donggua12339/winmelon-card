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
    // 幂等 key：邮箱+商品+数量+时间戳（5 分钟内同一组合视为同一订单）
    const idempotencyKey = `${orderForm.value.buyerEmail}_${selectedProduct.value.id}_${orderForm.value.quantity}_${Math.floor(Date.now() / 300000)}`;

    const order = await post<CreateOrderResult>(`/shop/${shopCode}/orders`, {
      shopCode,
      buyerEmail: orderForm.value.buyerEmail,
      buyerContact: orderForm.value.buyerContact || undefined,
      idempotencyKey,
      items: [{ productId: selectedProduct.value.id, quantity: orderForm.value.quantity }],
    });

    orderDialogVisible.value = false;

    // 选择支付通道（MVP 固定 mock）
    const pay = await post<CreatePaymentResult>('/payments', {
      orderId: order.orderId,
      channel: 'mock',
    });

    // 跳转支付页
    window.location.href = pay.paymentUrl;
  } catch (err) {
    // 错误已由 http 拦截器提示
    console.error(err);
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  fetchShop();
  fetchProducts();
});
</script>

<template>
  <div class="shop">
    <div v-if="shop" class="header">
      <h1>{{ shop.name }}</h1>
      <el-alert v-if="shop.announcement" type="info" :closable="false" :title="shop.announcement" show-icon />
    </div>

    <div v-loading="loading" class="products">
      <el-empty v-if="!loading && products.length === 0" description="暂无在售商品" />
      <el-card v-for="p in products" :key="p.id" shadow="hover" class="product-card">
        <div class="product">
          <div class="info">
            <h3>{{ p.name }}</h3>
            <p v-if="p.description" class="desc">{{ p.description }}</p>
            <div class="meta">
              <span class="price">¥{{ p.price }}</span>
              <span v-if="p.originalPrice" class="original">¥{{ p.originalPrice }}</span>
              <span class="stock">库存 {{ p.stock }}</span>
              <span v-if="p.purchaseLimit" class="limit">限购 {{ p.purchaseLimit }}</span>
            </div>
          </div>
          <el-button type="primary" :disabled="p.stock === 0" @click="openOrder(p)">立即购买</el-button>
        </div>
      </el-card>
    </div>

    <el-dialog v-model="orderDialogVisible" title="确认订单" width="440px">
      <el-form label-width="80px">
        <el-form-item label="商品">
          <span>{{ selectedProduct?.name }}</span>
        </el-form-item>
        <el-form-item label="单价">
          <span class="price">¥{{ selectedProduct?.price }}</span>
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number v-model="orderForm.quantity" :min="1" :max="selectedProduct?.purchaseLimit || 99" />
        </el-form-item>
        <el-form-item label="合计">
          <span class="price total">
            ¥{{ (Number(selectedProduct?.price || 0) * orderForm.quantity).toFixed(2) }}
          </span>
        </el-form-item>
        <el-form-item label="邮箱" required>
          <el-input v-model="orderForm.buyerEmail" placeholder="用于接收卡密和查询订单" />
        </el-form-item>
        <el-form-item label="手机">
          <el-input v-model="orderForm.buyerContact" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="orderDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmitOrder">去支付</el-button>
      </template>
    </el-dialog>

    <div class="footer">
      <RouterLink to="/query">查询订单</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.shop {
  padding: 24px;
  max-width: 960px;
  margin: 0 auto;
}
.header {
  margin-bottom: 24px;
}
.header h1 {
  margin: 0 0 12px;
}
.products {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.product {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.info h3 {
  margin: 0 0 8px;
}
.desc {
  color: #606266;
  font-size: 13px;
  margin: 0 0 8px;
}
.meta {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 13px;
  color: #909399;
}
.price {
  color: #f56c6c;
  font-size: 18px;
  font-weight: bold;
}
.original {
  text-decoration: line-through;
  color: #c0c4cc;
}
.stock {
  color: #67c23a;
}
.limit {
  color: #e6a23c;
}
.total {
  font-size: 22px;
}
.footer {
  text-align: center;
  margin-top: 32px;
}
</style>
