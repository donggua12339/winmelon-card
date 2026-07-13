<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { post } from '@/api/http';

const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({
  contactEmail: '',
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

async function onSubmit(): Promise<void> {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    await post('/merchant/apply', form);
    ElMessage.success('申请已提交，请等待管理员审核');
    router.push('/');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="apply-page">
    <div class="glass apply-card">
      <RouterLink to="/" class="back">← 返回首页</RouterLink>

      <div class="header">
        <h1 class="title"><span class="text-gradient-aurora">商户入驻</span></h1>
        <p class="subtitle">填写信息，提交后等待平台审核（1-3 个工作日）</p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="onSubmit">
        <h3 class="section-title">商户与店铺</h3>
        <el-form-item label="联系邮箱" prop="contactEmail">
          <el-input v-model="form.contactEmail" placeholder="用于接收审核结果和登录" />
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
          提交申请
        </el-button>
      </el-form>
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
</style>
