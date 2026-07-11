<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { post } from '@/api/http';

const route = useRoute();
const router = useRouter();
const orderNo = (route.query.orderNo as string) ?? '';
const amount = (route.query.amount as string) ?? '';

const paying = ref(false);
const paid = ref(false);

async function onPay(): Promise<void> {
  if (!orderNo) {
    ElMessage.error('订单号缺失');
    return;
  }
  paying.value = true;
  try {
    await post('/payment/mock-pay', { orderNo });
    paid.value = true;
    ElMessage.success('支付成功，2 秒后跳转订单查询页');
    setTimeout(() => {
      router.push({ path: '/query', query: { orderNo } });
    }, 2000);
  } finally {
    paying.value = false;
  }
}

onMounted(() => {
  if (!orderNo) {
    ElMessage.error('参数错误');
  }
});
</script>

<template>
  <div class="mock-pay">
    <el-card>
      <h2>模拟支付（开发用）</h2>
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="此页面仅用于本地开发与测试，生产环境请关闭 mock 通道"
        style="margin-bottom: 16px"
      />
      <el-descriptions :column="1" border>
        <el-descriptions-item label="订单号">{{ orderNo }}</el-descriptions-item>
        <el-descriptions-item label="支付金额">
          <span class="amount">¥{{ amount }}</span>
        </el-descriptions-item>
      </el-descriptions>
      <div class="actions">
        <el-button v-if="!paid" type="primary" size="large" :loading="paying" @click="onPay">
          确认支付 ¥{{ amount }}
        </el-button>
        <el-button v-else type="success" size="large" disabled>支付成功</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.mock-pay {
  padding: 40px 16px;
  max-width: 480px;
  margin: 0 auto;
}
.amount {
  color: #f56c6c;
  font-size: 20px;
  font-weight: bold;
}
.actions {
  text-align: center;
  margin-top: 24px;
}
</style>
