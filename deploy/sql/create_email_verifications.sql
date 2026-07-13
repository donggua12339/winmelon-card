USE wmcard;

CREATE TABLE IF NOT EXISTS email_verifications (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  `code` VARCHAR(8) NOT NULL,
  `type` VARCHAR(32) NOT NULL,
  expiresAt DATETIME(3) NOT NULL,
  usedAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_email_verifications_email_type (email, `type`),
  INDEX idx_email_verifications_expiresAt (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DESCRIBE email_verifications;