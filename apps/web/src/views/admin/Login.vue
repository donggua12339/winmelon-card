<script setup lang="ts">
</script>

<template>
  <div class="login">
    <el-card>
      <h2>管理员登录</h2>
      <el-form label-width="80px">
        <el-form-item label="用户名">
          <el-input placeholder="用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input type="password" placeholder="密码" show-password />
        </el-form-item>
        <el-button type="primary">登录</el-button>
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
</style>
