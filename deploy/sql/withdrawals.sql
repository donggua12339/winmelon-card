USE wmcard;

ALTER TABLE merchants
  ADD COLUMN freezeBalance DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER balance,
  ADD COLUMN totalWithdrawn DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER freezeBalance;

CREATE TABLE IF NOT EXISTS withdrawals (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  merchantId VARCHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  actual DECIMAL(12,2) NOT NULL,
  method VARCHAR(16) NOT NULL,
  accountInfo TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  rejectReason TEXT NULL,
  transferRef VARCHAR(128) NULL,
  processedById VARCHAR(36) NULL,
  processedAt DATETIME(3) NULL,
  requestedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_withdrawals_merchantId (merchantId),
  INDEX idx_withdrawals_status (status),
  INDEX idx_withdrawals_requestedAt (requestedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DESCRIBE withdrawals;
