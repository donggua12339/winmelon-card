<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { post } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirm: '',
});

const rules: FormRules<typeof form> = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, message: '至少 8 位', trigger: 'blur' },
    {
      validator: (_r, v: string, cb) => (v && v !== form.oldPassword ? cb() : cb(new Error('新密码不能与原密码相同'))),
      trigger: 'blur',
    },
  ],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_r, v: string, cb) => (v === form.newPassword ? cb() : cb(new Error('两次密码不一致'))),
      trigger: 'blur',
    },
  ],
};

async function onSubmit(): Promise<void> {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    await post('/auth/change-password', {
      oldPassword: form.oldPassword,
      newPassword: form.newPassword,
    });
    ElMessage.success('密码修改成功，请重新登录');
    setTimeout(() => auth.logout(), 1500);
  } finally {
    loading.value = false;
  }
}

function goBack(): void {
  router.back();
}
</script>

<template>
  <div class="admin-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">修改密码</h2>
        <p class="page-desc">修改后需重新登录</p>
      </div>
    </header>

    <section class="panel">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="form" @submit.prevent="onSubmit">
        <el-form-item label="登录账号">
          <el-input :model-value="auth.user?.username" disabled />
        </el-form-item>
        <el-form-item label="原密码" prop="oldPassword">
          <el-input v-model="form.oldPassword" type="password" show-password autocomplete="current-password" />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="form.newPassword" type="password" show-password autocomplete="new-password" />
          <div class="tip">至少 8 位，必须与原密码不同</div>
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirm">
          <el-input
            v-model="form.confirm"
            type="password"
            show-password
            autocomplete="new-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="onSubmit">保存</el-button>
          <el-button @click="goBack">返回</el-button>
        </el-form-item>
      </el-form>
      <el-alert type="warning" :closable="false" show-icon class="alert">
        <template #title>密码修改后需要重新登录</template>
      </el-alert>
    </section>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 600px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--wm-space-xl);
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

.panel {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  padding: var(--wm-space-xl);
  box-shadow: var(--wm-shadow-sm);
}

.form {
  max-width: 480px;
}

.tip {
  font-size: 12px;
  color: var(--wm-text-tertiary);
  margin-top: var(--wm-space-2xs);
}

.alert {
  margin-top: var(--wm-space-lg);
}
</style>
