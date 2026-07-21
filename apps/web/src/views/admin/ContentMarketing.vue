<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { ElMessage } from 'element-plus';

interface Topic {
  id: number;
  title: string;
  category: string;
  shop: string;
}

const topics: Topic[] = [
  { id: 1, title: 'PCL 启动器使用教程（从零到整合包）', category: 'MC 专区', shop: 'mc' },
  { id: 2, title: '如何搭建一个发卡网（WM 开源实践）', category: '官方店', shop: 'main' },
  { id: 3, title: 'SeekAll 网盘/磁力搜索正确姿势', category: '官方店', shop: 'main' },
  { id: 4, title: '小城笺：独立开发者的实用工具箱', category: '实用工具', shop: 'tools' },
  { id: 5, title: 'Steam 激活码购买避坑指南', category: '游戏激活码', shop: 'games' },
  { id: 6, title: 'MC 整合包推荐 + 安装教程', category: 'MC 专区', shop: 'mc' },
  { id: 7, title: '独立开发者副业：卖数字商品月入过万', category: '官方店', shop: 'main' },
  { id: 8, title: '小城笺 APK 注入与签名教程', category: '实用工具', shop: 'tools' },
  { id: 9, title: 'EPIC 免费游戏领取 + 激活', category: '游戏激活码', shop: 'games' },
  { id: 10, title: 'PVZ 杂交版修改器使用', category: 'PVZ/修改器', shop: 'pvz' },
  { id: 11, title: 'WM 发卡网 5 分钟开店（商户教程）', category: '官方店', shop: 'main' },
  { id: 12, title: 'MC 模组推荐（Top 10）', category: 'MC 专区', shop: 'mc' },
  { id: 13, title: '数字商品变现的 5 种方式', category: '官方店', shop: 'main' },
  { id: 14, title: '小城笺 vs 蒲公英：APK 管理对比', category: '实用工具', shop: 'tools' },
  { id: 15, title: 'Steam 账号安全 + 激活码防骗', category: '游戏激活码', shop: 'games' },
  { id: 16, title: '单机游戏修改器原理（PVZ 实战）', category: 'PVZ/修改器', shop: 'pvz' },
  { id: 17, title: '多级分销：邀请人赚钱的原理', category: '官方店', shop: 'main' },
  { id: 18, title: 'PCL2 vs PCL3 对比', category: 'MC 专区', shop: 'mc' },
  { id: 19, title: '独立开发者工具链（SeekAll + 小城笺 + WM）', category: '实用工具', shop: 'tools' },
  { id: 20, title: '游戏激活码批发渠道揭秘', category: '游戏激活码', shop: 'games' },
  { id: 21, title: 'CE 修改器入门（PVZ 练习）', category: 'PVZ/修改器', shop: 'pvz' },
  { id: 22, title: '发卡网 USDT 支付接入教程', category: '官方店', shop: 'main' },
  { id: 23, title: 'MC 服务器搭建 + 内网穿透', category: 'MC 专区', shop: 'mc' },
  { id: 24, title: '数字遗产管理：小城笺的遗产维护功能', category: '实用工具', shop: 'tools' },
  { id: 25, title: '副业复盘：我从 0 到 ¥1000 GMV', category: '官方店', shop: 'main' },
];

const product = reactive({
  name: '',
  price: '',
  sellingPoint: '',
  link: 'https://winmelon.cn/shop/main',
});

const selectedTopicId = ref<number>(1);
const selectedTopic = computed(() => topics.find((t) => t.id === selectedTopicId.value) ?? topics[0]!);

type Platform = 'zhihu' | 'bili' | 'douyin' | 'xhs';
const platformLabels: Record<Platform, string> = {
  zhihu: '知乎长文',
  bili: 'B站脚本',
  douyin: '抖音短视频',
  xhs: '小红书图文',
};

function fillTemplate(template: string): string {
  return template
    .replaceAll('{name}', product.name || '[商品名]')
    .replaceAll('{price}', product.price || '[价格]')
    .replaceAll('{sellingPoint}', product.sellingPoint || '[卖点]')
    .replaceAll('{link}', product.link || 'https://winmelon.cn');
}

