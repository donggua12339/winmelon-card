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
// P2-8: 后端改为发激活链接,不再返回明文密码
const submitted = ref<{ email: string } | null>(null);

const form = reactive({
  contactEmail: '',
  verificationCode: '',
  merchantName: '',
  shopName: '',
  shopCode: '',
  businessScope: '',
  inviteCode: '',
  agreement: false,
});

const agreementUrl = 'https://github.com/donggua12339/winmelon-card/blob/main/docs/MERCHANT-SERVICE-AGREEMENT.md';
const distributionAgreementUrl =
  'https://github.com/donggua12339/winmelon-card/blob/main/docs/MERCHANT-DISTRIBUTION-AGREEMENT.md';

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
  agreement: [
    {
      validator: (_r, v: boolean, cb) => (v ? cb() : cb(new Error('请阅读并同意商户协议'))),
      trigger: 'change',
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
    ElMessage.info({
      message: '如果 5 分钟内没收到邮件,请检查垃圾邮件箱,或联系客服微信 donggua16600 手动激活',
      duration: 8000,
    });
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
    await post('/merchant/apply', form);
    submitted.value = { email: form.contactEmail };
  } finally {
    loading.value = false;
  }
}

function gotoLogin(): void {
  router.push({ name: 'admin-login' });
}
</script>

<template>
  <div class="apply-page">
    <div class="glass apply-card">
      <RouterLink to="/" class="back">← 返回首页</RouterLink>

      <!-- 提交成功(等用户去邮箱激活) -->
      <div v-if="submitted" class="success-view">
        <div class="success-icon">✉</div>
        <h2 class="success-title">激活邮件已发送</h2>
        <p class="success-subtitle">我们已向 {{ submitted.email }} 发送激活链接</p>
        <el-alert type="warning" :closable="false" class="warn-alert" show-icon>
          <template #title>
            <strong>请检查邮箱并在 30 分钟内点击激活链接设置密码</strong>
          </template>
          <div style="margin-top: 8px; line-height: 1.6">
            如果 5 分钟内没收到邮件:
            <ol style="margin: 6px 0 0 18px; padding: 0">
              <li>检查垃圾邮件箱 / 订阅邮件文件夹</li>
              <li>确认邮箱地址拼写正确</li>
              <li>Gmail / Outlook 用户可能延迟 1-2 分钟</li>
              <li>仍收不到?联系客服微信 <code>donggua16600</code> 手动激活</li>
            </ol>
          </div>
        </el-alert>
        <el-button type="primary" size="large" class="submit-btn" @click="gotoLogin"> 激活完成后去登录 </el-button>
      </div>

      <!-- 注册表单 -->
      <div v-else>
        <div class="header">
          <h1 class="title"><span class="text-gradient-aurora">商户入驻</span></h1>
          <p class="subtitle">邮箱验证后立即提交申请,激活邮件设置密码</p>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="onSubmit">
          <h3 class="section-title">商户与店铺</h3>
          <el-form-item label="联系邮箱" prop="contactEmail">
            <el-input v-model="form.contactEmail" placeholder="用于接收验证码和激活邮件" />
          </el-form-item>
          <el-form-item label="邮箱验证码" prop="verificationCode">
            <div class="code-row">
              <el-input v-model="form.verificationCode" placeholder="6 位数字" maxlength="6" />
              <el-button type="primary" plain :loading="sendingCode" :disabled="codeBtnDisabled" @click="sendCode">
                {{ codeBtnText }}
              </el-button>
            </div>
            <div class="tip">未收到验证码?检查垃圾邮件箱,或联系客服微信 donggua16600</div>
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
          <el-form-item label="邀请码（可选）" prop="inviteCode">
            <el-input v-model="form.inviteCode" placeholder="如有邀请人，填写其邀请码" maxlength="32" />
            <div class="tip">填写后将与邀请人建立多级分销关系，邀请人可获得返佣</div>
          </el-form-item>

          <el-form-item label="商户协议" prop="agreement">
            <el-checkbox v-model="form.agreement">
              我已阅读并同意
              <a :href="agreementUrl" target="_blank" rel="noopener">《WM 发卡网商户服务协议》</a>
              及其补充附件
              <a :href="distributionAgreementUrl" target="_blank" rel="noopener">《商户分销协议》</a>
            </el-checkbox>
          </el-form-item>

          <el-button
            type="primary"
            size="large"
            :loading="loading"
            native-type="submit"
            class="submit-btn"
            :disabled="!form.agreement"
          >
            提交申请并发送激活邮件
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
  max-width: 540px;
  width: 100%;
  padding: 32px 28px;
}
.back {
  display: inline-block;
  color: var(--wm-text-tertiary);
  text-decoration: none;
  font-size: 13px;
  margin-bottom: 16px;
}
.back:hover {
  color: var(--wm-accent-primary);
}
.header {
  margin-bottom: 24px;
}
.title {
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 8px;
}
.subtitle {
  color: var(--wm-text-secondary);
  font-size: 14px;
  margin: 0;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin: 0 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--wm-border-default);
}
.code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.code-row .el-input {
  flex: 1;
}
.tip {
  font-size: 12px;
  color: var(--wm-text-tertiary);
  margin-top: 4px;
  line-height: 1.5;
}
.submit-btn {
  width: 100%;
  margin-top: 8px;
  height: 44px;
  font-size: 14px;
  font-weight: 600;
}

/* 成功页 */
.success-view {
  text-align: center;
  padding: 24px 0;
}
.success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--wm-accent-success);
  color: #fff;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}
.success-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--wm-text-primary);
}
.success-subtitle {
  color: var(--wm-text-secondary);
  font-size: 14px;
  margin: 0 0 24px;
}
.warn-alert {
  margin-bottom: 20px;
  text-align: left;
}
.warn-alert code {
  background: var(--wm-bg-hover);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--wm-font-mono);
  font-size: 13px;
}
</style>
