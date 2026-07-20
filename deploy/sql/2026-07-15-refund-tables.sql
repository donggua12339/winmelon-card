-- ============================================================
-- T1: Refund 表 + CommissionRecord.reversedAt
-- 退款与返佣冲正 - 阶段 1 schema 迁移
--
-- 执行命令：
--   docker exec -i wm-card-mysql-prod mysql -uroot -p<ROOT_PW> wmcard < deploy/sql/2026-07-15-refund-tables.sql
-- ============================================================

-- 1. CommissionRecord 加 reversedAt（返佣冲正时间）
ALTER TABLE commission_records
  ADD COLUMN reversedAt DATETIME(3) NULL AFTER status;

-- 2. 新增 Refund 表
CREATE TABLE IF NOT EXISTS refunds (
  id            VARCHAR(36) NOT NULL,
  refundNo      VARCHAR(32) NOT NULL,
  orderId       VARCHAR(36) NOT NULL,
  merchantId    VARCHAR(36) NULL,
  amount        DECIMAL(12,2) NOT NULL,
  reason        TEXT NOT NULL,
  status        ENUM('PENDING','APPROVED','REJECTED','PAID','FAILED') NOT NULL DEFAULT 'PENDING',
  initiator     ENUM('BUYER','PLATFORM') NOT NULL,
  processedById VARCHAR(36) NULL,
  processedAt   DATETIME(3) NULL,
  rejectedAt    DATETIME(3) NULL,
  rejectReason  TEXT NULL,
  paidAt        DATETIME(3) NULL,
  tradeNo       VARCHAR(128) NULL,
  retryCount    INT NOT NULL DEFAULT 0,
  lastError     TEXT NULL,
  manualPayout  TINYINT(1) NOT NULL DEFAULT 0,
  createdAt     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_refunds_refundNo (refundNo),
  KEY idx_refunds_orderId (orderId),
  KEY idx_refunds_merchantId (merchantId),
  KEY idx_refunds_status (status),
  KEY idx_refunds_createdAt (createdAt),
  CONSTRAINT fk_refunds_order FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 校验：表结构
SHOW COLUMNS FROM refunds;
SHOW COLUMNS FROM commission_records LIKE 'reversedAt';
