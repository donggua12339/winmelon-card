<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post, del, put } from '@/api/http';
import { VueFlow, useVueFlow, type Node, type Edge } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

// ============== 类型 ==============
interface InviteCode {
  id: string;
  code: string;
  note?: string | null;
  usedCount: number;
  createdAt: string;
}
interface Commission {
  id: string;
  orderNo: string;
  sourceMerchantName: string;
  baseAmount: number;
  rate: number;
  amount: number;
  level: number;
  status: string;
  createdAt: string;
}
interface InviteStats {
  totalCommission: number;
  monthCommission: number;
  codeCount: number;
  usedCodeCount: number;
  invitedMerchantCount: number;
}
interface InviteTreeNode {
  id: string;
  name: string;
  leaderboardName: string | null;
  invitedAt: string | null;
  status: string;
  totalGmv: number;
  inviteesCount: number;
  children: InviteTreeNode[];
}
interface TreeResp {
  root: {
    id: string;
    name: string;
    leaderboardName: string | null;
    invitedAt: string | null;
    totalGmv: number;
    inviteesCount: number;
  } | null;
  tree: InviteTreeNode[];
}
interface LeaderboardItem {
  rank: number;
  displayName: string;
  value: number;
}
interface LeaderboardResp {
  items: LeaderboardItem[];
  updatedAt: string;
}
interface MyLeaderboardResp {
  myRank: number | null;
  myValue: number;
  neighbors: LeaderboardItem[];
}
interface Settings {
  allowBuyerInviteCode: boolean;
  leaderboardDisplayMode: 'TOP10' | 'TOP10_WITH_NEIGHBORS' | 'OFF';
  leaderboardName: string | null;
  inviterMerchantId: string | null;
  inviterName: string | null;
  invitedAt: string | null;
}

// ============== 状态 ==============
const activeTab = ref<'codes' | 'tree' | 'leaderboard' | 'settings'>('codes');
const loading = ref(false);

// 邀请码 + 统计 + 返佣
const stats = ref<InviteStats>({
  totalCommission: 0,
  monthCommission: 0,
  codeCount: 0,
  usedCodeCount: 0,
  invitedMerchantCount: 0,
});
const codes = ref<InviteCode[]>([]);
const commissions = ref<Commission[]>([]);
const dialogVisible = ref(false);
const newNote = ref('');

// 关系链
const treeData = ref<TreeResp>({ root: null, tree: [] });
const treeDepth = ref<2 | 3>(2);
const { onNodeClick } = useVueFlow();
const treeNodes = ref<Node[]>([]);
const treeEdges = ref<Edge[]>([]);
onNodeClick(({ node }) => {
  ElMessage.info(`选中：${node.label || node.id}`);
});

// 排行榜
const leaderboardDimension = ref<'invites' | 'teamSize' | 'teamGmv'>('invites');
const leaderboardPeriod = ref<'week' | 'month' | 'all'>('all');
const leaderboardData = ref<LeaderboardResp>({ items: [], updatedAt: '' });
const myLeaderboard = ref<MyLeaderboardResp>({ myRank: null, myValue: 0, neighbors: [] });

// 设置
const settings = ref<Settings>({
  allowBuyerInviteCode: false,
  leaderboardDisplayMode: 'TOP10',
  leaderboardName: null,
  inviterMerchantId: null,
  inviterName: null,
  invitedAt: null,
});
const savingSettings = ref(false);

// ============== 方法 ==============
async function fetchAll(): Promise<void> {
  loading.value = true;
  try {
    const [s, c, cms] = await Promise.all([
      get<InviteStats>('/merchant/invite/stats'),
      get<InviteCode[]>('/merchant/invite-codes'),
      get<{ items: Commission[]; total: number }>('/merchant/commissions', {
        params: { page: 1, pageSize: 20 },
      }),
    ]);
    stats.value = s;
    codes.value = c;
    commissions.value = cms.items;
  } finally {
    loading.value = false;
  }
}

