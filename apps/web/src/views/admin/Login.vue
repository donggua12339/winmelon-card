<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { FormInstance, FormRules } from 'element-plus';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({
  username: '',
  password: '',
});

const rules: FormRules<typeof form> = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 64, message: '用户名长度 3-64', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (!value) return callback(new Error('请输入密码'));
        if (value.length < 8) return callback(new Error('密码至少 8 位'));
        if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
          return callback(new Error('密码必须包含字母和数字'));
        }
        callback();
      },
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
    await auth.login(form.username, form.password);
    const redirect = (route.query.redirect as string) || '/admin/dashboard';
    router.replace(redirect);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login">
    <el-card>
      <h2>管理员登录</h2>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" @submit.prevent="onSubmit">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="用户名" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            show-password
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="onSubmit">登录</el-button>
          <RouterLink to="/" class="back">← 返回首页</RouterLink>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login {
  padding: 60px 16px;
  max-width: 480px;
  margin: 0 auto;
}
.back {
  margin-left: 12px;
  color: #606266;
  text-decoration: none;
}
</style>
