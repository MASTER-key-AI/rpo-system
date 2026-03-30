/**
 * ローカルのD1 SQLiteデータベースにSQLダンプファイルをインポートするスクリプト
 * Usage: node scripts/import-local-db.mjs
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// .wrangler/state 配下の SQLite ファイルを検索
function findSqliteFile(dir) {
    if (!fs.existsSync(dir)) return null
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            const found = findSqliteFile(full)
            if (found) return found
        } else if (entry.name.endsWith('.sqlite')) {
            return full
        }
    }
    return null
}

const wranglerStateDir = path.join(ROOT, '.wrangler', 'state')
const sqliteFile = findSqliteFile(wranglerStateDir)

if (!sqliteFile) {
    console.error('❌ SQLiteファイルが見つかりません。先に npm run db:migrate:local を実行してください')
    process.exit(1)
}

console.log(`📂 SQLite: ${sqliteFile}`)

const SQL_FILE = 'C:\\Users\\hirot\\OneDrive\\ドキュメント\\rpo-db-full.sql'
if (!fs.existsSync(SQL_FILE)) {
    console.error(`❌ SQLファイルが見つかりません: ${SQL_FILE}`)
    process.exit(1)
}

const sql = fs.readFileSync(SQL_FILE, 'utf-8')
const db = new Database(sqliteFile)

try {
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = OFF')

    // 既存テーブルを全削除
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
    console.log(`🗑️  既存テーブル ${tables.length} 件を削除中...`)
    for (const { name } of tables) {
        db.exec(`DROP TABLE IF EXISTS "${name}"`)
    }

    console.log('⏳ SQLをインポート中...')
    db.exec(sql)
    db.pragma('foreign_keys = ON')
    console.log('✅ インポート完了')
} catch (err) {
    console.error('❌ エラー:', err.message)
    process.exit(1)
} finally {
    db.close()
}
