/**
 * dataProvider.js
 * ─────────────────────────────────────────────────────────────
 * Abstraction layer over two back-ends:
 *
 *   'flask'   → calls fetch('/api/…') as before (Self-Hosted / Cloud)
 *   'browser' → routes to the SQLite Wasm Worker via workerClient
 *
 * Both providers implement the same interface so React components
 * don't need to know which mode is active.
 *
 * The active provider is stored in localStorage so it survives page reloads.
 *
 * ────────────────────────────────────────────────
 * Provider interface:
 *   get(path)                    → json
 *   post(path, body)             → json
 *   put(path, body)              → json
 *   del(path)                    → json
 *   patch(path, body)            → json
 *   // Browser-only helpers:
 *   execSql(sql, params?)        → { changes }
 *   querySql(sql, params?)       → rows[]
 *   getSummary()                 → { balance, accounts, transactions, ... }
 *   runningTotal()               → rows[]
 * ────────────────────────────────────────────────
 */

import workerClient from './workerClient'

// ── Mode helpers ─────────────────────────────────────────────
export const MODES = { FLASK: 'flask', BROWSER: 'browser' }

export function getStoredMode() {
  return localStorage.getItem('dataMode') || MODES.FLASK
}

export function setStoredMode(mode) {
  localStorage.setItem('dataMode', mode)
}

export function getStoredOpfsPath() {
  return localStorage.getItem('activeOpfsPath') || null
}

export function setStoredOpfsPath(path) {
  if (path) localStorage.setItem('activeOpfsPath', path)
  else localStorage.removeItem('activeOpfsPath')
}

// ── Flask Provider ────────────────────────────────────────────
function makeFlaskProvider() {
  const base = async (method, path, body) => {
    const opts = {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }
    const r = await fetch(path, opts)
    return r.ok ? r.json() : r.json().then(e => Promise.reject(e))
  }

  return {
    mode: MODES.FLASK,
    get:   (path)        => base('GET', path),
    post:  (path, body)  => base('POST', path, body),
    put:   (path, body)  => base('PUT', path, body),
    del:   (path)        => base('DELETE', path),
    patch: (path, body)  => base('PATCH', path, body),
    // Not supported in flask mode (use /api/ instead)
    execSql: () => Promise.reject(new Error('execSql only in browser mode')),
    querySql: () => Promise.reject(new Error('querySql only in browser mode')),
    getSummary: () => Promise.reject(new Error('getSummary only in browser mode')),
    runningTotal: () => Promise.reject(new Error('runningTotal only in browser mode')),
    isReady: () => true,
  }
}

// ── Browser Provider ──────────────────────────────────────────
function makeBrowserProvider(opfsPath) {
  let ready = false

  const init = async () => {
    if (ready) return
    await workerClient.init()
    await workerClient.openDb(opfsPath)
    ready = true
  }

  /**
   * The browser provider does NOT implement the full REST API.
   * It provides raw SQL access for the new browser-local components.
   * For gradual migration, unimplemented routes will return empty/default.
   */
  return {
    mode: MODES.BROWSER,
    opfsPath,

    async isReady() {
      await init()
      return true
    },

    // Raw SQL
    async execSql(sql, params = []) {
      await init()
      return workerClient.exec(opfsPath, sql, params)
    },

    async querySql(sql, params = []) {
      await init()
      return workerClient.query(opfsPath, sql, params)
    },

    async getSummary() {
      await init()
      return workerClient.summary(opfsPath)
    },

    async runningTotal() {
      await init()
      return workerClient.runningTotal(opfsPath)
    },

    async initSchema() {
      await init()
      return workerClient.initSchema(opfsPath)
    },

    // REST-like helpers (implemented via SQL)
    async get(path) {
      await init()
      if (path === '/api/accounts') {
        return workerClient.query(opfsPath, 'SELECT * FROM accounts ORDER BY name')
      }
      if (path === '/api/transactions') {
        return workerClient.query(opfsPath,
          'SELECT t.*, a.name as account_name FROM transactions t LEFT JOIN accounts a ON t.account_id=a.id ORDER BY t.date DESC, t.id DESC'
        )
      }
      if (path === '/api/categories') {
        return workerClient.query(opfsPath, 'SELECT * FROM categories ORDER BY name')
      }
      if (path === '/api/tags') {
        return workerClient.query(opfsPath, 'SELECT t.*, COUNT(DISTINCT tt.transaction_id) as txn_count FROM tags t LEFT JOIN transaction_tags tt ON tt.tag_id=t.id GROUP BY t.id ORDER BY t.name')
      }
      if (path === '/api/entities') {
        return workerClient.query(opfsPath, 'SELECT * FROM entities ORDER BY name')
      }
      // fallback: fetch from Flask (allows gradual migration)
      return fetch(path).then(r => r.json())
    },

    async post(path, body) {
      await init()
      // Fallback to Flask for unimplemented writes
      return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
    },

    async put(path, body) {
      await init()
      return fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
    },

    async del(path) {
      await init()
      return fetch(path, { method: 'DELETE' }).then(r => r.json())
    },

    async patch(path, body) {
      await init()
      return fetch(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
    },
  }
}

// ── Factory ───────────────────────────────────────────────────
let _currentProvider = null

export function createProvider(mode, opfsPath = null) {
  if (mode === MODES.BROWSER && opfsPath) {
    _currentProvider = makeBrowserProvider(opfsPath)
  } else {
    _currentProvider = makeFlaskProvider()
  }
  return _currentProvider
}

export function getProvider() {
  if (!_currentProvider) {
    // Bootstrap from localStorage
    const mode = getStoredMode()
    const path = getStoredOpfsPath()
    _currentProvider = createProvider(mode, path)
  }
  return _currentProvider
}

/** Convenience: does the current browser support File System Access API? */
export function hasFsAccess() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

/** Convenience: are SharedArrayBuffer / OPFS available? */
export function hasOpfs() {
  try {
    const _ = new SharedArrayBuffer(1)
    return typeof navigator?.storage?.getDirectory === 'function'
  } catch {
    return false
  }
}
