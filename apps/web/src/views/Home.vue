<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="home">
    <header class="header">
      <div class="container">
        <h1>WM 官方虚拟卡密交易平台</h1>
        <nav>
          <RouterLink to="/shop/main">进入店铺</RouterLink>
          <RouterLink to="/query">订单查询</RouterLink>
          <RouterLink to="/admin/login">管理后台</RouterLink>
        </nav>
      </div>
    </header>
    <main class="container main">
      <el-card>
        <h2>欢迎使用</h2>
        <p>这是一个开源发卡网平台。当前处于 M0 阶段（骨架搭建中）。</p>
        <p>请访问 <RouterLink to="/shop/main">/shop/main</RouterLink> 查看店铺页（即将上线）。</p>
      </el-card>
    </main>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
}
.header {
  background: #409eff;
  color: white;
  padding: 16px 0;
}
.header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}
.main {
  padding: 32px 16px;
}
nav a {
  color: white;
  margin-left: 16px;
  text-decoration: none;
}
nav a:hover {
  text-decoration: underline;
}
</style>
