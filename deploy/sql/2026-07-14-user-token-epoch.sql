-- ============================================================
-- P1-1 + P1-5 迁移：User 表加 tokenEpoch 字段 + merchantId 去唯一约束
-- 执行命令：
--   docker exec -i wm-card-mysql-prod mysql -uroot -p<ROOT_PW> wmcard < deploy/sql/2026-07-14-user-token-epoch.sql
-- ============================================================

-- P1-1: 加 tokenEpoch 字段（默认 0），用于改密后使旧 refresh token 失效
ALTER TABLE users ADD COLUMN tokenEpoch INT NOT NULL DEFAULT 0;

-- P1-5: 删除 merchantId 唯一索引（允许一个商户多个用户/STAFF）
-- 先查索引名（Prisma 生成的唯一索引名通常是 users_merchantId_key）
-- 如果索引名不同，请用 SHOW INDEX FROM users WHERE Column_name = 'merchantId'; 查
ALTER TABLE users DROP INDEX users_merchantId_key;

-- 加普通索引（查询商户下所有用户用）
CREATE INDEX users_merchantId_idx ON users(merchantId);

-- 校验
DESCRIBE users;
SHOW INDEX FROM users WHERE Column_name = 'merchantId';
