/**
 * useApi.js
 * ─────────────────────────────────────────────────────────────
 * React hook that exposes a unified CRUD interface for the current mode.
 *
 * In FLASK mode  → delegates to fetch('/api/...')
 * In BROWSER mode → delegates to workerClient SQL queries
 *
 * Usage:
 *   const api = useApi()
 *   const accounts = await api.get('/api/accounts')
 *   await api.post('/api/accounts', { name, type, balance })
 *   await api.put(`/api/accounts/${id}`, { ...body })
 *   await api.del(`/api/accounts/${id}`)
 *
 * For browser-mode-only raw SQL:
 *   const rows = await api.query('SELECT * FROM accounts')
 *   await api.exec('INSERT INTO accounts (name,type,balance) VALUES (?,?,?)', [n,t,b])
 */

import { useCallback } from 'react'
import { useDatabase } from '@/context/DatabaseContext'
import workerClient from '@/lib/workerClient'

// ── Cents helpers ──────────────────────────────────────────────
// The browser schema stores amounts as INTEGER centavos.
// Flask API stores them as FLOAT reais. These helpers convert.
export const toCents  = (v) => Math.round((parseFloat(v) || 0) * 100)
export const fromCents = (v) => (v ?? 0) / 100

// ── SQL implementations for each REST endpoint ────────────────
async function browserGet(opfsPath, path) {
  const q = (sql, params) => workerClient.query(opfsPath, sql, params)

  // ── accounts ───────────────────────────────────────────────
  if (path === '/api/accounts') {
    const rows = await q('SELECT * FROM accounts ORDER BY name')
    return rows.map(r => ({ ...r, balance: fromCents(r.balance) }))
  }
  if (path.match(/^\/api\/accounts\/(\d+)$/)) {
    const id = +path.split('/')[3]
    const [r] = await q('SELECT * FROM accounts WHERE id=?', [id])
    return r ? { ...r, balance: fromCents(r.balance) } : null
  }

  // ── transactions ───────────────────────────────────────────
  if (path === '/api/transactions') {
    const rows = await q(`
      SELECT t.*, a.name as account_name, a.currency,
             e.display_name as entity_display_name
      FROM transactions t
      LEFT JOIN accounts a ON a.id = t.account_id
      LEFT JOIN entities e ON e.id = t.entity_id
      ORDER BY t.date DESC, t.id DESC
    `)
    return rows.map(r => ({
      ...r,
      amount: fromCents(r.amount),
      raw_amount: fromCents(r.raw_amount),
    }))
  }

  // ── categories ────────────────────────────────────────────
  if (path === '/api/categories') {
    return q('SELECT * FROM categories ORDER BY name')
  }

  // ── tags ─────────────────────────────────────────────────
  if (path === '/api/tags') {
    return q(`
      SELECT t.*, COUNT(DISTINCT tt.transaction_id) as txn_count
      FROM tags t
      LEFT JOIN transaction_tags tt ON tt.tag_id = t.id
      GROUP BY t.id ORDER BY t.name
    `)
  }

  // ── entities ──────────────────────────────────────────────
  if (path === '/api/entities') {
    return q('SELECT * FROM entities ORDER BY name')
  }

  // Fallback → Flask
  console.warn('[useApi browser] unimplemented GET, falling back to Flask:', path)
  return fetch(path).then(r => r.json())
}