async function fetchTree(): Promise<void> {
  loading.value = true;
  try {
    treeData.value = await get<TreeResp>(`/merchant/invite/tree?depth=${treeDepth.value}`);
    buildFlow();
  } finally {
    loading.value = false;
  }
}

function buildFlow(): void {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  if (!treeData.value.root) {
    treeNodes.value = [];
    treeEdges.value = [];
    return;
  }
  // 根节点
  nodes.push({
    id: treeData.value.root.id,
    label: treeData.value.root.name,
    position: { x: 400, y: 0 },
    class: 'root-node',
    data: { gmv: treeData.value.root.totalGmv, count: treeData.value.root.inviteesCount },
  });
  // 递归加子节点
  const layout = (parent: InviteTreeNode | typeof treeData.value.root, x: number, y: number, step: number) => {
    const children = 'children' in parent ? parent.children : treeData.value.tree;
    const n = children.length;
    if (n === 0) return;
    const totalWidth = step * n;
    let startX = x - totalWidth / 2 + step / 2;
    for (const child of children) {
      const childX = startX;
      nodes.push({
        id: child.id,
        label: child.name,
        position: { x: childX, y: y + 150 },
        class: child.status === 'SUSPENDED' ? 'suspended-node' : '',
        data: { gmv: child.totalGmv, count: child.inviteesCount },
      });
      edges.push({
        id: `${parent.id}-${child.id}`,
        source: parent.id,
        target: child.id,
        type: 'smoothstep',
      });
      layout(child, childX, y + 150, step / 2);
      startX += step;
    }
  };
  layout(treeData.value.root, 400, 0, 600);
  treeNodes.value = nodes;
  treeEdges.value = edges;
}

async function fetchLeaderboard(): Promise<void> {
  loading.value = true;
  try {
    const [lb, me] = await Promise.all([
      get<LeaderboardResp>(
        `/merchant/invite/leaderboard?dimension=${leaderboardDimension.value}&period=${leaderboardPeriod.value}`,
      ),
      get<MyLeaderboardResp>(
        `/merchant/invite/leaderboard/me?dimension=${leaderboardDimension.value}&period=${leaderboardPeriod.value}`,
      ),
    ]);
    leaderboardData.value = lb;
    myLeaderboard.value = me;
  } finally {
    loading.value = false;
  }
}

async function fetchSettings(): Promise<void> {
  loading.value = true;
  try {
    settings.value = await get<Settings>('/merchant/invite/settings');
  } finally {
    loading.value = false;
  }
}

async function createCode(): Promise<void> {
  try {
    await post('/merchant/invite-codes', { note: newNote.value || undefined });
    ElMessage.success('邀请码已生成');
    dialogVisible.value = false;
    newNote.value = '';
    fetchAll();
  } catch {
    /* http 层已提示 */
  }
}

