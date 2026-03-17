-- company_group テーブル新設
CREATE TABLE `company_group` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now'))
);

CREATE UNIQUE INDEX `company_group_name_unique` ON `company_group` (`name`);

-- company テーブルに group_id カラム追加
ALTER TABLE `company` ADD COLUMN `group_id` text REFERENCES `company_group`(`id`) ON DELETE SET NULL;

-- 初期データ: エニタイムグループ作成 + 該当企業の group_id 設定
INSERT INTO `company_group` (`id`, `name`) VALUES ('group_anytime', 'エニタイム');

UPDATE `company` SET `group_id` = 'group_anytime' WHERE `name` LIKE 'エニタイム%' AND `name` != 'エニタイム';
