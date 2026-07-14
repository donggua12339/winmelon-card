-- ============================================================
-- P0-2 迁移：为现有 API Key 填充 keyHash 字段
-- 执行命令：
--   docker exec -i wm-card-mysql-prod mysql -uroot -p<ROOT_PW> wmcard < deploy/sql/2026-07-14-api-key-hash.sql
--
-- 3 天过渡期后执行 cleanup：
--   ALTER TABLE api_keys DROP COLUMN key;
--   ALTER TABLE api_keys MODIFY keyHash VARCHAR(64) NOT NULL;
-- ============================================================

-- 1. 加 keyHash 列（sha256 hex = 64 字符，nullable + unique 兼容过渡期）
ALTER TABLE api_keys ADD COLUMN keyHash VARCHAR(64) NULL UNIQUE;

-- 2. 为所有现有 key 填充 keyHash（SHA-256 hex，与 Node.js crypto.createHash('sha256').update(key, 'utf8').digest('hex') 一致）
UPDATE api_keys
SET keyHash = SHA2(`key`, 256)
WHERE keyHash IS NULL AND `key` IS NOT NULL;

-- 3. 校验：所有活跃 key 都有 keyHash
SELECT id, name, keyHint,
       CASE WHEN keyHash IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS hash_status
FROM api_keys
WHERE isActive = 1;

-- 4. 3 天后执行清理（单独的 cleanup 文件）：
-- ALTER TABLE api_keys DROP INDEX api_keys_key_key;
-- ALTER TABLE api_keys DROP COLUMN `key`;
-- ALTER TABLE api_keys MODIFY keyHash VARCHAR(64) NOT NULL;
-- ALTER TABLE api_keys ADD UNIQUE INDEX api_keys_keyHash_key (keyHash);
