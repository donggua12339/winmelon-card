-- ============================================================
-- P1-1 + P1-5 迁移：User 表加 tokenEpoch 字段 + merchantId 去唯一约束
-- 执行命令：
--   docker exec -i wm-card-mysql-prod mysql -uroot -p<ROOT_PW> wmcard < deploy/sql/2026-07-14-user-token-epoch.sql
-- ============================================================

-- P1-1: 加 tokenEpoch 字段（默认 0），用于改密后使旧 refresh token 失效
ALTER TABLE users ADD COLUMN tokenEpoch INT NOT NULL DEFAULT 0;

-- P1-5: 删除 merchantId 唯一索引（允许一个商户多个用户/STAFF）
-- 注意：merchantId 是 FK，MySQL 不允许直接删被 FK 使用的唯一索引
-- 解决：先加普通索引，再删唯一索引（MySQL 会用普通索引替代供 FK 使用）

-- 1. 先加普通索引（如果已存在会报错，可忽略）
CREATE INDEX users_merchantId_idx ON users(merchantId);

-- 2. 再删唯一索引
ALTER TABLE users DROP INDEX users_merchantId_key;

-- 校验
SHOW INDEX FROM users WHERE Column_name = 'merchantId';
SELECT id, username, role, merchantId, tokenEpoch FROM users LIMIT 5;
