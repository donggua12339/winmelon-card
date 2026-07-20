<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { get, post } from '@/api/http';

const router = useRouter();

// 图形验证码
const captchaId = ref('');
const captchaImg = ref('');
const captchaInput = ref('');

// 步骤控制：1 = 发码  2 = 重置
const step = ref(1);
const sendingCode = ref(false);
const cooldown = ref(0);
const submitting = ref(false);

const formRef = ref<FormInstance>();
const form = reactive({
  email: '',
  emailCode: '',
  newPassword: '',
  confirmPassword: '',
});

const rules: FormRules<typeof form> = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  emailCode: [
    { required: true, message: '请输入邮箱验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码为 6 位数字', trigger: 'blur' },
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    {
      validator: (_r, v: string, cb) => {
        if (!v || v.length < 8) return cb(new Error('密码至少 8 位'));
        if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) {
          return cb(new Error('密码必须包含字母和数字'));
        }
        cb();
      },
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_r, v: string, cb) => (v === form.newPassword ? cb() : cb(new Error('两次密码不一致'))),
      trigger: 'blur',
    },
  ],
};

const sendBtnText = computed(() => {
  if (sendingCode.value) return '发送中...';
  if (cooldown.value > 0) return `${cooldown.value}s 后重发`;
  return '发送验证码';
});
const sendBtnDisabled = computed(() => sendingCode.value || cooldown.value > 0);

async function refreshCaptcha(): Promise<void> {
  const data = await get<{ id: string; image: string }>('/auth/captcha');
  captchaId.value = data.id;
  captchaImg.value = data.image;
  captchaInput.value = '';
}

async function onSendCode(): Promise<void> {
  if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    ElMessage.warning('请先输入有效的邮箱');
    return;
  }
  if (!captchaInput.value || !/^\d{4}$/.test(captchaInput.value)) {
    ElMessage.warning('请输入 4 位图形验证码');
    return;
  }
  sendingCode.value = true;
  try {
    await post('/auth/forgot-password/send-code', {
      email: form.email.trim().toLowerCase(),
    });
    ElMessage.success('验证码已发送到您的邮箱（10 分钟内有效）');
    cooldown.value = 60;
    const timer = setInterval(() => {
      cooldown.value -= 1;
      if (cooldown.value <= 0) clearInterval(timer);
    }, 1000);
    // 进入步骤 2
    step.value = 2;
  } catch {
    /* http 层已处理（统一文案，不泄露邮箱是否存在） */
    refreshCaptcha();
  } finally {
    sendingCode.value = false;
  }
}

async function onSubmit(): Promise<void> {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    await post('/auth/forgot-password/reset', {
      email: form.email.trim().toLowerCase(),
      code: form.emailCode,
      newPassword: form.newPassword,
      captchaId: captchaId.value,
      captchaCode: captchaInput.value,
    });
    ElMessage.success('密码已重置，请用新密码登录');
    setTimeout(() => router.replace('/admin/login'), 1500);
  } catch {
    /* 错误展示在表单上 */
    refreshCaptcha();
  } finally {
    submitting.value = false;
  }
}

function goBack(): void {
  if (step.value === 2) {
    step.value = 1;
  } else {
    router.replace('/admin/login');
  }
}

onMounted(refreshCaptcha);
</script>

