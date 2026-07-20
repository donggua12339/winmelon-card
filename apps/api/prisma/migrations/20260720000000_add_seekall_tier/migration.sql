-- SeekAll webhook: Product 表加 seekallTier 字段
-- 标记此商品为 SeekAll 会员卡商品(trial/monthly/lifetime),非 SeekAll 商品留空

ALTER TABLE `products`
  ADD COLUMN `seekallTier` ENUM('TRIAL', 'MONTHLY', 'LIFETIME') NULL;
