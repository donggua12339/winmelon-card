<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { get, post, put, del } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

interface ProductStock {
  available: number;
  locked: number;
  sold: number;
}
interface Product {
  id: string;
  name: string;
  description?: string;
  price: string;
  originalPrice?: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'SOLD_OUT';
  purchaseLimit?: number | null;
  isAutoDelivery: boolean;
  sort: number;
  seekallTier?: 'TRIAL' | 'MONTHLY' | 'LIFETIME' | null;
  xcjTier?: string | null;
  createdAt: string;
  stock: ProductStock;
}

interface ProductList {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

const loading = ref(false);
const list = ref<Product[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');

// 店铺列表（SUPER_ADMIN 创建商品时选择）
interface ShopOption {
  id: string;
  code: string;
  name: string;
  merchantId: string;
  isOnline: boolean;
  merchant: { code: string; name: string; contactEmail: string };
}
const auth = useAuthStore();
const isSuperAdmin = computed(() => auth.roles.includes('SUPER_ADMIN'));
const shops = ref<ShopOption[]>([]);

const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const formRef = ref<FormInstance>();
const submitting = ref(false);
const form = reactive({
  id: '',
  shopId: '',
  name: '',
  description: '',
  price: 0,
  originalPrice: undefined as number | undefined,
  purchaseLimit: undefined as number | undefined,
  isAutoDelivery: true,
  sort: 0,
  seekallTier: '' as '' | 'TRIAL' | 'MONTHLY' | 'LIFETIME',
  xcjTier: '' as string,
});

const rules: FormRules<typeof form> = {
  shopId: [{ required: true, message: '请选择店铺', trigger: 'change' }],
  name: [
    { required: true, message: '请输入商品名称', trigger: 'blur' },
    { max: 255, message: '名称最长 255', trigger: 'blur' },
  ],
  price: [
    { required: true, message: '请输入价格', trigger: 'blur' },
    {
      validator: (_r, v: number, cb) => {
        if (v <= 0 || v > 99999.99) return cb(new Error('价格范围 0.01 ~ 99999.99'));
        cb();
      },
      trigger: 'blur',
    },
  ],
};

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<ProductList>('/admin/products', {
      params: { page: page.value, pageSize: pageSize.value, keyword: keyword.value || undefined },
    });
    list.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function fetchShops(): Promise<void> {
  if (!isSuperAdmin.value) return;
  try {
    const data = await get<{ items: ShopOption[] }>('/admin/shops');
    shops.value = data.items;
  } catch (err) {
    console.error('加载店铺列表失败', err);
  }
}

function openCreate(): void {
  dialogMode.value = 'create';
  Object.assign(form, {
    id: '',
    shopId: shops.value[0]?.id ?? '',
    name: '',
    description: '',
    price: 0,
    originalPrice: undefined,
    purchaseLimit: undefined,
    isAutoDelivery: true,
    sort: 0,
    seekallTier: '',
    xcjTier: '',
  });
  dialogVisible.value = true;
}

function openEdit(row: Product): void {
  dialogMode.value = 'edit';
  Object.assign(form, {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    price: Number(row.price),
    originalPrice: row.originalPrice ? Number(row.originalPrice) : undefined,
    purchaseLimit: row.purchaseLimit ?? undefined,
    isAutoDelivery: row.isAutoDelivery,
    sort: row.sort,
    seekallTier: row.seekallTier ?? '',
    xcjTier: row.xcjTier ?? '',
  });
  dialogVisible.value = true;
}

async function onSubmit(): Promise<void> {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    const payload = {
      name: form.name,
      description: form.description || undefined,
      price: form.price,
      originalPrice: form.originalPrice,
      purchaseLimit: form.purchaseLimit,
      isAutoDelivery: form.isAutoDelivery,
      sort: form.sort,
      seekallTier: form.seekallTier || undefined,
      xcjTier: form.xcjTier || undefined,
    };
    if (dialogMode.value === 'create') {
      if (!form.shopId) {
        ElMessage.error('请选择店铺');
        submitting.value = false;
        return;
      }
      await post('/admin/products', { ...payload, shopId: form.shopId });
      ElMessage.success('创建成功');
    } else {
      await put(`/admin/products/${form.id}`, payload);
      ElMessage.success('更新成功');
    }
    dialogVisible.value = false;
    fetchList();
  } finally {
    submitting.value = false;
  }
}

async function toggleStatus(row: Product): Promise<void> {
  const target = row.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
  const label = target === 'ONLINE' ? '上架' : '下架';
  await ElMessageBox.confirm(`确定${label}商品「${row.name}」？`, '提示', { type: 'warning' });
  await post(`/admin/products/${row.id}/status`, { status: target });
  ElMessage.success(`${label}成功`);
  fetchList();
}

async function onDelete(row: Product): Promise<void> {
  await ElMessageBox.confirm(`确定删除商品「${row.name}」？此操作不可恢复。`, '危险操作', {
    type: 'error',
    confirmButtonText: '删除',
    confirmButtonClass: 'el-button--danger',
  });
  await del(`/admin/products/${row.id}`);
  ElMessage.success('已删除');
  fetchList();
}

function statusTag(s: Product['status']): { type: 'success' | 'info' | 'warning'; text: string } {
  if (s === 'ONLINE') return { type: 'success', text: '上架中' };
  if (s === 'SOLD_OUT') return { type: 'warning', text: '已售罄' };
  return { type: 'info', text: '已下架' };
}

onMounted(() => {
  fetchList();
  fetchShops();
});
</script>

<template>
  <div class="admin-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">商品管理</h2>
        <p class="page-desc">管理店铺商品、库存与上下架状态</p>
      </div>
      <div class="actions">
        <el-input
          v-model="keyword"
          placeholder="搜索商品名"
          clearable
          style="width: 220px"
          @clear="fetchList"
          @keyup.enter="fetchList"
        />
        <el-button @click="fetchList">刷新</el-button>
        <el-button type="primary" @click="openCreate">+ 新建商品</el-button>
      </div>
    </header>

