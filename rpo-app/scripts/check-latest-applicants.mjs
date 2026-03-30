import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function findSqliteFile(dir) {
    if (!fs.existsSync(dir)) return null;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const found = findSqliteFile(full);
            if (found) return found;
        } else if (entry.name.endsWith('.sqlite')) {
            return full;
        }
    }
    return null;
}

const sqliteFile = findSqliteFile(path.join(ROOT, '.wrangler', 'state'));
if (!sqliteFile) {
    console.error('SQLite file not found');
    process.exit(1);
}

const db = new Database(sqliteFile);
console.log("=== Latest 5 Applicants ===");
const applicants = db.prepare(`SELECT id, name, company_id, email, applied_at, created_at, source_gmail_message_id FROM applicant ORDER BY applied_at DESC LIMIT 5`).all();

applicants.forEach(app => {
    // applied_at is in seconds in Drizzle mode: "timestamp"
    const appliedDate = app.applied_at ? new Date(app.applied_at * 1000).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : null;
    const createdDate = app.created_at ? new Date(app.created_at * 1000).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : null;
    console.log(`- ${app.name} (${app.email})`);
    console.log(`  Applied: ${appliedDate}`);
    console.log(`  Created: ${createdDate}`);
    console.log(`  Gmail ID: ${app.source_gmail_message_id}`);
    console.log(`  ID: ${app.id}`);
});
db.close();
