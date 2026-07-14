-- ============================================================
-- P2-12 迁移：Order 表加 merchantId 字段（反范式） + 复合索引
-- 执行命令：
--   docker exec -i wm-card-mysql-prod mysql -uroot -p<ROOT_PW> wmcard < deploy/sql/2026-07-14-order-merchant-id.sql
-- ============================================================

-- 1. 加 merchantId 列（nullable 允许 backfill 期间存在 null）
ALTER TABLE orders ADD COLUMN merchantId VARCHAR(36);
CREATE INDEX idx_orders_merchantId_status_createdAt ON orders(merchantId, status, createdAt);

-- 2. Backfill：从 shops 表同步 merchantId
UPDATE orders o
INNER JOIN shops s ON s.id = o.shopId
SET o.merchantId = s.merchantId
WHERE o.merchantId IS NULL;

-- 3. 校验
SELECT
  COUNT(*) AS total_orders,
  COUNT(merchantId) AS orders_with_merchantId,
  COUNT(*) - COUNT(merchantId) AS orders_missing_merchantId
FROM orders;

-- 4. 未来订单 merchantId 由应用层在创建时填（Prisma create + select shop.merchantId）
-- 5. 未来如果需要强一致（不允许 null），可以：
--    ALTER TABLE orders MODIFY merchantId VARCHAR(36) NOT NULL;
