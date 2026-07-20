-- ============================================================
# 安全加固 sprint 迁移：P1-6 token cookie 化 + P2-8 激活 token
# ============================================================
-- P2-8: activation_tokens 表
CREATE TABLE IF NOT EXISTS activation_tokens (
  id            VARCHAR(36) NOT NULL PRIMARY KEY,
  token         VARCHAR(64) NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL,
  userId        VARCHAR(36) NULL,
  type          VARCHAR(32) NOT NULL DEFAULT 'MERCHANT_APPROVE',
  expiresAt     DATETIME(3) NOT NULL,
  usedAt        DATETIME(3) NULL,
  createdAt     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_activation_email (email),
  INDEX idx_activation_expiresAt (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 验证
SELECT COUNT(*) AS activation_tokens_count FROM activation_tokens;