/** 4 平台文案模板（带变量占位） */
function getTemplates(topic: Topic): Record<Platform, string> {
  const t = topic.title;
  return {
    zhihu: `# ${t}

## 前言
最近在折腾${topic.category}相关的东西，试了不少方案，踩了很多坑。把经验整理出来，希望对大家有帮助。

## 正文
${product.sellingPoint ? `推荐一款${product.name}（¥${product.price}），${product.sellingPoint}。` : ''}

### 详细教程
1. 第一步：访问 ${product.link}
2. 第二步：选择商品 -> 填邮箱 -> 支付
3. 第三步：自动发卡，秒到账
4. 第四步：按说明激活使用

### 常见问题
- Q：支付后多久能收到？
  A：自动发卡，秒到账。
- Q：支持什么支付方式？
  A：微信/支付宝/USDT 均可。

## 总结
${product.name} 适合需要${topic.category}的用户。价格 ¥${product.price}，性价比不错。

购买链接：${product.link}

---

> 本文首发知乎，转载请注明出处。如有疑问欢迎评论区交流。`,
    bili: `【${t}】

脚本大纲：

[0:00] 开场：今天分享 ${t}
[0:15] 痛点：为什么需要这个
[0:30] 方案介绍：${product.name}（¥${product.price}）
  - ${product.sellingPoint || '核心卖点'}
  - 购买链接：${product.link}
[1:00] 操作演示（录屏）
  - 访问链接
  - 选商品填邮箱
  - 支付（微信/支付宝/USDT）
  - 自动发卡秒到
[3:00] 激活使用
[4:00] 常见问题
  - 多久到账？秒到
  - 支持退款？支持
[5:00] 总结 + 引导关注

---
视频简介：
${t} | ${product.name}（¥${product.price}）
${product.sellingPoint}
购买链接：${product.link}
# ${topic.category} #数字商品 #${product.name}`,
    douyin: `${t}🔥

${product.sellingPoint}

${product.name} ¥${product.price}
${product.link}

# ${topic.category} #数字商品 #${product.name} #副业`,
    xhs: `${t} ✨

姐妹们/兄弟们，最近发现的宝藏${topic.category}好物 ${product.name}！

💰 价格：¥${product.price}
🎯 卖点：${product.sellingPoint}
🔗 链接：${product.link}

适合人群：需要${topic.category}的朋友

购买流程超简单：
1️⃣ 访问链接
2️⃣ 选商品填邮箱
3️⃣ 支付（微信/支付宝/USDT）
4️⃣ 自动发卡秒到！

用了一周，真香。推荐给大家～

#${topic.category} #${product.name} #好物推荐 #数字商品`,
  };
}

const generatedContent = ref<Record<Platform, string>>({
  zhihu: '',
  bili: '',
  douyin: '',
  xhs: '',
});

function generate(): void {
  const templates = getTemplates(selectedTopic.value);
  generatedContent.value = {
    zhihu: fillTemplate(templates.zhihu),
    bili: fillTemplate(templates.bili),
    douyin: fillTemplate(templates.douyin),
    xhs: fillTemplate(templates.xhs),
  };
  ElMessage.success('4 平台文案已生成');
}

const activePlatform = ref<Platform>('zhihu');

async function copyContent(platform: Platform): Promise<void> {
  try {
    await navigator.clipboard.writeText(generatedContent.value[platform]);
    ElMessage.success(`${platformLabels[platform]} 已复制`);
  } catch {
    ElMessage.error('复制失败，请手动选中复制');
  }
}

function copyAll(): void {
  const all = (['zhihu', 'bili', 'douyin', 'xhs'] as Platform[])
    .map((p) => `=== ${platformLabels[p]} ===\n\n${generatedContent.value[p]}\n\n`)
    .join('\n');
  navigator.clipboard
    .writeText(all)
    .then(() => ElMessage.success('4 平台文案全部复制'))
    .catch(() => ElMessage.error('复制失败'));
}
</script>