async function browserPost(opfsPath, path, body) {
  const exec = (sql, p) => workerClient.exec(opfsPath, sql, p)
  const q    = (sql, p) => workerClient.query(opfsPath, sql, p)

  // ── accounts ───────────────────────────────────────────────
  if (path === '/api/accounts') {
    const balCents = toCents(body.balance)
    await exec(
      'INSERT INTO accounts (name,type,balance,institution,currency) VALUES (?,?,?,?,?)',
      [body.name, body.type || 'bank', balCents, body.institution || '', body.currency || 'BRL']
    )
    const [row] = await q('SELECT * FROM accounts ORDER BY id DESC LIMIT 1')
    return { ...row, balance: fromCents(row.balance) }
  }

  // ── accounts sync ─────────────────────────────────────────
  if (path.match(/^\/api\/accounts\/\d+\/sync$/)) {
    const id = +path.split('/')[3]
    const [{ v }] = await q(
      "SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END),0) AS v FROM transactions WHERE account_id=?",
      [id]
    )
    await exec('UPDATE accounts SET balance=? WHERE id=?', [v, id])
    return { status: 'ok' }
  }

  // ── categories ────────────────────────────────────────────
  if (path === '/api/categories') {
    await exec('INSERT OR IGNORE INTO categories (name,color,icon) VALUES (?,?,?)',
      [body.name, body.color || '#6366f1', body.icon || 'tag'])
    const [row] = await q('SELECT * FROM categories ORDER BY id DESC LIMIT 1')
    return row
  }

  // ── tags ─────────────────────────────────────────────────
  if (path === '/api/tags') {
    const name = (body.name || '').toLowerCase().trim()
    await exec('INSERT OR IGNORE INTO tags (name) VALUES (?)', [name])
    const [row] = await q('SELECT * FROM tags WHERE name=? LIMIT 1', [name])
    return row
  }

  // ── entities ──────────────────────────────────────────────
  if (path === '/api/entities') {
    await exec(
      'INSERT INTO entities (name,type,document,bank,notes,flags,display_name) VALUES (?,?,?,?,?,?,?)',
      [body.name, body.type || 'company', body.document || '', body.bank || '',
       body.notes || '', body.flags || 0, body.display_name || body.name]
    )
    const [row] = await q('SELECT * FROM entities ORDER BY id DESC LIMIT 1')
    return row
  }

  // ── transactions ───────────────────────────────────────────
  if (path === '/api/transactions') {
    const amtCents = toCents(body.amount)
    await exec(
      `INSERT INTO transactions
        (account_id,date,description,category,amount,raw_amount,type,is_manual,entity_id,notes,flags)
       VALUES (?,?,?,?,?,?,?,1,?,?,?)`,
      [body.account_id, body.date, body.description, body.category || null,
       amtCents, amtCents, body.type, body.entity_id || null,
       body.notes || '', body.flags || 0]
    )
    const [row] = await q('SELECT * FROM transactions ORDER BY id DESC LIMIT 1')
    return { ...row, amount: fromCents(row.amount) }
  }

  console.warn('[useApi browser] unimplemented POST, falling back to Flask:', path)
  return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
}

async function browserPut(opfsPath, path, body) {
  const exec = (sql, p) => workerClient.exec(opfsPath, sql, p)

  // ── accounts ───────────────────────────────────────────────
  if (path.match(/^\/api\/accounts\/\d+$/)) {
    const id = +path.split('/')[3]
    const balCents = toCents(body.balance)
    await exec(
      'UPDATE accounts SET name=?,type=?,balance=?,institution=?,currency=?,updated_at=datetime(\'now\') WHERE id=?',
      [body.name, body.type, balCents, body.institution || '', body.currency || 'BRL', id]
    )
    return { status: 'ok' }
  }

  // ── categories ────────────────────────────────────────────
  if (path.match(/^\/api\/categories\/\d+$/)) {
    const id = +path.split('/')[3]
    await exec('UPDATE categories SET name=?,color=?,icon=? WHERE id=?',
      [body.name, body.color, body.icon, id])
    return { status: 'ok' }
  }

  // ── entities ──────────────────────────────────────────────
  if (path.match(/^\/api\/entities\/\d+$/)) {
    const id = +path.split('/')[3]
    await exec(
      'UPDATE entities SET name=?,type=?,document=?,bank=?,notes=?,display_name=? WHERE id=?',
      [body.name, body.type, body.document || '', body.bank || '', body.notes || '',
       body.display_name || body.name, id]
    )
    return { status: 'ok' }
  }

  // ── transactions ───────────────────────────────────────────
  if (path.match(/^\/api\/transactions\/\d+$/)) {
    const id = +path.split('/')[3]
    const amtCents = toCents(body.amount)
    await exec(
      `UPDATE transactions SET account_id=?,date=?,description=?,category=?,amount=?,
       raw_amount=?,type=?,entity_id=?,notes=?,flags=?,updated_at=datetime('now') WHERE id=?`,
      [body.account_id, body.date, body.description, body.category || null,
       amtCents, amtCents, body.type, body.entity_id || null,
       body.notes || '', body.flags || 0, id]
    )
    return { status: 'ok' }
  }

  console.warn('[useApi browser] unimplemented PUT, falling back to Flask:', path)
  return fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
}

