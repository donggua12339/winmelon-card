<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post, del } from '@/api/http';
import type { UploadRawFile } from 'element-plus';

interface Product {
  id: string;
  name: string;
  status: string;
  stock: { available: number; locked: number; sold: number };
}
interface StockItem {
  id: string;
  productId: string;
  status: 'AVAILABLE' | 'LOCKED' | 'SOLD' | 'DISABLED';
  contentPreview: string;
  orderId: string | null;
  importedAt: string;
  soldAt: string | null;
}
interface StockList {
  items: StockItem[];
  total: number;
  page: number;
  pageSize: number;
}
interface StockStats {
  available: number;
  locked: number;
  sold: number;
  disabled: number;
  total: number;
}
interface ImportResult {
  imported: number;
  duplicated: number;
  failed: number;
  errors: string[];
}

const products = ref<Product[]>([]);
const selectedProductId = ref('');
const loading = ref(false);
const list = ref<StockItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(50);
const stats = ref<StockStats | null>(null);

const importDialogVisible = ref(false);
const importCsvText = ref('');
const importFile = ref<File | null>(null);
const importing = ref(false);
const importResult = ref<ImportResult | null>(null);

const revealDialogVisible = ref(false);
const revealContent = ref('');
const revealing = ref(false);

async function fetchProducts(): Promise<void> {
  const data = await get<{ items: Product[] }>('/admin/products', { params: { pageSize: 100 } });
  products.value = data.items;
  if (products.value.length && !selectedProductId.value) {
    selectedProductId.value = products.value[0]!.id;
  }
}

