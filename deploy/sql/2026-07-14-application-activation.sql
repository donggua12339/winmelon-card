-- ============================================================
-- P2-8 迁移：MerchantApplication 加激活 token 字段
-- 执行命令：
--   docker exec -i wm-card-mysql-prod mysql -uroot -p<ROOT_PW> wmcard < deploy/sql/2026-07-14-application-activation.sql
-- ============================================================

ALTER TABLE merchant_applications
  ADD COLUMN activationTokenHash VARCHAR(64),
  ADD COLUMN activationExpiresAt DATETIME(3),
  ADD COLUMN activatedAt DATETIME(3);

CREATE INDEX idx_merchant_app_activation_token ON merchant_applications(activationTokenHash);
