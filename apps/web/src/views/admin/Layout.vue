<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router';
</script>

<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">WM 管理</div>
      <el-menu router default-active="/admin/dashboard">
        <el-menu-item index="/admin/dashboard">看板</el-menu-item>
        <el-menu-item index="/admin/products">商品</el-menu-item>
        <el-menu-item index="/admin/stock">卡密</el-menu-item>
        <el-menu-item index="/admin/orders">订单</el-menu-item>
        <el-menu-item index="/admin/payments">支付配置</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <RouterLink to="/" class="back">← 返回首页</RouterLink>
      </el-header>
      <el-main>
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}
.aside {
  background: #304156;
  color: white;
}
.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  font-size: 18px;
  color: white;
  background: #2b3a4d;
}
.header {
  background: white;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  padding: 0 16px;
}
.back {
  color: #606266;
  text-decoration: none;
}
</style>
