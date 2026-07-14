-- ============================================================
-- P0-3 / P1 / P2 一次性迁移：新增 8 张表 + 2 个字段
-- 执行命令：
--   docker exec -i wm-card-mysql-prod mysql -uroot -p<ROOT_PW> wmcard < deploy/sql/2026-07-14-p0-p2-tables.sql
-- ============================================================

-- ============ P0-3 生意罗盘 PageView ============
CREATE TABLE IF NOT EXISTS page_views (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  shopId VARCHAR(36) NOT NULL,
  path VARCHAR(255) NOT NULL,
  ip VARCHAR(64) NOT NULL,
  userAgent VARCHAR(512),
  visitorId VARCHAR(64) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_pageviews_shop FOREIGN KEY (shopId) REFERENCES shops(id) ON DELETE CASCADE,
  INDEX idx_pageviews_shop_created (shopId, createdAt),
  INDEX idx_pageviews_visitor_shop (visitorId, shopId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============ P1-1 平台公告 Article ============
CREATE TABLE IF NOT EXISTS articles (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  type ENUM('ANNOUNCEMENT','AGREEMENT','DISCLAIMER','ALLOWED_GOODS') NOT NULL,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  slug VARCHAR(64) UNIQUE,
  summary VARCHAR(500),
  status ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  sort INT NOT NULL DEFAULT 0,
  publishedAt DATETIME(3),
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_articles_type_status_pub (type, status, publishedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============ P1-2 商户选支付通道 ============
CREATE TABLE IF NOT EXISTS merchant_payment_channels (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  merchantId VARCHAR(36) NOT NULL,
  channelCode VARCHAR(32) NOT NULL,
  isEnabled TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_mpc_merchant FOREIGN KEY (merchantId) REFERENCES merchants(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_mpc_merchant_channel (merchantId, channelCode),
  INDEX idx_mpc_merchant (merchantId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 初始化：为所有现有商户启用全部已可用通道
INSERT INTO merchant_payment_channels (merchantId, channelCode, isEnabled)
SELECT m.id, pc.code, pc.isAvailable
FROM merchants m
CROSS JOIN payment_channels pc
WHERE m.deletedAt IS NULL
ON DUPLICATE KEY UPDATE isEnabled = VALUES(isEnabled);

-- ============ P2-1 邀请码 + 返佣 ============
CREATE TABLE IF NOT EXISTS invite_codes (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  code VARCHAR(16) NOT NULL UNIQUE,
  inviterMerchantId VARCHAR(36) NOT NULL,
  note VARCHAR(255),
  usedCount INT NOT NULL DEFAULT 0,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_invite_inviter FOREIGN KEY (inviterMerchantId) REFERENCES merchants(id) ON DELETE CASCADE,
  INDEX idx_invite_inviter (inviterMerchantId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS commission_records (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  inviterMerchantId VARCHAR(36) NOT NULL,
  sourceMerchantId VARCHAR(36) NOT NULL,
  orderId VARCHAR(36),
  orderNo VARCHAR(32),
  baseAmount DECIMAL(12,2) NOT NULL,
  rate DECIMAL(5,4) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('SETTLED','REVERSED') NOT NULL DEFAULT 'SETTLED',
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_comm_inviter FOREIGN KEY (inviterMerchantId) REFERENCES merchants(id),
  CONSTRAINT fk_comm_source FOREIGN KEY (sourceMerchantId) REFERENCES merchants(id),
  INDEX idx_comm_inviter_created (inviterMerchantId, createdAt),
  INDEX idx_comm_source (sourceMerchantId),
  INDEX idx_comm_order (orderId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- orders 表加 usedInviteCode 字段
ALTER TABLE orders ADD COLUMN usedInviteCode VARCHAR(16);
CREATE INDEX idx_orders_invitecode ON orders(usedInviteCode);

-- ============ P2-2 投诉/工单 ============
CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  ticketNo VARCHAR(32) NOT NULL UNIQUE,
  orderId VARCHAR(36),
  shopId VARCHAR(36) NOT NULL,
  buyerEmail VARCHAR(255) NOT NULL,
  buyerIp VARCHAR(64),
  category ENUM('REFUND','DELIVERY','QUALITY','OTHER') NOT NULL DEFAULT 'OTHER',
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('OPEN','BUYER_REPLIED','MERCHANT_REPLIED','PLATFORM_REPLIED','RESOLVED','AUTO_REFUNDED','CLOSED') NOT NULL DEFAULT 'OPEN',
  priority INT NOT NULL DEFAULT 0,
  lastRepliedAt DATETIME(3),
  lastRepliedByRole VARCHAR(32),
  autoRefundAt DATETIME(3),
  resolvedAt DATETIME(3),
  refundAmount DECIMAL(12,2),
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_ticket_order FOREIGN KEY (orderId) REFERENCES orders(id),
  CONSTRAINT fk_ticket_shop FOREIGN KEY (shopId) REFERENCES shops(id),
  INDEX idx_ticket_shop_status (shopId, status),
  INDEX idx_ticket_status_autorefund (status, autoRefundAt),
  INDEX idx_ticket_buyer (buyerEmail)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ticket_messages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  ticketId VARCHAR(36) NOT NULL,
  senderRole VARCHAR(32) NOT NULL,
  senderId VARCHAR(64),
  senderName VARCHAR(64),
  content TEXT NOT NULL,
  isInternal TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_msg_ticket FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE,
  INDEX idx_msg_ticket_created (ticketId, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============ P2-3 站内信 ============
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  recipientMerchantId VARCHAR(36),
  recipientUserId VARCHAR(64),
  type ENUM('ORDER','WITHDRAWAL','TICKET','SYSTEM','COMMISSION') NOT NULL DEFAULT 'SYSTEM',
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  link VARCHAR(255),
  isRead TINYINT(1) NOT NULL DEFAULT 0,
  readAt DATETIME(3),
  emailSent TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_notif_merchant FOREIGN KEY (recipientMerchantId) REFERENCES merchants(id) ON DELETE CASCADE,
  INDEX idx_notif_merchant_read (recipientMerchantId, isRead, createdAt),
  INDEX idx_notif_user_read (recipientUserId, isRead, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============ merchants 表加冻结字段（P2-2 自动冻结用）============
ALTER TABLE merchants ADD COLUMN frozenReason TEXT;
ALTER TABLE merchants ADD COLUMN frozenAt DATETIME(3);

-- ============ 校验 ============
SELECT 'page_views' AS table_name, COUNT(*) AS cnt FROM page_views
UNION ALL SELECT 'articles', COUNT(*) FROM articles
UNION ALL SELECT 'merchant_payment_channels', COUNT(*) FROM merchant_payment_channels
UNION ALL SELECT 'invite_codes', COUNT(*) FROM invite_codes
UNION ALL SELECT 'commission_records', COUNT(*) FROM commission_records
UNION ALL SELECT 'tickets', COUNT(*) FROM tickets
UNION ALL SELECT 'ticket_messages', COUNT(*) FROM ticket_messages
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications;
