<script setup lang="ts">
</script>

<template>
  <div>
    <h2>数据看板</h2>
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card><div>今日订单</div><div class="num">0</div></el-card>
      </el-col>
      <el-col :span="6">
        <el-card><div>今日 GMV</div><div class="num">¥0</div></el-card>
      </el-col>
      <el-col :span="6">
        <el-card><div>商品数</div><div class="num">0</div></el-card>
      </el-col>
      <el-col :span="6">
        <el-card><div>卡密库存</div><div class="num">0</div></el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.num {
  font-size: 24px;
  font-weight: bold;
  margin-top: 8px;
}
</style>