async function browserDel(opfsPath, path) {
  const exec = (sql, p) => workerClient.exec(opfsPath, sql, p)

  if (path.match(/^\/api\/accounts\/\d+$/)) {
    const id = +path.split('/')[3]
    await exec('DELETE FROM transactions WHERE account_id=?', [id])
    await exec('DELETE FROM accounts WHERE id=?', [id])
    return { status: 'ok' }
  }
  if (path.match(/^\/api\/categories\/\d+$/)) {
    await exec('DELETE FROM categories WHERE id=?', [+path.split('/')[3]])
    return { status: 'ok' }
  }
  if (path.match(/^\/api\/entities\/\d+$/)) {
    await exec('DELETE FROM entities WHERE id=?', [+path.split('/')[3]])
    return { status: 'ok' }
  }
  if (path.match(/^\/api\/transactions\/\d+$/)) {
    await exec('DELETE FROM transaction_tags WHERE transaction_id=?', [+path.split('/')[3]])
    await exec('DELETE FROM transactions WHERE id=?', [+path.split('/')[3]])
    return { status: 'ok' }
  }
  if (path.match(/^\/api\/tags\/\d+$/)) {
    await exec('DELETE FROM transaction_tags WHERE tag_id=?', [+path.split('/')[3]])
    await exec('DELETE FROM tags WHERE id=?', [+path.split('/')[3]])
    return { status: 'ok' }
  }

  console.warn('[useApi browser] unimplemented DELETE, falling back to Flask:', path)
  return fetch(path, { method: 'DELETE' }).then(r => r.json())
}

// ── Flask helpers ─────────────────────────────────────────────
const flaskFetch = (method, path, body) =>
  fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))

// ── The hook ──────────────────────────────────────────────────
export function useApi() {
  const { mode, MODES, currentDb } = useDatabase()
  const opfsPath = currentDb?.opfsPath ?? null
  const isBrowser = mode === MODES.BROWSER && opfsPath

  const get  = useCallback((path)       => isBrowser ? browserGet(opfsPath, path)       : flaskFetch('GET', path), [isBrowser, opfsPath])
  const post = useCallback((path, body) => isBrowser ? browserPost(opfsPath, path, body) : flaskFetch('POST', path, body), [isBrowser, opfsPath])
  const put  = useCallback((path, body) => isBrowser ? browserPut(opfsPath, path, body)  : flaskFetch('PUT', path, body), [isBrowser, opfsPath])
  const del  = useCallback((path)       => isBrowser ? browserDel(opfsPath, path)        : flaskFetch('DELETE', path), [isBrowser, opfsPath])

  const query = useCallback((sql, params = []) => {
    if (!isBrowser) throw new Error('query() only available in browser mode')
    return workerClient.query(opfsPath, sql, params)
  }, [isBrowser, opfsPath])

  const exec = useCallback((sql, params = []) => {
    if (!isBrowser) throw new Error('exec() only available in browser mode')
    return workerClient.exec(opfsPath, sql, params)
  }, [isBrowser, opfsPath])

  return { get, post, put, del, query, exec, isBrowser, mode, MODES }
}
