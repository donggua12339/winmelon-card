<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
const merchantCode = route.params.merchantCode as string;
</script>

<template>
  <div class="shop">
    <h1>店铺 {{ merchantCode }}</h1>
    <el-empty description="店铺页面即将上线" />
  </div>
</template>

<style scoped>
.shop {
  padding: 32px;
}
</style>
