-- ============================================================
-- P0-3 v2 迁移：启用专用 VISITOR_SALT 并重写历史 visitorId
-- ============================================================
-- 背景：
--   旧 visitorId 用 JWT_SECRET 做 salt，JWT 轮换会断历史 UV。
--   新方案：VISITOR_SALT 专用，重写所有 page_views.visitorId。
--
-- 使用方法：
--   1. .env.prod 加 VISITOR_SALT=（新生成的 32+ 字符密钥）
--   2. 执行此脚本（替换 :NEW_SALT 占位符为真实 VISITOR_SALT）
--   3. 重启 API 容器
-- ============================================================

-- ⚠️ 把下面的 :NEW_SALT 替换为 .env.prod 中的 VISITOR_SALT 值
SET @new_salt = 'REPLACE_WITH_VISITOR_SALT_VALUE';

-- 备份旧 visitorId（可选，便于回滚）
CREATE TABLE IF NOT EXISTS page_views_visitor_backup AS
  SELECT id, visitorId AS oldVisitorId FROM page_views WHERE 1=0;
-- 实际备份（如不需要可跳过）
INSERT INTO page_views_visitor_backup (id, oldVisitorId)
  SELECT id, visitorId FROM page_views
  ON DUPLICATE KEY UPDATE oldVisitorId = VALUES(oldVisitorId);

-- 用新 salt 重写 visitorId
-- sha256(ip + '|' + ua + '|' + salt) 取前 16 字符，与代码 computeVisitorId 一致
UPDATE page_views
SET visitorId = SUBSTRING(SHA2(CONCAT_WS('|', ip, COALESCE(userAgent, ''), @new_salt), 256), 1, 16)
WHERE ip IS NOT NULL;

-- 验证
SELECT
  COUNT(*) AS total,
  COUNT(DISTINCT visitorId) AS unique_visitorIds,
  COUNT(DISTINCT id) AS unique_ids
FROM page_views;

-- 老 visitorId 备份保留 7 天后可清理
-- DROP TABLE page_views_visitor_backup;