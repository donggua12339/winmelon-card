USE wmcard;

ALTER TABLE shops
  ADD COLUMN customDomain VARCHAR(255) NULL UNIQUE AFTER isOnline,
  ADD COLUMN domainVerified BOOLEAN NOT NULL DEFAULT FALSE AFTER customDomain,
  ADD COLUMN domainVerifyToken VARCHAR(64) NULL AFTER domainVerified,
  ADD COLUMN domainVerifiedAt DATETIME(3) NULL AFTER domainVerifyToken,
  ADD INDEX idx_shops_customDomain (customDomain);

DESCRIBE shops;