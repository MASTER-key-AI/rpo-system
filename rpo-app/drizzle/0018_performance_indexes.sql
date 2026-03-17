-- パフォーマンス改善: 頻出クエリ向けインデックス追加

-- 歩留まり集計 (getCompanyYields): company_id でGROUP BY + JOIN
CREATE INDEX IF NOT EXISTS `idx_applicants_company_id` ON `applicant` (`company_id`);
CREATE INDEX IF NOT EXISTS `idx_applicants_company_applied` ON `applicant` (`company_id`, `applied_at` DESC);

-- 架電管理: applicant_id でJOIN + is_connected でフィルタ
CREATE INDEX IF NOT EXISTS `idx_call_logs_applicant_id` ON `call_log` (`applicant_id`);
CREATE INDEX IF NOT EXISTS `idx_call_logs_applicant_connected` ON `call_log` (`applicant_id`, `is_connected`);

-- グルーピング: group_id でJOIN
CREATE INDEX IF NOT EXISTS `idx_companies_group_id` ON `company` (`group_id`);

-- その他FK列
CREATE INDEX IF NOT EXISTS `idx_interviews_applicant_id` ON `interview` (`applicant_id`);
CREATE INDEX IF NOT EXISTS `idx_company_sheets_company_id` ON `company_sheet` (`company_id`);
CREATE INDEX IF NOT EXISTS `idx_company_aliases_company_id` ON `company_alias` (`company_id`);