    <section class="panel">
      <el-table v-loading="loading" :data="list" :border="false" stripe>
        <el-table-column prop="name" label="商品名" min-width="180" />
        <el-table-column prop="price" label="价格" width="100">
          <template #default="{ row }">
            <span class="amount">¥{{ row.price }}</span>
          </template>
        </el-table-column>
        <el-table-column label="库存" width="160">
          <template #default="{ row }">
            <span :class="{ 'low-stock': row.stock.available === 0 }">可用 {{ row.stock.available }}</span>
            <span class="stock-sep">·</span>
            <span class="stock-secondary">锁 {{ row.stock.locked }}</span>
            <span class="stock-sep">·</span>
            <span class="stock-secondary">售 {{ row.stock.sold }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status).type">{{ statusTag(row.status).text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="SeekAll" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.seekallTier" type="success" size="small">{{ row.seekallTier }}</el-tag>
            <span v-else class="text-tertiary">-</span>
          </template>
        </el-table-column>
        <el-table-column label="小城笺" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.xcjTier" type="warning" size="small">{{ row.xcjTier }}</el-tag>
            <span v-else class="text-tertiary">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column prop="createdAt" label="创建时间" width="170">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row as Product)">编辑</el-button>
            <el-button
              link
              :type="row.status === 'ONLINE' ? 'warning' : 'success'"
              size="small"
              @click="toggleStatus(row as Product)"
            >
              {{ row.status === 'ONLINE' ? '下架' : '上架' }}
            </el-button>
            <el-button link type="danger" size="small" @click="onDelete(row as Product)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        class="pagination"
        @current-change="fetchList"
      />
    </section>

    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '新建商品' : '编辑商品'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item v-if="dialogMode === 'create' && isSuperAdmin" label="所属店铺" prop="shopId">
          <el-select v-model="form.shopId" placeholder="选择店铺" style="width: 100%" filterable>
            <el-option
              v-for="shop in shops"
              :key="shop.id"
              :value="shop.id"
              :label="`${shop.merchant.name} / ${shop.name}`"
            >
              <div style="display: flex; justify-content: space-between; gap: 12px">
                <span>{{ shop.merchant.name }} / {{ shop.name }}</span>
                <span class="shop-code">/{{ shop.code }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="商品名" prop="name">
          <el-input v-model="form.name" maxlength="255" show-word-limit />
        </el-form-item>
        <el-form-item label="价格(元)" prop="price">
          <el-input-number v-model="form.price" :min="0.01" :max="99999.99" :precision="2" />
        </el-form-item>
        <el-form-item label="原价(元)">
          <el-input-number v-model="form.originalPrice" :min="0.01" :max="99999.99" :precision="2" placeholder="可选" />
        </el-form-item>
        <el-form-item label="单次限购">
          <el-input-number v-model="form.purchaseLimit" :min="1" :max="9999" placeholder="可选" />
        </el-form-item>
        <el-form-item label="自动发货">
          <el-switch v-model="form.isAutoDelivery" />
        </el-form-item>
        <el-form-item label="SeekAll 档位">
          <el-select v-model="form.seekallTier" placeholder="非 SeekAll 商品留空" clearable style="width: 100%">
            <el-option label="试用 (TRIAL)" value="TRIAL" />
            <el-option label="月度 (MONTHLY)" value="MONTHLY" />
            <el-option label="终身 (LIFETIME)" value="LIFETIME" />
          </el-select>
          <div class="form-item-tip">
            仅 SeekAll 会员卡商品需选择。付款成功后 WM 会自动通知 SeekAll 生成 License code, 买家凭 License code 在
            SeekAll SDK 激活。非 SeekAll 商品留空(不触发 webhook)。
          </div>
        </el-form-item>
        <el-form-item label="小城笺档位">
          <el-select
            v-model="form.xcjTier"
            placeholder="非小城笺商品留空"
            clearable
            filterable
            allow-create
            style="width: 100%"
          >
            <el-option label="试用 (TRIAL)" value="TRIAL" />
            <el-option label="月度 (MONTHLY)" value="MONTHLY" />
            <el-option label="终身 (LIFETIME)" value="LIFETIME" />
          </el-select>
          <div class="form-item-tip">
            仅小城笺(ADR 0076)会员商品需选择。付款成功后 WM 会自动通知小城笺生成会员权益。与 SeekAll 档位互斥。
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="99999" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="4" maxlength="65535" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: var(--wm-container-max);
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--wm-space-lg);
  margin-bottom: var(--wm-space-xl);
  flex-wrap: wrap;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--wm-text-primary);
  letter-spacing: -0.01em;
}

.page-desc {
  color: var(--wm-text-secondary);
  font-size: 13px;
  margin: 0;
}

.actions {
  display: flex;
  gap: var(--wm-space-sm);
}

.panel {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  padding: var(--wm-space-lg);
  box-shadow: var(--wm-shadow-sm);
}

.pagination {
  margin-top: var(--wm-space-lg);
  justify-content: flex-end;
  display: flex;
}

.amount {
  font-weight: 600;
  color: var(--wm-text-primary);
  font-variant-numeric: tabular-nums;
}

.low-stock {
  color: var(--wm-accent-danger);
  font-weight: 600;
}

.stock-sep {
  margin: 0 4px;
  color: var(--wm-text-tertiary);
}

.stock-secondary {
  color: var(--wm-text-tertiary);
  font-size: 13px;
}

.text-tertiary {
  color: var(--wm-text-tertiary);
}

.shop-code {
  color: var(--wm-text-tertiary);
  font-size: 12px;
}

.form-item-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--wm-text-secondary);
  line-height: 1.5;
}
</style>
