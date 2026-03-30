-- Fix sheet destination for hearts branch companies.
-- Request: "株式会社ハーツ羽曳野支店" / "株式会社ハーツ堺支店"
-- should open:
-- https://docs.google.com/spreadsheets/d/11h3bQXaU0oTIeMTlUrVUpr5qZyx1cadP0UV10RVUhhs/edit?gid=465742923

UPDATE `company_sheet`
SET
  `spreadsheet_id` = '11h3bQXaU0oTIeMTlUrVUpr5qZyx1cadP0UV10RVUhhs',
  `gid` = 465742923
WHERE `company_id` IN (
  SELECT `id`
  FROM `company`
  WHERE
    `name` IN (
      '株式会社ハーツ羽曳野支店',
      '株式会社ハーツ堺支店',
      'ハーツ羽曳野支店',
      'ハーツ堺支店'
    )
    OR (
      `name` LIKE '%ハーツ%'
      AND (`name` LIKE '%羽曳野%' OR `name` LIKE '%堺%支店%')
      AND `name` NOT LIKE '%東京%ハーツ%'
    )
);
