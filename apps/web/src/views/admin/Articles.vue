<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post, put, del } from '@/api/http';

interface Article {
  id: string;
  type: string;
  title: string;
  slug?: string | null;
  summary?: string | null;
  status: string;
  sort: number;
  publishedAt?: string | null;
  createdAt: string;
}
interface ArticleDetail extends Article {
  content: string;
}

const TYPE_LABELS: Record<string, string> = {
  ANNOUNCEMENT: '平台公告',
  AGREEMENT: '用户协议',
  DISCLAIMER: '免责声明',
  ALLOWED_GOODS: '可销售商品',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  ARCHIVED: '已归档',
};
const STATUS_TYPES: Record<string, 'info' | 'success' | 'warning'> = {
  DRAFT: 'info',
  PUBLISHED: 'success',
  ARCHIVED: 'warning',
};

const list = ref<Article[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const dialogVisible = ref(false);
const editing = ref<ArticleDetail | null>(null);
const form = ref({
  id: '',
  type: 'ANNOUNCEMENT' as string,
  title: '',
  content: '',
  slug: '',
  summary: '',
  status: 'DRAFT' as string,
  sort: 0,
});

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const res = await get<{ items: Article[]; total: number }>('/admin/articles', {
      params: { page: page.value, pageSize: pageSize.value },
    });
    list.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editing.value = null;
  form.value = {
    id: '',
    type: 'ANNOUNCEMENT',
    title: '',
    content: '',
    slug: '',
    summary: '',
    status: 'DRAFT',
    sort: 0,
  };
  dialogVisible.value = true;
}

async function openEdit(row: Article): Promise<void> {
  try {
    const detail = await get<ArticleDetail>(`/admin/articles/${row.id}`);
    editing.value = detail;
    form.value = {
      id: detail.id,
      type: detail.type,
      title: detail.title,
      content: detail.content,
      slug: detail.slug ?? '',
      summary: detail.summary ?? '',
      status: detail.status,
      sort: detail.sort,
    };
    dialogVisible.value = true;
  } catch {
    /* http 层已提示 */
  }
}

async function save(): Promise<void> {
  if (!form.value.title.trim() || !form.value.content.trim()) {
    ElMessage.warning('标题和内容不能为空');
    return;
  }
  try {
    const payload = {
      type: form.value.type,
      title: form.value.title,
      content: form.value.content,
      slug: form.value.slug || undefined,
      summary: form.value.summary || undefined,
      status: form.value.status,
      sort: form.value.sort,
    };
    if (editing.value) {
      await put(`/admin/articles/${editing.value.id}`, payload);
      ElMessage.success('已保存');
    } else {
      await post('/admin/articles', payload);
      ElMessage.success('已创建');
    }
    dialogVisible.value = false;
    fetchList();
  } catch {
    /* http 层已提示 */
  }
}

async function remove(row: Article): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认归档「${row.title}」？归档后买家不可见`, '确认', {
      type: 'warning',
    });
    await del(`/admin/articles/${row.id}`);
    ElMessage.success('已归档');
    fetchList();
  } catch {
    /* 取消 */
  }
}

onMounted(fetchList);
</script>

<template>
  <div class="articles-page">
    <div class="page-header">
      <h2>文章公告</h2>
      <el-button type="primary" @click="openCreate">+ 新建</el-button>
    </div>

    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="title" label="标题" min-width="200" />
      <el-table-column label="类型" width="120">
        <template #default="{ row }">{{ TYPE_LABELS[row.type] ?? row.type }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="STATUS_TYPES[row.status] ?? 'info'" size="small">
            {{ STATUS_LABELS[row.status] ?? row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="slug" label="slug" width="140" />
      <el-table-column prop="sort" label="排序" width="80" />
      <el-table-column label="发布时间" width="170">
        <template #default="{ row }">
          {{ row.publishedAt ? new Date(row.publishedAt).toLocaleString('zh-CN') : '—' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">归档</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="total > pageSize"
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="prev, pager, next"
      style="margin-top: 16px"
      @current-change="fetchList"
    />

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑' : '新建'" width="800px" top="5vh">
      <el-form label-width="80px">
        <el-form-item label="类型">
          <el-select v-model="form.type" style="width: 100%">
            <el-option v-for="(label, key) in TYPE_LABELS" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="form.title" maxlength="255" show-word-limit />
        </el-form-item>
        <el-form-item label="slug">
          <el-input v-model="form.slug" placeholder="留空则不生成短链，如 user-agreement" />
        </el-form-item>
        <el-form-item label="摘要">
          <el-input v-model="form.summary" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="12" placeholder="支持纯文本/HTML" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="DRAFT">草稿</el-radio>
            <el-radio value="PUBLISHED">发布</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.articles-page {
  padding: 16px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-header h2 {
  margin: 0;
  font-size: 18px;
}
</style>