async function fetchList(): Promise<void> {
  if (!selectedProductId.value) return;
  loading.value = true;
  try {
    const data = await get<StockList>('/admin/stock', {
      params: { productId: selectedProductId.value, page: page.value, pageSize: pageSize.value },
    });
    list.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function fetchStats(): Promise<void> {
  if (!selectedProductId.value) return;
  stats.value = await get<StockStats>('/admin/stock/stats', {
    params: { productId: selectedProductId.value },
  });
}

watch(selectedProductId, () => {
  page.value = 1;
  fetchList();
  fetchStats();
});

function openImport(): void {
  importCsvText.value = '';
  importFile.value = null;
  importResult.value = null;
  importDialogVisible.value = true;
}

function onFileChange(file: UploadRawFile): void {
  // 阻止 el-upload 自动上传，仅读取文件内容
  importFile.value = file as unknown as File;
  const reader = new FileReader();
  reader.onload = (e) => {
    importCsvText.value = String(e.target?.result ?? '');
  };
  reader.readAsText(file as unknown as File);
}

async function onImport(): Promise<void> {
  if (!selectedProductId.value) return;
  if (!importCsvText.value.trim()) {
    ElMessage.warning('请粘贴 CSV 内容或上传文件');
    return;
  }
  importing.value = true;
  try {
    const result = await post<ImportResult>('/admin/stock/import', {
      productId: selectedProductId.value,
      csvContent: importCsvText.value,
    });
    importResult.value = result;
    ElMessage.success(`导入完成：成功 ${result.imported} 条`);
    fetchList();
    fetchStats();
  } finally {
    importing.value = false;
  }
}

async function onReveal(row: StockItem): Promise<void> {
  await ElMessageBox.confirm('查看卡密明文会被审计记录，确定继续？', '安全提示', {
    type: 'warning',
  });
  revealing.value = true;
  try {
    const { content } = await post<{ content: string; status: string }>(`/admin/stock/${row.id}/reveal`);
    revealContent.value = content;
    revealDialogVisible.value = true;
  } finally {
    revealing.value = false;
  }
}

async function onDelete(row: StockItem): Promise<void> {
  await ElMessageBox.confirm('确定删除该卡密？此操作不可恢复。', '危险操作', {
    type: 'error',
    confirmButtonText: '删除',
    confirmButtonClass: 'el-button--danger',
  });
  await del(`/admin/stock/${row.id}`);
  ElMessage.success('已删除');
  fetchList();
  fetchStats();
}

function statusTag(s: StockItem['status']): { type: 'success' | 'warning' | 'info' | 'danger'; text: string } {
  const map: Record<StockItem['status'], { type: 'success' | 'warning' | 'info' | 'danger'; text: string }> = {
    AVAILABLE: { type: 'success', text: '可用' },
    LOCKED: { type: 'warning', text: '锁定' },
    SOLD: { type: 'info', text: '已售' },
    DISABLED: { type: 'danger', text: '已禁用' },
  };
  return map[s];
}

async function copyContent(): Promise<void> {
  await navigator.clipboard.writeText(revealContent.value);
  ElMessage.success('已复制到剪贴板');
}

onMounted(fetchProducts);
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>卡密管理</h2>
      <div class="actions">
        <el-select v-model="selectedProductId" placeholder="选择商品" style="width: 240px" filterable>
          <el-option v-for="p in products" :key="p.id" :label="`${p.name} (可用 ${p.stock.available})`" :value="p.id" />
        </el-select>
        <el-button :disabled="!selectedProductId" @click="fetchList">刷新</el-button>
        <el-button type="primary" :disabled="!selectedProductId" @click="openImport"> 批量导入 </el-button>
      </div>
    </div>

    <div v-if="stats" class="stats">
      <el-card shadow="hover">
        <div class="stat-label">可用</div>
        <div class="stat-value success">{{ stats.available }}</div>
      </el-card>
      <el-card shadow="hover">
        <div class="stat-label">锁定</div>
        <div class="stat-value warning">{{ stats.locked }}</div>
      </el-card>
      <el-card shadow="hover">
        <div class="stat-label">已售</div>
        <div class="stat-value info">{{ stats.sold }}</div>
      </el-card>
      <el-card shadow="hover">
        <div class="stat-label">已禁用</div>
        <div class="stat-value danger">{{ stats.disabled }}</div>
      </el-card>
      <el-card shadow="hover">
        <div class="stat-label">合计</div>
        <div class="stat-value">{{ stats.total }}</div>
      </el-card>
    </div>

    <el-table v-loading="loading" :data="list" border style="margin-top: 16px">
      <el-table-column prop="contentPreview" label="卡密指纹" min-width="180" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status).type">{{ statusTag(row.status).text }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="orderId" label="订单" min-width="180">
        <template #default="{ row }">{{ row.orderId ?? '-' }}</template>
      </el-table-column>
      <el-table-column prop="importedAt" label="导入时间" width="170">
        <template #default="{ row }">{{ new Date(row.importedAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column prop="soldAt" label="售出时间" width="170">
        <template #default="{ row }">{{ row.soldAt ? new Date(row.soldAt).toLocaleString() : '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            size="small"
            :disabled="row.status === 'SOLD'"
            :loading="revealing"
            @click="onReveal(row as StockItem)"
          >
            查看明文
          </el-button>
          <el-button
            link
            type="danger"
            size="small"
            :disabled="row.status === 'SOLD' || row.status === 'LOCKED'"
            @click="onDelete(row as StockItem)"
          >
            删除
          </el-button>
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

    <!-- 导入弹窗 -->
    <el-dialog v-model="importDialogVisible" title="批量导入卡密" width="640px">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="每行一条卡密，支持双引号包裹；单次最多 5000 条，单条最长 4096 字符"
        style="margin-bottom: 12px"
      />
      <el-upload :auto-upload="false" :show-file-list="false" accept=".csv,.txt" :on-change="onFileChange">
        <el-button>从文件读取</el-button>
        <template #tip>
          <span v-if="importFile" style="margin-left: 8px">{{ importFile.name }}</span>
        </template>
      </el-upload>
      <el-input
        v-model="importCsvText"
        type="textarea"
        :rows="10"
        placeholder="或直接粘贴 CSV 内容"
        style="margin-top: 12px"
      />
      <div v-if="importResult" style="margin-top: 12px">
        <el-alert
          :type="importResult.failed > 0 ? 'warning' : 'success'"
          :closable="false"
          show-icon
          :title="`成功 ${importResult.imported} 条，重复 ${importResult.duplicated} 条，失败 ${importResult.failed} 条`"
        />
        <div v-if="importResult.errors.length" style="margin-top: 8px; color: #f56c6c; font-size: 12px">
          <div v-for="(err, i) in importResult.errors" :key="i">{{ err }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importing" @click="onImport">开始导入</el-button>
      </template>
    </el-dialog>

    <!-- 查看明文弹窗 -->
    <el-dialog v-model="revealDialogVisible" title="卡密明文" width="560px">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="本次查看已写入审计日志，请勿泄露"
        style="margin-bottom: 12px"
      />
      <el-input v-model="revealContent" type="textarea" :rows="6" readonly />
      <template #footer>
        <el-button @click="copyContent">复制</el-button>
        <el-button type="primary" @click="revealDialogVisible = false">关闭</el-button>
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
.stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.stat-label {
  color: #909399;
  font-size: 13px;
}
.stat-value {
  font-size: 24px;
  font-weight: bold;
  margin-top: 4px;
}
.stat-value.success {
  color: #67c23a;
}
.stat-value.warning {
  color: #e6a23c;
}
.stat-value.info {
  color: #909399;
}
.stat-value.danger {
  color: #f56c6c;
}
</style>