<template>
  <div class="forgot-page">
    <div class="glass forgot-card">
      <RouterLink to="/admin/login" class="back">← 返回登录</RouterLink>

      <div class="brand">
        <div class="brand-icon">🔑</div>
        <h1 class="brand-title"><span class="text-gradient-aurora">WM</span> Card</h1>
        <p class="brand-subtitle">忘记密码</p>
        <p class="brand-hint">
          {{ step === 1 ? '输入注册邮箱，我们会发送验证码' : '请输入邮件中的验证码并设置新密码' }}
        </p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <!-- 步骤 1：邮箱 + 图形验证码 -->
        <template v-if="step === 1">
          <el-form-item label="邮箱" prop="email">
            <el-input
              v-model="form.email"
              placeholder="请输入注册时的邮箱"
              size="large"
              type="email"
              autocomplete="email"
            />
          </el-form-item>
          <el-form-item label="图形验证码">
            <div class="captcha-row">
              <el-input v-model="captchaInput" placeholder="4 位字符" maxlength="4" size="large" />
              <img
                v-if="captchaImg"
                :src="captchaImg"
                class="captcha-img"
                data-testid="captcha"
                alt="captcha"
                @click="refreshCaptcha"
              />
            </div>
            <div class="tip">点击图片可刷新</div>
          </el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="sendingCode"
            :disabled="sendBtnDisabled"
            class="submit-btn"
            @click="onSendCode"
          >
            {{ sendBtnText }}
          </el-button>
        </template>

        <!-- 步骤 2：邮箱验证码 + 新密码 + 确认密码 -->
        <template v-else>
          <el-form-item label="邮箱验证码" prop="emailCode">
            <el-input v-model="form.emailCode" placeholder="邮件中的 6 位数字" maxlength="6" size="large" />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input
              v-model="form.newPassword"
              type="password"
              placeholder="至少 8 位，含字母和数字"
              size="large"
              show-password
              autocomplete="new-password"
            />
          </el-form-item>
          <el-form-item label="确认新密码" prop="confirmPassword">
            <el-input
              v-model="form.confirmPassword"
              type="password"
              placeholder="再次输入新密码"
              size="large"
              show-password
              autocomplete="new-password"
            />
          </el-form-item>
          <el-form-item label="图形验证码（再次提交）">
            <div class="captcha-row">
              <el-input v-model="captchaInput" placeholder="4 位字符" maxlength="4" size="large" />
              <img
                v-if="captchaImg"
                :src="captchaImg"
                class="captcha-img"
                data-testid="captcha"
                alt="captcha"
                @click="refreshCaptcha"
              />
            </div>
          </el-form-item>
          <el-button type="primary" size="large" :loading="submitting" class="submit-btn" @click="onSubmit">
            重置密码并登录
          </el-button>
          <el-button link class="back-step" @click="goBack">← 返回上一步</el-button>
        </template>
      </el-form>

      <el-alert type="info" :closable="false" class="tip-alert">
        <template #title> 安全提示 </template>
        验证码 10 分钟内有效。连续输错 5 次将锁定 1 小时，重置成功后我们会发邮件通知您。
      </el-alert>
    </div>
  </div>
</template>

<style scoped>
.forgot-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.forgot-card {
  width: 100%;
  max-width: 480px;
  padding: 32px;
  animation: fade-in-up 0.6s ease-out;
  position: relative;
}

.back {
  position: absolute;
  top: 16px;
  left: 16px;
  color: var(--wm-text-tertiary);
  text-decoration: none;
  font-size: 13px;
}

.back:hover {
  color: var(--wm-accent-cyan);
}

.brand {
  text-align: center;
  margin: 24px 0 32px;
}

.brand-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.brand-title {
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 4px;
}

.brand-subtitle {
  color: var(--wm-text-tertiary);
  font-size: 13px;
  margin: 0;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.brand-hint {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--wm-text-secondary);
}

.captcha-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.captcha-row :deep(.el-input) {
  flex: 1;
}

.captcha-img {
  height: 40px;
  width: 120px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  cursor: pointer;
  user-select: none;
}

.captcha-img:hover {
  border-color: var(--el-color-primary);
}

.submit-btn {
  width: 100%;
  height: 48px;
  font-size: 15px;
  font-weight: 600;
  margin-top: 8px;
}

.back-step {
  margin-top: 12px;
  display: block;
  margin-left: auto;
  margin-right: auto;
}

.tip {
  color: var(--wm-text-tertiary);
  font-size: 12px;
  margin-top: 4px;
}

.tip-alert {
  margin-top: 24px;
  text-align: left;
}
</style>
