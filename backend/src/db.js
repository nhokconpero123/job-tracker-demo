import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';

const databasePath = process.env.DATABASE_PATH ?? fileURLToPath(new URL('../applications.db', import.meta.url));
export const db = new Database(databasePath);

db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    position TEXT NOT NULL,
    url TEXT,
    salary TEXT,
    status TEXT NOT NULL CHECK (status IN ('wishlist', 'applied', 'interview', 'offer', 'rejected')),
    appliedDate TEXT,
    interviewDate TEXT,
    followUpDate TEXT,
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`);

export function closeDatabase() {
  if (db.open) db.close();
}
