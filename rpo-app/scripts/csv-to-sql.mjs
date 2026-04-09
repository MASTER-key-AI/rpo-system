import { readFileSync, writeFileSync } from "fs"
import { parse } from "csv-parse/sync"

// CSV読み込み
const csvPath = "C:\\Users\\hirot\\Downloads\\歩留まり　案件名　職種ごと - 企業ごと.csv"
const raw = readFileSync(csvPath)

// BOM除去 + パース
const content = raw.toString("utf-8").replace(/^\uFEFF/, "")
const rows = parse(content, {
  columns: true,
  skip_empty_lines: true,
  relax_quotes: true,
  relax_column_count: true,
})

// 列名確認
console.log("列名:", Object.keys(rows[0]))
console.log("行数:", rows.length)

// ID → case_name のマッピングを生成
const updates = []
for (const row of rows) {
  const id = row["応募者ID"]?.trim()
  const caseName = row["案件名"]?.trim()
  if (!id || !caseName) continue
  // シングルクォートエスケープ
  const escaped = caseName.replace(/'/g, "''")
  updates.push(`UPDATE applicant SET case_name = '${escaped}' WHERE id = '${id}';`)
}

console.log(`UPDATEステートメント数: ${updates.length}`)

// SQLファイルに書き出し
const sql = updates.join("\n")
writeFileSync("scripts/update_case_names.sql", sql, "utf-8")
console.log("scripts/update_case_names.sql に書き出しました")
