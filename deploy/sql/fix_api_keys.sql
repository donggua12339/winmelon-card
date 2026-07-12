USE wmcard;

DROP TABLE IF EXISTS api_keys;

CREATE TABLE api_keys (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  `key` VARCHAR(64) NOT NULL,
  keyHint VARCHAR(16) NOT NULL,
  name VARCHAR(64) NOT NULL,
  merchantId VARCHAR(36) NOT NULL,
  scopes VARCHAR(255) NOT NULL DEFAULT 'read,write',
  rateLimitPerMin INT NOT NULL DEFAULT 60,
  lastUsedAt DATETIME NULL,
  expiresAt DATETIME NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revokedAt DATETIME NULL,
  UNIQUE KEY uk_api_keys_key (`key`),
  INDEX idx_api_keys_merchantId (merchantId),
  CONSTRAINT fk_api_keys_merchant FOREIGN KEY (merchantId) REFERENCES merchants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DESCRIBE api_keys;
