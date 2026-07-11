<script setup lang="ts">
import { ref } from 'vue';

const orderNo = ref('');
const email = ref('');
</script>

<template>
  <div class="query">
    <el-card>
      <h2>订单查询</h2>
      <el-form label-width="100px">
        <el-form-item label="订单号">
          <el-input v-model="orderNo" placeholder="请输入订单号" />
        </el-form-item>
        <el-form-item label="联系邮箱">
          <el-input v-model="email" placeholder="下单时填写的邮箱" />
        </el-form-item>
        <el-button type="primary">查询</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.query {
  padding: 32px;
  max-width: 600px;
  margin: 0 auto;
}
</style>
