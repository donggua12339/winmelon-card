-- ============================================================
-- T3 + V4-7 迁移：退款重试字段 + 财务对账日志表
-- ============================================================
-- T3-1: refunds 加重试/告警/USDT 字段
ALTER TABLE refunds
  ADD COLUMN lastErrorAt         DATETIME(3) NULL,
  ADD COLUMN nextRetryAt         DATETIME(3) NULL,
  ADD COLUMN alertSentAt         DATETIME(3) NULL,
  ADD COLUMN usdtTxHash          VARCHAR(128) NULL,
  ADD COLUMN usdtSenderWallet    VARCHAR(128) NULL,
  ADD COLUMN usdtReceiverWallet  VARCHAR(128) NULL;

-- T3-1: 重试索引
ALTER TABLE refunds
  ADD INDEX idx_refunds_status_nextRetryAt (status, nextRetryAt);

-- V4-7: 财务对账差异日志
CREATE TABLE IF NOT EXISTS finance_reconciliation_logs (
  id                VARCHAR(36) NOT NULL PRIMARY KEY,
  snapshotAt        DATETIME(3) NOT NULL,
  type              VARCHAR(32) NOT NULL,
  description       TEXT NOT NULL,
  diffAmount        DECIMAL(18,4) NOT NULL,
  severity          VARCHAR(16) NOT NULL DEFAULT 'WARNING',
  notifiedAt        DATETIME(3) NULL,
  resolved          TINYINT(1) NOT NULL DEFAULT 0,
  resolvedAt        DATETIME(3) NULL,
  resolvedBy        VARCHAR(36) NULL,
  resolutionNote    TEXT NULL,
  createdAt         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_finance_logs_snapshotAt (snapshotAt),
  INDEX idx_finance_logs_resolved_severity (resolved, severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 验证
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='refunds' AND column_name IN ('lastErrorAt','nextRetryAt','alertSentAt','usdtTxHash','usdtSenderWallet','usdtReceiverWallet')) AS refund_cols_added,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='finance_reconciliation_logs') AS finance_logs_table;