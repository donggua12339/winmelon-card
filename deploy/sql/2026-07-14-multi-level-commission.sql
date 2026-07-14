-- ============================================================
-- F3 迁移：多层级分销（Merchant.inviterMerchantId + CommissionRecord.level）
-- 执行命令：
--   docker exec -i wm-card-mysql-prod mysql -uroot -p<ROOT_PW> wmcard < deploy/sql/2026-07-14-multi-level-commission.sql
-- ============================================================

-- 1. 加 inviterMerchantId 字段（自关联）
ALTER TABLE merchants
  ADD COLUMN inviterMerchantId VARCHAR(36),
  ADD CONSTRAINT fk_merchants_inviter FOREIGN KEY (inviterMerchantId) REFERENCES merchants(id) ON DELETE SET NULL;

CREATE INDEX idx_merchants_inviter ON merchants(inviterMerchantId);

-- 2. CommissionRecord 加 level 字段
ALTER TABLE commission_records
  ADD COLUMN level INT NOT NULL DEFAULT 1;

CREATE INDEX idx_commission_level ON commission_records(level);
