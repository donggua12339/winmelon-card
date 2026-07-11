<script setup lang="ts">
import { RouterView, RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ElMessageBox } from 'element-plus';

const router = useRouter();
const auth = useAuthStore();

async function onLogout(): Promise<void> {
  await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' });
  await auth.logout();
  router.replace('/admin/login');
}
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
        <div class="left">
          <RouterLink to="/" class="back">← 返回首页</RouterLink>
        </div>
        <div class="right">
          <span class="user">{{ auth.user?.username ?? '-' }}</span>
          <el-button link type="primary" @click="onLogout">退出</el-button>
        </div>
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
  justify-content: space-between;
  padding: 0 16px;
}
.back {
  color: #606266;
  text-decoration: none;
}
.user {
  margin-right: 12px;
  color: #606266;
}
</style>
