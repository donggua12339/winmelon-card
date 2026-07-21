-- ============================================================
-- 法务合规升级 migration
-- 2026-07-21
-- 1. merchants 表加 4 字段: distributionSuspendedAt, withdrawalSuspendedAt, penaltyStatus, penaltyReason, penaltyStartedAt
-- 2. 新建 merchant_penalties 表（处罚申诉 T+3）
-- 3. system_configs seed 4 项风控配置
-- ============================================================

-- 1. merchants 表加字段
ALTER TABLE `merchants`
  ADD COLUMN `distributionSuspendedAt` DATETIME(3) NULL,
  ADD COLUMN `withdrawalSuspendedAt` DATETIME(3) NULL,
  ADD COLUMN `penaltyStatus` VARCHAR(32) NULL,
  ADD COLUMN `penaltyReason` TEXT NULL,
  ADD COLUMN `penaltyStartedAt` DATETIME(3) NULL;

-- 2. merchant_penalties 表
CREATE TABLE IF NOT EXISTS `merchant_penalties` (
  `id` VARCHAR(191) NOT NULL,
  `merchantId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `reason` TEXT NOT NULL,
  `action` VARCHAR(32) NOT NULL,
  `appealDeadline` DATETIME(3) NOT NULL,
  `appealContent` TEXT NULL,
  `appealedAt` DATETIME(3) NULL,
  `executedAt` DATETIME(3) NULL,
  `amount` DECIMAL(12,2) NULL,
  `operatorId` VARCHAR(64) NULL,
  `operatorName` VARCHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_merchant_penalties_merchantId` (`merchantId`),
  INDEX `idx_merchant_penalties_status` (`status`),
  INDEX `idx_merchant_penalties_appealDeadline` (`appealDeadline`),
  CONSTRAINT `fk_merchant_penalties_merchant` FOREIGN KEY (`merchantId`) REFERENCES `merchants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. system_configs seed 风控配置
INSERT INTO `system_configs` (`id`, `key`, `value`, `updatedAt`) VALUES
  (UUID(), 'risk_ip_pending_threshold', '5', NOW()),
  (UUID(), 'risk_email_pending_threshold', '3', NOW()),
  (UUID(), 'risk_window_minutes', '60', NOW()),
  (UUID(), 'risk_auto_block_minutes', '60', NOW())
ON DUPLICATE KEY UPDATE `updatedAt` = NOW();
