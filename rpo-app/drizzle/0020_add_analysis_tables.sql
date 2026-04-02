-- company テーブルに support_status を追加
ALTER TABLE company ADD COLUMN support_status TEXT NOT NULL DEFAULT '支援中';

-- 月別採用目標テーブル
CREATE TABLE IF NOT EXISTS company_monthly_target (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  target_hires INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(company_id, year, month)
);

-- 支援期間ベース目標テーブル
CREATE TABLE IF NOT EXISTS company_case_target (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  case_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  target_hires INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 週次判定基準テーブル (company_id = NULL はグローバルデフォルト)
CREATE TABLE IF NOT EXISTS analysis_criteria (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES company(id) ON DELETE CASCADE,
  week_num INTEGER NOT NULL,
  condition1_metric TEXT NOT NULL,
  condition1_value INTEGER NOT NULL DEFAULT 1,
  condition2_metric TEXT,
  condition2_value INTEGER DEFAULT 0,
  logic TEXT NOT NULL DEFAULT 'OR',
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- デフォルト判定基準の初期データ
INSERT INTO analysis_criteria (id, company_id, week_num, condition1_metric, condition1_value, condition2_metric, condition2_value, logic)
VALUES
  ('default-w1', NULL, 1, '有効応募', 3, NULL, 0, 'OR'),
  ('default-w2', NULL, 2, '面接設定', 2, '面接実施', 1, 'OR'),
  ('default-w3', NULL, 3, '面接設定', 3, NULL, 0, 'OR'),
  ('default-w4', NULL, 4, '内定', 1, NULL, 0, 'OR');