async function removeCode(c: InviteCode): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除邀请码「${c.code}」？`, '确认', { type: 'warning' });
    await del(`/merchant/invite-codes/${c.id}`);
    ElMessage.success('已删除');
    fetchAll();
  } catch {
    /* 取消 */
  }
}

function copyCode(code: string): void {
  navigator.clipboard.writeText(code);
  ElMessage.success(`已复制 ${code}`);
}

async function saveSettings(): Promise<void> {
  savingSettings.value = true;
  try {
    await put('/merchant/invite/settings', {
      allowBuyerInviteCode: settings.value.allowBuyerInviteCode,
      leaderboardDisplayMode: settings.value.leaderboardDisplayMode,
      leaderboardName: settings.value.leaderboardName || null,
    });
    ElMessage.success('设置已保存');
  } finally {
    savingSettings.value = false;
  }
}

function formatMoney(n: number): string {
  return `¥${n.toFixed(2)}`;
}

function dimensionLabel(d: string): string {
  return { invites: '邀请人数', teamSize: '团队总人数', teamGmv: '团队总 GMV' }[d] ?? d;
}

function periodLabel(p: string): string {
  return { week: '本周', month: '本月', all: '全部' }[p] ?? p;
}

const visibleLeaderboardItems = computed(() => {
  if (settings.value.leaderboardDisplayMode === 'OFF') return [];
  return leaderboardData.value.items;
});

const visibleNeighbors = computed(() => {
  if (settings.value.leaderboardDisplayMode !== 'TOP10_WITH_NEIGHBORS') return [];
  return myLeaderboard.value.neighbors;
});

function onTabChange(tab: string): void {
  if (tab === 'tree' && treeData.value.root === null) fetchTree();
  if (tab === 'leaderboard' && leaderboardData.value.items.length === 0) fetchLeaderboard();
  if (tab === 'settings' && !settings.value.inviterName) fetchSettings();
}

onMounted(fetchAll);
</script>

<template>
  <div class="admin-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">推广邀请</h2>
        <p class="page-desc">邀请码、关系链、排行榜与分销设置</p>
      </div>
    </header>

    <el-tabs v-model="activeTab" class="invite-tabs" @tab-change="onTabChange as any">
      <!-- Tab 1: 邀请码 -->
      <el-tab-pane label="邀请码" name="codes">
        <div v-loading="loading" class="tab-content">
          <div class="stats-grid">
            <div class="stat-card stat-primary">
              <div class="stat-label">总返佣收益</div>
              <div class="stat-value">{{ formatMoney(stats.totalCommission) }}</div>
            </div>
            <div class="stat-card stat-success">
              <div class="stat-label">本月返佣</div>
              <div class="stat-value">{{ formatMoney(stats.monthCommission) }}</div>
            </div>
            <div class="stat-card stat-warning">
              <div class="stat-label">邀请码数量</div>
              <div class="stat-value">{{ stats.codeCount }}</div>
            </div>
            <div class="stat-card stat-secondary">
              <div class="stat-label">已邀请商户</div>
              <div class="stat-value">{{ stats.invitedMerchantCount }}</div>
            </div>
          </div>

          <section class="panel">
            <div class="panel-header">
              <h3 class="panel-title">我的邀请码</h3>
              <el-button type="primary" size="small" @click="dialogVisible = true">+ 生成邀请码</el-button>
            </div>
            <el-table :data="codes" :border="false" stripe>
              <el-table-column label="邀请码" width="200">
                <template #default="{ row }">
                  <code class="code-text">{{ row.code }}</code>
                  <el-button link size="small" @click="copyCode(row.code)">复制</el-button>
                </template>
              </el-table-column>
              <el-table-column prop="note" label="备注" min-width="200" />
              <el-table-column prop="usedCount" label="使用次数" width="100" />
              <el-table-column label="创建时间" width="170">
                <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
              </el-table-column>
              <el-table-column label="操作" width="80">
                <template #default="{ row }">
                  <el-button
                    link
                    type="danger"
                    size="small"
                    :disabled="row.usedCount > 0"
                    @click="removeCode(row as InviteCode)"
                  >
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </section>

          <section class="panel">
            <h3 class="panel-title">返佣记录</h3>
            <el-table :data="commissions" :border="false" stripe>
              <el-table-column prop="orderNo" label="订单号" width="200" />
              <el-table-column prop="sourceMerchantName" label="来源商户" min-width="150" />
              <el-table-column label="级别" width="80">
                <template #default="{ row }">
                  <el-tag size="small">{{ row.level }} 级</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="基数" width="100">
                <template #default="{ row }">{{ formatMoney(row.baseAmount) }}</template>
              </el-table-column>
              <el-table-column label="比例" width="80">
                <template #default="{ row }">{{ (row.rate * 100).toFixed(1) }}%</template>
              </el-table-column>
              <el-table-column label="返佣" width="100">
                <template #default="{ row }">
                  <span class="amount amount-success">{{ formatMoney(row.amount) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.status === 'SETTLED' ? 'success' : 'warning'" size="small">
                    {{ row.status === 'SETTLED' ? '已结算' : '已冲正' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="时间" width="170">
                <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
              </el-table-column>
            </el-table>
          </section>
        </div>
      </el-tab-pane>

      <!-- Tab 2: 关系链 -->
      <el-tab-pane label="关系链" name="tree">
        <div v-loading="loading" class="tab-content">
          <section class="panel">
            <div class="panel-header">
              <h3 class="panel-title">邀请关系链</h3>
              <el-radio-group v-model="treeDepth" size="small" @change="fetchTree">
                <el-radio-button :value="2">2 级</el-radio-button>
                <el-radio-button :value="3">3 级</el-radio-button>
              </el-radio-group>
            </div>
            <div v-if="treeData.root" class="tree-summary">
              <span
                >根节点：<b>{{ treeData.root.name }}</b></span
              >
              <span
                >累计 GMV：<b class="amount">{{ formatMoney(treeData.root.totalGmv) }}</b></span
              >
              <span
                >直接下级：<b>{{ treeData.root.inviteesCount }}</b></span
              >
            </div>
            <div v-if="treeData.root" class="tree-container">
              <VueFlow :nodes="treeNodes" :edges="treeEdges" :fit-view-on-init="true">
                <Background />
                <Controls />
              </VueFlow>
            </div>
            <el-empty v-else description="暂无邀请关系数据" />
          </section>
        </div>
      </el-tab-pane>

      <!-- Tab 3: 排行榜 -->
      <el-tab-pane label="排行榜" name="leaderboard">
        <div v-loading="loading" class="tab-content">
          <section class="panel">
            <div class="panel-header">
              <h3 class="panel-title">分销排行榜</h3>
              <div class="leaderboard-controls">
                <el-select v-model="leaderboardDimension" size="small" style="width: 140px" @change="fetchLeaderboard">
                  <el-option label="邀请人数" value="invites" />
                  <el-option label="团队总人数" value="teamSize" />
                  <el-option label="团队总 GMV" value="teamGmv" />
                </el-select>
                <el-select v-model="leaderboardPeriod" size="small" style="width: 100px" @change="fetchLeaderboard">
                  <el-option label="本周" value="week" />
                  <el-option label="本月" value="month" />
                  <el-option label="全部" value="all" />
                </el-select>
              </div>
            </div>

            <div v-if="settings.leaderboardDisplayMode === 'OFF'" class="empty-tip">
              你已关闭排行榜显示，可在"设置"tab 重新开启
            </div>
            <template v-else>
              <!-- 我的排名 -->
              <div class="my-rank-card">
                <div class="my-rank-label">我的排名</div>
                <div class="my-rank-value">
                  <span class="rank-num">{{ myLeaderboard.myRank ?? '未上榜' }}</span>
                  <span class="rank-value"
                    >{{ dimensionLabel(leaderboardDimension) }}：{{ myLeaderboard.myValue }}</span
                  >
                </div>
              </div>

              <!-- 上下 2 名 -->
              <div v-if="visibleNeighbors.length" class="neighbors-grid">
                <div v-for="n in visibleNeighbors" :key="n.rank" class="neighbor-card">
                  <div class="neighbor-rank">#{{ n.rank }}</div>
                  <div class="neighbor-name">{{ n.displayName }}</div>
                  <div class="neighbor-value">{{ n.value }}</div>
                </div>
              </div>

              <!-- Top 10 -->
              <h4 class="subsection-title">
                Top 10（{{ dimensionLabel(leaderboardDimension) }} · {{ periodLabel(leaderboardPeriod) }}）
              </h4>
              <el-table :data="visibleLeaderboardItems" :border="false" stripe>
                <el-table-column label="排名" width="80">
                  <template #default="{ row }">
                    <span :class="['rank-badge', `rank-${row.rank}`]">{{ row.rank }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="displayName" label="商户" min-width="200" />
                <el-table-column label="数值" width="150" align="right">
                  <template #default="{ row }">
                    <span class="amount">{{ row.value }}</span>
                  </template>
                </el-table-column>
              </el-table>
              <div class="updated-tip">
                更新时间：{{ new Date(leaderboardData.updatedAt).toLocaleString() }}（缓存 5 分钟）
              </div>
            </template>
          </section>
        </div>
      </el-tab-pane>

      <!-- Tab 4: 设置 -->
      <el-tab-pane label="设置" name="settings">
        <div v-loading="loading" class="tab-content">
          <section class="panel">
            <h3 class="panel-title">分销设置</h3>
            <el-form label-position="top" class="settings-form">
              <el-form-item label="买家下单填邀请码">
                <el-switch v-model="settings.allowBuyerInviteCode" />
                <div class="tip">开启后，买家在你的店铺下单时可填邀请码获得单级返佣。需平台全局开关也开启才生效。</div>
              </el-form-item>
              <el-form-item label="排行榜显示模式">
                <el-radio-group v-model="settings.leaderboardDisplayMode">
                  <el-radio value="TOP10">仅 Top 10</el-radio>
                  <el-radio value="TOP10_WITH_NEIGHBORS">Top 10 + 上下 2 名</el-radio>
                  <el-radio value="OFF">关闭显示</el-radio>
                </el-radio-group>
                <div class="tip">控制你在工作台看到的排行榜内容</div>
              </el-form-item>
              <el-form-item label="排行榜显示名">
                <el-input
                  v-model="settings.leaderboardName"
                  placeholder="留空则用商户名脱敏（如：张***）"
                  maxlength="128"
                  show-word-limit
                  clearable
                />
                <div class="tip">在公开排行榜中显示的名字，可不同于真实商户名</div>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="savingSettings" @click="saveSettings">保存设置</el-button>
              </el-form-item>
            </el-form>
          </section>

          <section class="panel">
            <h3 class="panel-title">我的邀请关系</h3>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="我的邀请人">
                {{ settings.inviterName ?? '无（顶级商户）' }}
              </el-descriptions-item>
              <el-descriptions-item label="绑定时间">
                {{ settings.invitedAt ? new Date(settings.invitedAt).toLocaleString() : '-' }}
              </el-descriptions-item>
            </el-descriptions>
            <div class="tip">如需解绑或改绑邀请人，请联系客服（微信 donggua16600）</div>
          </section>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="dialogVisible" title="生成邀请码" width="400px">
      <el-input v-model="newNote" placeholder="备注（可选），如：某某渠道推广" maxlength="255" />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createCode">生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: var(--wm-container-max);
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--wm-space-lg);
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

.invite-tabs {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  padding: var(--wm-space-lg);
  box-shadow: var(--wm-shadow-sm);
}

.tab-content {
  padding-top: var(--wm-space-md);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--wm-space-md);
  margin-bottom: var(--wm-space-lg);
}

.stat-card {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  padding: var(--wm-space-lg);
  box-shadow: var(--wm-shadow-sm);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: var(--card-color);
}

.stat-primary {
  --card-color: var(--wm-accent-primary);
}
.stat-success {
  --card-color: var(--wm-accent-success);
}
.stat-warning {
  --card-color: var(--wm-accent-warning);
}
.stat-secondary {
  --card-color: var(--wm-accent-secondary);
}

.stat-label {
  font-size: 13px;
  color: var(--wm-text-secondary);
  margin-bottom: 6px;
  font-weight: 500;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--wm-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.panel {
  background: var(--wm-bg-elevated);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-md);
  padding: var(--wm-space-lg);
  margin-bottom: var(--wm-space-md);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--wm-space-md);
  flex-wrap: wrap;
  gap: var(--wm-space-sm);
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin: 0 0 var(--wm-space-md);
}

.panel-header .panel-title {
  margin: 0;
}

.code-text {
  font-family: var(--wm-font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--wm-accent-primary);
  background: color-mix(in srgb, var(--wm-accent-primary) 12%, transparent);
  padding: 2px 8px;
  border-radius: 3px;
  margin-right: 8px;
}

.amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--wm-text-primary);
}

.amount-success {
  color: var(--wm-accent-success);
}

/* 关系链 */
.tree-summary {
  display: flex;
  gap: var(--wm-space-xl);
  padding: var(--wm-space-md);
  background: var(--wm-bg-hover);
  border-radius: var(--wm-radius-sm);
  margin-bottom: var(--wm-space-md);
  font-size: 14px;
  color: var(--wm-text-secondary);
  flex-wrap: wrap;
}

.tree-container {
  height: 500px;
  background: var(--wm-bg-hover);
  border-radius: var(--wm-radius-sm);
  border: 1px solid var(--wm-border-default);
}

/* 排行榜 */
.leaderboard-controls {
  display: flex;
  gap: var(--wm-space-sm);
}

.my-rank-card {
  background: color-mix(in srgb, var(--wm-accent-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--wm-accent-primary) 20%, transparent);
  border-radius: var(--wm-radius-md);
  padding: var(--wm-space-lg);
  margin-bottom: var(--wm-space-md);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.my-rank-label {
  font-size: 14px;
  color: var(--wm-text-secondary);
  font-weight: 500;
}

.my-rank-value {
  display: flex;
  gap: var(--wm-space-lg);
  align-items: baseline;
}

.rank-num {
  font-size: 28px;
  font-weight: 800;
  color: var(--wm-accent-primary);
  font-variant-numeric: tabular-nums;
}

.rank-value {
  font-size: 14px;
  color: var(--wm-text-secondary);
}

.neighbors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--wm-space-sm);
  margin-bottom: var(--wm-space-md);
}

.neighbor-card {
  background: var(--wm-bg-hover);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-sm);
  padding: var(--wm-space-md);
  text-align: center;
}

.neighbor-rank {
  font-size: 18px;
  font-weight: 700;
  color: var(--wm-accent-primary);
  margin-bottom: 4px;
}

.neighbor-name {
  font-size: 13px;
  color: var(--wm-text-primary);
  margin-bottom: 4px;
}

.neighbor-value {
  font-size: 12px;
  color: var(--wm-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.subsection-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin: var(--wm-space-lg) 0 var(--wm-space-sm);
}

.rank-badge {
  display: inline-block;
  width: 28px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  border-radius: 50%;
  font-weight: 700;
  font-size: 13px;
  background: var(--wm-bg-hover);
  color: var(--wm-text-secondary);
}

.rank-badge.rank-1 {
  background: color-mix(in srgb, var(--wm-accent-warning) 20%, transparent);
  color: var(--wm-accent-warning);
}

.rank-badge.rank-2 {
  background: color-mix(in srgb, var(--wm-text-tertiary) 20%, transparent);
  color: var(--wm-text-primary);
}

.rank-badge.rank-3 {
  background: color-mix(in srgb, var(--wm-accent-danger) 15%, transparent);
  color: var(--wm-accent-danger);
}

.updated-tip {
  margin-top: var(--wm-space-md);
  font-size: 12px;
  color: var(--wm-text-tertiary);
  text-align: right;
}

.empty-tip {
  padding: var(--wm-space-xl);
  text-align: center;
  color: var(--wm-text-tertiary);
  font-size: 13px;
}

/* 设置 */
.settings-form {
  max-width: 600px;
}

.tip {
  font-size: 12px;
  color: var(--wm-text-tertiary);
  margin-top: var(--wm-space-2xs);
  line-height: 1.5;
}

/* vue-flow 节点样式 */
:deep(.vue-flow__node) {
  font-size: 13px;
}

:deep(.vue-flow__node.root-node) {
  font-weight: 700;
  background: var(--wm-accent-primary);
  color: var(--wm-text-on-primary);
  border: none;
}

:deep(.vue-flow__node.suspended-node) {
  opacity: 0.5;
  text-decoration: line-through;
}

:deep(.vue-flow__edge-path) {
  stroke: var(--wm-border-hover);
  stroke-width: 1.5;
}
</style>
