import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'tracker.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

export function initDb(): void {
  // Create a simple smoke test table to prove DB works
  db.exec(`
    CREATE TABLE IF NOT EXISTS smoke_test (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert a test row if table is empty
  const count = db.prepare('SELECT COUNT(*) as count FROM smoke_test').get() as { count: number };
  if (count.count === 0) {
    db.prepare('INSERT INTO smoke_test DEFAULT VALUES').run();
  }

  console.log(`[db] SQLite initialized at ${DB_PATH}`);
}
