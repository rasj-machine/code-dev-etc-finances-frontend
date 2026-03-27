/**
 * workerClient.js
 * ─────────────────────────────────────────────────────────────
 * Singleton that manages the SQLite Web Worker.
 * Provides a Promise-based RPC interface to all worker message types.
 *
 * Usage:
 *   import workerClient from '@/lib/workerClient'
 *   await workerClient.init()
 *   const rows = await workerClient.query(opfsPath, 'SELECT * FROM accounts')
 */

let worker = null
let seq = 0
const pending = new Map() // id → { resolve, reject }

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/sqliteWorker.js', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      const { id, ok, result, error } = data
      const p = pending.get(id)
      if (!p) return
      pending.delete(id)
      ok ? p.resolve(result) : p.reject(new Error(error))
    }
    worker.onerror = (e) => console.error('[SqliteWorker]', e)
  }
  return worker
}

function send(type, payload = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, type, payload })
  })
}

let initialized = false

const workerClient = {
  async init() {
    if (initialized) return
    await send('INIT')
    initialized = true
  },

  async openDb(opfsPath) {
    return send('OPEN_DB', { opfsPath })
  },

  async initSchema(opfsPath) {
    return send('INIT_SCHEMA', { opfsPath })
  },

  /** Load raw .db bytes from user disk into an OPFS path */
  async importBytes(opfsPath, bytes) {
    return send('IMPORT_BYTES', { opfsPath, bytes })
  },

  /** Export the OPFS db as Uint8Array (to save back to user disk) */
  async exportBytes(opfsPath) {
    const result = await send('EXPORT_BYTES', { opfsPath })
    // Worker sends { bytes: Uint8Array } — unwrap so callers get the raw buffer
    const raw = result?.bytes
    if (raw instanceof Uint8Array) return raw
    if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
    // Fallback: result itself might be the Uint8Array (future-proof)
    if (result instanceof Uint8Array) return result
    return new Uint8Array(0)
  },

  async exec(opfsPath, sql, params = []) {
    return send('EXEC', { opfsPath, sql, params })
  },

  async query(opfsPath, sql, params = []) {
    const { rows } = await send('QUERY', { opfsPath, sql, params })
    return rows
  },

  async summary(opfsPath) {
    return send('SUMMARY', { opfsPath })
  },

  async runningTotal(opfsPath) {
    const { rows } = await send('RUNNING_TOTAL', { opfsPath })
    return rows
  },

  async closeDb(opfsPath) {
    return send('CLOSE_DB', { opfsPath })
  },

  terminate() {
    worker?.terminate()
    worker = null
    initialized = false
    pending.clear()
  },
}

export default workerClient
