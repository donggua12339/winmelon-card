USE wmcard;

-- 1. 给 payments 表加 USDT 字段
ALTER TABLE payments
  ADD COLUMN usdtWallet VARCHAR(64) NULL,
  ADD COLUMN usdtAmount DECIMAL(18,6) NULL,
  ADD COLUMN usdtTxHash VARCHAR(80) NULL,
  ADD COLUMN expiresAt DATETIME NULL,
  ADD INDEX idx_payments_usdtWallet (usdtWallet, status);

-- 2. PaymentStatus 枚举加 EXPIRED
ALTER TABLE payments
  MODIFY COLUMN status ENUM('PENDING','SUCCESS','FAILED','REFUNDED','EXPIRED')
  NOT NULL DEFAULT 'PENDING';

-- 3. 插入 USDT 支付通道（默认不可用，需管理员配置 walletAddress 后启用）
INSERT INTO payment_channels (id, code, name, isAvailable, config, createdAt, updatedAt)
SELECT UUID(), 'usdt', 'USDT (TRC20)', false,
       '{"walletAddress":"","confirmations":19,"cnyToUsdt":"0.14"}',
       NOW(), NOW()
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM payment_channels WHERE code = 'usdt');

-- 4. 验证
DESCRIBE payments;
SELECT code, name, isAvailable FROM payment_channels;
