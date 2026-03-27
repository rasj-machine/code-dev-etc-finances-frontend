/**
 * sqliteWorker.js
 * ─────────────────────────────────────────────────────────────
 * Runs @sqlite.org/sqlite-wasm inside a Web Worker.
 * All SQLite operations (including OPFS) happen here, off the
 * main thread,  so the UI never blocks.
 *
 * Message protocol  (main → worker):
 *   { id, type, payload }
 * Response:
 *   { id, ok, result?, error? }
 *
 * Types:
 *   INIT           – load the wasm module (must be first)
 *   OPEN_DB        – { opfsPath }  open (or create) an OPFS db
 *   EXEC           – { opfsPath, sql, params? }  run DML (returns { changes })
 *   QUERY          – { opfsPath, sql, params? }  SELECT (returns rows[])
 *   IMPORT_BYTES   – { opfsPath, bytes: Uint8Array }  load existing .db bytes into OPFS
 *   EXPORT_BYTES   – { opfsPath }  export OPFS db as Uint8Array
 *   CLOSE_DB       – { opfsPath }  close and unregister
 *   SUMMARY        – { opfsPath }  returns { balance, accounts, transactions, lastDate }
 *   INIT_SCHEMA    – { opfsPath }  create all tables if not existing
 */

import sqlite3InitModule from '@sqlite.org/sqlite-wasm'

let sqlite3 = null
// Map of opfsPath → OpfsDb instance
const openDbs = new Map()

async function ensureSqlite() {
  if (sqlite3) return
  sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} })
}

function getDb(opfsPath) {
  if (!openDbs.has(opfsPath)) throw new Error(`DB not open: ${opfsPath}`)
  return openDbs.get(opfsPath)
}

function rowsFromStmt(db, sql, params = []) {
  const rows = []
  db.exec({ sql, bind: params, rowMode: 'object', callback: row => rows.push({ ...row }) })
  return rows
}

const SCHEMA_SQL = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, type TEXT NOT NULL,
  balance INTEGER DEFAULT 0, currency TEXT DEFAULT 'BRL',
  institution TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, type TEXT DEFAULT 'company',
  document TEXT, bank TEXT, notes TEXT, flags INTEGER DEFAULT 0,
  display_name TEXT, exclude_from_reports INTEGER DEFAULT 0,
  original_entity_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE, color TEXT DEFAULT '#6366f1', icon TEXT DEFAULT 'tag',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER, date TEXT NOT NULL, description TEXT NOT NULL,
  category TEXT, amount INTEGER NOT NULL DEFAULT 0,
  raw_amount INTEGER DEFAULT 0, type TEXT NOT NULL,
  is_manual INTEGER DEFAULT 0, external_uid TEXT,
  entity_id INTEGER, raw_entity_id INTEGER,
  conciliation_status INTEGER DEFAULT 0,
  notes TEXT, flags INTEGER DEFAULT 0,
  recurring_id INTEGER, raw_description TEXT,
  liquidation_date TEXT, destination_account_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);
CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id INTEGER NOT NULL, tag_id INTEGER NOT NULL,
  PRIMARY KEY (transaction_id, tag_id)
);
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO system_config (key,value) VALUES ('redaction_enabled','0');
INSERT OR IGNORE INTO system_config (key,value) VALUES ('cents_migrated','1');
`

const DEFAULT_CATEGORIES = [
  ['Alimentação','#f59e0b'],['Transporte','#06b6d4'],['Moradia','#8b5cf6'],
  ['Saúde','#22c55e'],['Educação','#3b82f6'],['Lazer','#ec4899'],
  ['Assinaturas','#6366f1'],['Salário','#10b981'],['Investimento','#0ea5e9'],
  ['Boleto','#ef4444'],['Outros','#a1a1aa'],['Pix Enviado','#02dba6'],
  ['Pix Recebido','#d911b4'],['Fatura Cartão','#2135f1'],['Saque','#7f67ec'],
]

// ── Message handler ──────────────────────────────────────────
self.onmessage = async ({ data }) => {
  const { id, type, payload = {} } = data
  const reply = (result, error) => self.postMessage({ id, ok: !error, result, error })

  try {
    switch (type) {

      case 'INIT': {
        await ensureSqlite()
        reply({ version: sqlite3.version.libVersion })
        break
      }

      case 'OPEN_DB': {
        await ensureSqlite()
        const { opfsPath } = payload
        if (!openDbs.has(opfsPath)) {
          const db = new sqlite3.oo1.OpfsDb(opfsPath, 'c')
          openDbs.set(opfsPath, db)
        }
        reply({ opfsPath })
        break
      }

      case 'INIT_SCHEMA': {
        const db = getDb(payload.opfsPath)
        db.exec(SCHEMA_SQL)
        // Seed categories
        for (const [name, color] of DEFAULT_CATEGORIES) {
          db.exec({ sql: 'INSERT OR IGNORE INTO categories (name,color) VALUES (?,?)', bind: [name, color] })
        }
        reply({ ok: true })
        break
      }

      case 'IMPORT_BYTES': {
        await ensureSqlite()
        const { opfsPath, bytes } = payload
        // Write bytes to OPFS via the OPFS Access Handle Pool VFS
        if (openDbs.has(opfsPath)) {
          openDbs.get(opfsPath).close()
          openDbs.delete(opfsPath)
        }
        // Use sqlite3.capi to deserialize
        const p = sqlite3.wasm.allocFromTypedArray(bytes)
        const db = new sqlite3.oo1.OpfsDb(opfsPath, 'c')
        const rc = sqlite3.capi.sqlite3_deserialize(
          db.pointer, 'main', p, bytes.length, bytes.length,
          sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
          sqlite3.capi.SQLITE_DESERIALIZE_RESIZEDB
        )
        if (rc !== 0) throw new Error(`sqlite3_deserialize failed: ${rc}`)
        openDbs.set(opfsPath, db)
        reply({ opfsPath })
        break
      }

      case 'EXPORT_BYTES': {
        const db = getDb(payload.opfsPath)
        const byteArray = sqlite3.capi.sqlite3_js_db_export(db.pointer)
        // Single reply with buffer transfer for zero-copy (no double-send)
        self.postMessage({ id, ok: true, result: { bytes: byteArray } }, [byteArray.buffer])
        return
      }

      case 'EXEC': {
        const db = getDb(payload.opfsPath)
        db.exec({ sql: payload.sql, bind: payload.params || [] })
        const changes = sqlite3.capi.sqlite3_changes(db.pointer)
        reply({ changes })
        break
      }

      case 'QUERY': {
        const db = getDb(payload.opfsPath)
        const rows = rowsFromStmt(db, payload.sql, payload.params || [])
        reply({ rows })
        break
      }

      case 'SUMMARY': {
        const db = getDb(payload.opfsPath)
        const balance = rowsFromStmt(db, 'SELECT COALESCE(SUM(balance),0) AS v FROM accounts')[0]?.v ?? 0
        const accounts = rowsFromStmt(db, 'SELECT COUNT(*) AS v FROM accounts')[0]?.v ?? 0
        const transactions = rowsFromStmt(db, 'SELECT COUNT(*) AS v FROM transactions')[0]?.v ?? 0
        const lastDate = rowsFromStmt(db, 'SELECT MAX(date) AS v FROM transactions')[0]?.v ?? null
        const ym = new Date().toISOString().slice(0,7)
        const income = rowsFromStmt(db, "SELECT COALESCE(SUM(amount),0) AS v FROM transactions WHERE type='income' AND date LIKE ?", [ym+'%'])[0]?.v ?? 0
        const expense = rowsFromStmt(db, "SELECT COALESCE(SUM(amount),0) AS v FROM transactions WHERE type='expense' AND date LIKE ?", [ym+'%'])[0]?.v ?? 0
        const versionRow = rowsFromStmt(db, "SELECT value AS v FROM system_config WHERE key='db_version'")[0]
        const db_version = versionRow?.v ?? '1.0.0'
        reply({ balance, accounts, transactions, lastDate, month_income: income, month_expense: expense, db_version })
        break
      }

      case 'RUNNING_TOTAL': {
        // Window function: running balance per day
        const db = getDb(payload.opfsPath)
        const rows = rowsFromStmt(db, `
          SELECT date,
            SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS daily_in,
            SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS daily_out,
            SUM(CASE WHEN type='income' THEN amount ELSE -amount END)
              OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
          FROM transactions
          GROUP BY date
          ORDER BY date
        `)
        reply({ rows })
        break
      }

      case 'CLOSE_DB': {
        if (openDbs.has(payload.opfsPath)) {
          openDbs.get(payload.opfsPath).close()
          openDbs.delete(payload.opfsPath)
        }
        reply({ ok: true })
        break
      }

      default:
        reply(null, `Unknown message type: ${type}`)
    }
  } catch (err) {
    reply(null, err.message || String(err))
  }
}
