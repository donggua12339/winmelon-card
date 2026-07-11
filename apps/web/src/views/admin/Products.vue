<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { get, post, put, del } from '@/api/http';

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
  createdAt: string;
  stock: ProductStock;
}

interface ProductList {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_SHOP_ID = 'main'; // MVP：先硬编码 main 店铺，后续从店铺选择器取

const loading = ref(false);
const list = ref<Product[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');

const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const formRef = ref<FormInstance>();
const submitting = ref(false);
const form = reactive({
  id: '',
  name: '',
  description: '',
  price: 0,
  originalPrice: undefined as number | undefined,
  purchaseLimit: undefined as number | undefined,
  isAutoDelivery: true,
  sort: 0,
});

const rules: FormRules<typeof form> = {
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

function openCreate(): void {
  dialogMode.value = 'create';
  Object.assign(form, {
    id: '',
    name: '',
    description: '',
    price: 0,
    originalPrice: undefined,
    purchaseLimit: undefined,
    isAutoDelivery: true,
    sort: 0,
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
    };
    if (dialogMode.value === 'create') {
      await post('/admin/products', { ...payload, shopId: DEFAULT_SHOP_ID });
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

onMounted(fetchList);
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>商品管理</h2>
      <div class="actions">
        <el-input
          v-model="keyword"
          placeholder="搜索商品名"
          clearable
          style="width: 200px"
          @clear="fetchList"
          @keyup.enter="fetchList"
        />
        <el-button @click="fetchList">刷新</el-button>
        <el-button type="primary" @click="openCreate">+ 新建商品</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <el-table-column prop="name" label="商品名" min-width="180" />
      <el-table-column prop="price" label="价格(元)" width="100">
        <template #default="{ row }">¥{{ row.price }}</template>
      </el-table-column>
      <el-table-column label="库存" width="140">
        <template #default="{ row }">
          <span :class="{ 'low-stock': row.stock.available === 0 }"> 可用 {{ row.stock.available }} </span>
          / 锁 {{ row.stock.locked }} / 售 {{ row.stock.sold }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status).type">{{ statusTag(row.status).text }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sort" label="排序" width="80" />
      <el-table-column prop="createdAt" label="创建时间" width="170">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button
            link
            :type="row.status === 'ONLINE' ? 'warning' : 'success'"
            size="small"
            @click="toggleStatus(row)"
          >
            {{ row.status === 'ONLINE' ? '下架' : '上架' }}
          </el-button>
          <el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      layout="total, prev, pager, next"
      style="margin-top: 16px"
      @current-change="fetchList"
    />

    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '新建商品' : '编辑商品'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
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
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.actions {
  display: flex;
  gap: 8px;
}
.low-stock {
  color: #f56c6c;
  font-weight: bold;
}
</style>