<template>
  <div class="admin-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">内容营销工具</h2>
        <p class="page-desc">25 主题 × 4 平台 = 100 篇文案模板，填入商品信息一键生成</p>
      </div>
    </header>

    <div class="main-grid">
      <!-- 左侧：主题选择 + 商品信息 -->
      <section class="panel left-panel">
        <h3 class="panel-title">商品信息</h3>
        <el-form label-position="top">
          <el-form-item label="商品名">
            <el-input v-model="product.name" placeholder="如：PCL 启动器" />
          </el-form-item>
          <el-form-item label="价格">
            <el-input v-model="product.price" placeholder="如：18" />
          </el-form-item>
          <el-form-item label="卖点（一句话）">
            <el-input v-model="product.sellingPoint" type="textarea" :rows="2" placeholder="如：开源免费 + 自动更新" />
          </el-form-item>
          <el-form-item label="购买链接">
            <el-input v-model="product.link" placeholder="https://winmelon.cn/shop/..." />
          </el-form-item>
        </el-form>

        <h3 class="panel-title">主题（25 个）</h3>
        <div class="topic-list">
          <div
            v-for="t in topics"
            :key="t.id"
            class="topic-item"
            :class="{ active: t.id === selectedTopicId }"
            @click="selectedTopicId = t.id"
          >
            <span class="topic-id">{{ t.id }}</span>
            <span class="topic-title">{{ t.title }}</span>
            <el-tag size="small" effect="plain">{{ t.category }}</el-tag>
          </div>
        </div>

        <el-button type="primary" size="large" class="generate-btn" @click="generate">生成 4 平台文案</el-button>
      </section>

      <!-- 右侧：生成结果 -->
      <section class="panel right-panel">
        <div class="result-header">
          <el-tabs v-model="activePlatform">
            <el-tab-pane label="知乎长文" name="zhihu" />
            <el-tab-pane label="B站脚本" name="bili" />
            <el-tab-pane label="抖音" name="douyin" />
            <el-tab-pane label="小红书" name="xhs" />
          </el-tabs>
          <div class="result-actions">
            <el-button size="small" @click="copyContent(activePlatform)">复制当前</el-button>
            <el-button size="small" type="primary" plain @click="copyAll">复制全部</el-button>
          </div>
        </div>

        <div v-if="generatedContent[activePlatform]" class="content-box">
          <pre>{{ generatedContent[activePlatform] }}</pre>
        </div>
        <el-empty v-else description="点击「生成 4 平台文案」按钮" :image-size="80" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: var(--wm-container-max);
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--wm-space-xl);
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--wm-text-primary);
  letter-spacing: -0.01em;
}

.page-desc {
  color: var(--wm-text-secondary);
  font-size: 13px;
  margin: 0;
}

.main-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: var(--wm-space-lg);
  align-items: start;
}

.left-panel {
  position: sticky;
  top: var(--wm-space-md);
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.panel {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  padding: var(--wm-space-lg);
  box-shadow: var(--wm-shadow-sm);
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin: var(--wm-space-lg) 0 var(--wm-space-sm);
}

.panel-title:first-child {
  margin-top: 0;
}

.topic-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 400px;
  overflow-y: auto;
}

.topic-item {
  display: flex;
  align-items: center;
  gap: var(--wm-space-sm);
  padding: 8px 10px;
  border-radius: var(--wm-radius-sm);
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.topic-item:hover {
  background: var(--wm-bg-hover);
}

.topic-item.active {
  background: color-mix(in srgb, var(--wm-accent-primary) 10%, transparent);
  border-color: var(--wm-accent-primary);
}

.topic-id {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: var(--wm-bg-hover);
  color: var(--wm-text-secondary);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.topic-item.active .topic-id {
  background: var(--wm-accent-primary);
  color: white;
}

.topic-title {
  flex: 1;
  font-size: 13px;
  color: var(--wm-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.generate-btn {
  width: 100%;
  margin-top: var(--wm-space-md);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--wm-space-md);
  margin-bottom: var(--wm-space-md);
}

.result-header :deep(.el-tabs) {
  flex: 1;
}

.result-actions {
  display: flex;
  gap: var(--wm-space-xs);
  flex-shrink: 0;
}

.content-box {
  background: var(--wm-bg-hover);
  border-radius: var(--wm-radius-md);
  padding: var(--wm-space-lg);
  max-height: 600px;
  overflow-y: auto;
}

.content-box pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--wm-font-mono);
  font-size: 13px;
  line-height: 1.7;
  color: var(--wm-text-primary);
}

@media (max-width: 900px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
  .left-panel {
    position: static;
    max-height: none;
  }
}
</style>
