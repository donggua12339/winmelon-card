<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { post } from '@/api/http';

const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const sendingCode = ref(false);
const countdown = ref(0);
const created = ref<{ username: string; initialPassword: string } | null>(null);

const form = reactive({
  contactEmail: '',
  verificationCode: '',
  merchantName: '',
  shopName: '',
  shopCode: '',
  businessScope: '',
});

const rules: FormRules<typeof form> = {
  contactEmail: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  verificationCode: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码为 6 位数字', trigger: 'blur' },
  ],
  merchantName: [{ required: true, message: '请输入商户名称', trigger: 'blur' }],
  shopName: [{ required: true, message: '请输入店铺名称', trigger: 'blur' }],
  shopCode: [
    { required: true, message: '请输入店铺码', trigger: 'blur' },
    {
      pattern: /^[a-z0-9-]{3,32}$/,
      message: '只能小写字母、数字、短横线，3-32 位',
      trigger: 'blur',
    },
  ],
};

const codeBtnText = computed(() => {
  if (sendingCode.value) return '发送中...';
  if (countdown.value > 0) return `${countdown.value}s 后重发`;
  return '发送验证码';
});
const codeBtnDisabled = computed(() => sendingCode.value || countdown.value > 0);

async function sendCode(): Promise<void> {
  if (!form.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
    ElMessage.warning('请先输入有效的邮箱');
    return;
  }
  sendingCode.value = true;
  try {
    await post('/merchant/apply/send-code', { email: form.contactEmail });
    ElMessage.success('验证码已发送到您的邮箱（10 分钟内有效）');
    countdown.value = 60;
    const timer = setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0) clearInterval(timer);
    }, 1000);
  } finally {
    sendingCode.value = false;
  }
}

async function onSubmit(): Promise<void> {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const data = await post<{ username: string; initialPassword: string }>('/merchant/apply', form);
    created.value = {
      username: data.username,
      initialPassword: data.initialPassword,
    };
  } finally {
    loading.value = false;
  }
}

function copy(text: string, label: string): void {
  navigator.clipboard.writeText(text).then(() => ElMessage.success(`${label}已复制`));
}

function gotoLogin(): void {
  router.push({ name: 'admin-login' });
}
</script>

<template>
  <div class="apply-page">
    <div class="glass apply-card">
      <RouterLink to="/" class="back">← 返回首页</RouterLink>

      <!-- 注册成功 -->
      <div v-if="created" class="success-view">
        <div class="success-icon">✓</div>
        <h2 class="success-title">账号已开通</h2>
        <p class="success-subtitle">请妥善保管以下登录凭证</p>
        <div class="credential-box">
          <div class="credential-row">
            <span class="label">用户名</span>
            <code>{{ created.username }}</code>
            <el-button size="small" link @click="copy(created.username, '用户名')">复制</el-button>
          </div>
          <div class="credential-row">
            <span class="label">初始密码</span>
            <code>{{ created.initialPassword }}</code>
            <el-button size="small" link @click="copy(created.initialPassword, '密码')">复制</el-button>
          </div>
        </div>
        <el-alert type="warning" :closable="false" class="warn-alert"> 密码仅显示一次，忘记需在后台重置。 </el-alert>
        <el-button type="primary" size="large" class="submit-btn" @click="gotoLogin"> 立即登录后台 → </el-button>
      </div>

      <!-- 注册表单 -->
      <div v-else>
        <div class="header">
          <h1 class="title"><span class="text-gradient-aurora">商户入驻</span></h1>
          <p class="subtitle">邮箱验证后立即开通，无需等待审核</p>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="onSubmit">
          <h3 class="section-title">商户与店铺</h3>
          <el-form-item label="联系邮箱" prop="contactEmail">
            <el-input v-model="form.contactEmail" placeholder="用于接收验证码和登录" />
          </el-form-item>
          <el-form-item label="邮箱验证码" prop="verificationCode">
            <div class="code-row">
              <el-input v-model="form.verificationCode" placeholder="6 位数字" maxlength="6" />
              <el-button type="primary" plain :loading="sendingCode" :disabled="codeBtnDisabled" @click="sendCode">
                {{ codeBtnText }}
              </el-button>
            </div>
          </el-form-item>
          <el-form-item label="商户名称" prop="merchantName">
            <el-input v-model="form.merchantName" placeholder="如：XX 数码" />
          </el-form-item>
          <el-form-item label="店铺名称" prop="shopName">
            <el-input v-model="form.shopName" placeholder="买家看到的店铺名" />
          </el-form-item>
          <el-form-item label="店铺码" prop="shopCode">
            <el-input v-model="form.shopCode" placeholder="如 myshop，访问 /shop/myshop" />
            <div class="tip">只能小写字母、数字、短横线，3-32 位</div>
          </el-form-item>
          <el-form-item label="经营范围（可选）" prop="businessScope">
            <el-input v-model="form.businessScope" type="textarea" :rows="3" placeholder="简述您要销售的商品类型" />
          </el-form-item>

          <el-button type="primary" size="large" :loading="loading" native-type="submit" class="submit-btn">
            提交并开通账号
          </el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.apply-page {
  min-height: 100vh;
  padding: 32px 16px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.apply-card {
  width: 100%;
  max-width: 560px;
  padding: 32px;
  animation: fade-in-up 0.6s ease-out;
}

.back {
  display: inline-block;
  color: var(--wm-text-tertiary);
  text-decoration: none;
  font-size: 13px;
  margin-bottom: 16px;
}

.header {
  text-align: center;
  margin-bottom: 24px;
}

.title {
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 8px;
}

.subtitle {
  color: var(--wm-text-secondary);
  font-size: 13px;
  margin: 0;
}

.section-title {
  font-size: 14px;
  color: var(--wm-text-secondary);
  margin: 16px 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.tip {
  color: var(--wm-text-tertiary);
  font-size: 12px;
  margin-top: 4px;
}

.submit-btn {
  width: 100%;
  margin-top: 16px;
}

.code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.code-row :deep(.el-input) {
  flex: 1;
}

/* 成功视图 */
.success-view {
  text-align: center;
  padding: 16px 0;
}

.success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--wm-gradient-primary);
  color: white;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.success-title {
  font-size: 24px;
  font-weight: 800;
  margin: 0 0 8px;
  background: var(--wm-gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.success-subtitle {
  color: var(--wm-text-secondary);
  font-size: 14px;
  margin: 0 0 24px;
}

.credential-box {
  background: var(--wm-glass-bg);
  border: 1px solid var(--wm-border-glass);
  border-radius: var(--wm-radius-md);
  padding: 16px;
  margin-bottom: 16px;
  text-align: left;
}

.credential-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.credential-row + .credential-row {
  border-top: 1px solid var(--wm-border-glass);
}

.credential-row .label {
  width: 70px;
  color: var(--wm-text-tertiary);
  font-size: 13px;
}

.credential-row code {
  flex: 1;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: var(--wm-accent-cyan);
  word-break: break-all;
}

.warn-alert {
  margin: 8px 0 16px;
  text-align: left;
}
</style>
