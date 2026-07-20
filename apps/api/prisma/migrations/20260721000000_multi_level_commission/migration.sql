-- ============================================================
-- 多层级分销升级 migration
-- 2026-07-21
-- 1. merchants 表加 4 字段: invitedAt, allowBuyerInviteCode, leaderboardDisplayMode, leaderboardName
-- 2. merchant_applications 表加 1 字段: inviteCode
-- 3. system_configs seed 5 项分销配置
-- ============================================================

-- 1. merchants 表加字段
ALTER TABLE `merchants`
  ADD COLUMN `invitedAt` DATETIME(3) NULL,
  ADD COLUMN `allowBuyerInviteCode` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `leaderboardDisplayMode` VARCHAR(32) NOT NULL DEFAULT 'TOP10',
  ADD COLUMN `leaderboardName` VARCHAR(128) NULL;

-- 2. merchant_applications 表加字段
ALTER TABLE `merchant_applications`
  ADD COLUMN `inviteCode` VARCHAR(32) NULL;

-- 3. system_configs seed
INSERT INTO `system_configs` (`key`, `value`, `description`, `createdAt`, `updatedAt`) VALUES
  ('commission_level_1_rate', '0.03', '1 级返佣比例（直接邀请人）', NOW(), NOW()),
  ('commission_level_2_rate', '0.01', '2 级返佣比例（邀请人的邀请人）', NOW(), NOW()),
  ('commission_level_3_rate', '0.005', '3 级返佣比例（3 级上线）', NOW(), NOW()),
  ('buyer_invite_code_global_enabled', 'false', '全局开关：买家下单时是否可填邀请码（商户级可覆盖）', NOW(), NOW()),
  ('leaderboard_enabled', 'false', '排行榜功能开关（默认关，开启后商户工作台可见）', NOW(), NOW())
ON DUPLICATE KEY UPDATE `updatedAt` = NOW();
