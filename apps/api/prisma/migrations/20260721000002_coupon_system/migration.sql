-- ============================================================
-- P2-5 补贴券系统 migration
-- 2026-07-21
-- 1. orders 表加 couponId + discountAmount
-- 2. 新建 coupons 表
-- ============================================================

-- 1. orders 表加字段
ALTER TABLE `orders`
  ADD COLUMN `couponId` VARCHAR(36) NULL,
  ADD COLUMN `discountAmount` DECIMAL(12,2) NULL,
  ADD INDEX `idx_orders_couponId` (`couponId`);

-- 2. coupons 表
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `type` ENUM('PERCENT','AMOUNT','FREE_SHIPPING') NOT NULL,
  `value` DECIMAL(8,2) NOT NULL,
  `minSpend` DECIMAL(12,2) NULL,
  `validFrom` DATETIME(3) NULL,
  `validTo` DATETIME(3) NULL,
  `usageLimit` INT NULL,
  `usedCount` INT NOT NULL DEFAULT 0,
  `shopId` VARCHAR(36) NULL,
  `note` VARCHAR(255) NULL,
  `createdBy` VARCHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_coupons_code` (`code`),
  INDEX `idx_coupons_shopId` (`shopId`),
  INDEX `idx_coupons_validTo` (`validTo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
