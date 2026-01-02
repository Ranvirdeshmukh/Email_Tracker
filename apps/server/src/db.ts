import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Types
export interface Email {
  id: string;
  recipient: string;
  subject: string | null;
  sender: string | null;
  created_at: string;
}

export interface Open {
  id: number;
  email_id: string;
  opened_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface EmailWithOpens extends Email {
  opens: Open[];
  open_count: number;
}

// Database setup
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'tracker.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

export function initDb(): void {
  // Create emails table
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      subject TEXT,
      sender TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create opens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS opens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id TEXT NOT NULL,
      opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY (email_id) REFERENCES emails(id)
    )
  `);

  // Create index for faster open lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_opens_email_id ON opens(email_id)
  `);

  console.log(`[db] SQLite initialized at ${DB_PATH}`);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a short, URL-safe tracking ID
 */
export function generateTrackingId(): string {
  return crypto.randomBytes(8).toString('hex'); // 16 character hex string
}

/**
 * Create a new tracked email
 */
export function createEmail(data: {
  recipient: string;
  subject?: string;
  sender?: string;
}): Email {
  const id = generateTrackingId();
  
  const stmt = db.prepare(`
    INSERT INTO emails (id, recipient, subject, sender)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(id, data.recipient, data.subject || null, data.sender || null);
  
  return getEmailById(id)!;
}

/**
 * Get email by ID
 */
export function getEmailById(id: string): Email | null {
  const stmt = db.prepare('SELECT * FROM emails WHERE id = ?');
  return stmt.get(id) as Email | null;
}

/**
 * Get email with all its opens
 */
export function getEmailWithOpens(id: string): EmailWithOpens | null {
  const email = getEmailById(id);
  if (!email) return null;

  const opens = db.prepare('SELECT * FROM opens WHERE email_id = ? ORDER BY opened_at DESC').all(id) as Open[];
  
  return {
    ...email,
    opens,
    open_count: opens.length,
  };
}

/**
 * Get all emails with open counts
 */
export function getAllEmails(): (Email & { open_count: number })[] {
  const stmt = db.prepare(`
    SELECT 
      e.*,
      COUNT(o.id) as open_count
    FROM emails e
    LEFT JOIN opens o ON e.id = o.email_id
    GROUP BY e.id
    ORDER BY e.created_at DESC
  `);
  
  return stmt.all() as (Email & { open_count: number })[];
}

/**
 * Record an email open event
 * Deduplicates opens within 60 seconds from the same IP to avoid counting
 * multiple image loads as separate opens
 */
export function recordOpen(data: {
  emailId: string;
  ipAddress?: string;
  userAgent?: string;
}): Open | null {
  // First verify the email exists
  const email = getEmailById(data.emailId);
  if (!email) return null;

  // Check for recent opens from the same IP (within 60 seconds)
  // This prevents counting multiple image loads as separate opens
  const recentOpen = db.prepare(`
    SELECT * FROM opens 
    WHERE email_id = ? 
      AND ip_address = ? 
      AND datetime(opened_at) > datetime('now', '-60 seconds')
    LIMIT 1
  `).get(data.emailId, data.ipAddress || null) as Open | undefined;

  if (recentOpen) {
    console.log(`[db] Skipping duplicate open for ${data.emailId} from ${data.ipAddress}`);
    return recentOpen; // Return existing open instead of creating duplicate
  }

  const stmt = db.prepare(`
    INSERT INTO opens (email_id, ip_address, user_agent, opened_at)
    VALUES (?, ?, ?, datetime('now'))
  `);
  
  const result = stmt.run(data.emailId, data.ipAddress || null, data.userAgent || null);
  
  // Return the created open
  const openStmt = db.prepare('SELECT * FROM opens WHERE id = ?');
  return openStmt.get(result.lastInsertRowid) as Open;
}

/**
 * Get opens for an email
 */
export function getOpensForEmail(emailId: string): Open[] {
  const stmt = db.prepare('SELECT * FROM opens WHERE email_id = ? ORDER BY opened_at DESC');
  return stmt.all(emailId) as Open[];
}

/**
 * Get stats overview
 */
export function getStats(): {
  total_emails: number;
  total_opens: number;
  emails_opened: number;
  open_rate: number;
} {
  const totalEmails = (db.prepare('SELECT COUNT(*) as count FROM emails').get() as { count: number }).count;
  const totalOpens = (db.prepare('SELECT COUNT(*) as count FROM opens').get() as { count: number }).count;
  const emailsOpened = (db.prepare('SELECT COUNT(DISTINCT email_id) as count FROM opens').get() as { count: number }).count;
  
  return {
    total_emails: totalEmails,
    total_opens: totalOpens,
    emails_opened: emailsOpened,
    open_rate: totalEmails > 0 ? Math.round((emailsOpened / totalEmails) * 100) : 0,
  };
}
