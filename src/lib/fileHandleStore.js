/**
 * fileHandleStore.js
 * ─────────────────────────────────────────────────────────────
 * Persists FileSystemFileHandle objects in IndexedDB using the `idb` library.
 * This lets the user open a .db file once and have it remembered across sessions
 * without needing to pick it again (browser will prompt for permission on reload).
 *
 * DB name  : finance-pro-handles
 * Store    : handles
 * Key      : the file name (e.g. "finance.db")
 * Value    : { handle: FileSystemFileHandle, addedAt: ISO string, label?: string }
 */

import { openDB } from 'idb'

const DB_NAME = 'finance-pro-handles'
const STORE   = 'handles'
const VERSION = 1

async function getIdb() {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE) // key = filename
      }
    },
  })
}

/** Save (or overwrite) a FileSystemFileHandle for the given key. */
export async function saveHandle(key, handle, label = '') {
  const db = await getIdb()
  await db.put(STORE, { handle, label: label || key, addedAt: new Date().toISOString() }, key)
}

/** Retrieve a stored handle entry or undefined. */
export async function loadHandle(key) {
  const db = await getIdb()
  return db.get(STORE, key)
}

/** List all stored handle entries as [{ key, handle, label, addedAt }] */
export async function listHandles() {
  const db = await getIdb()
  const keys = await db.getAllKeys(STORE)
  const results = []
  for (const key of keys) {
    const entry = await db.get(STORE, key)
    results.push({ key, ...entry })
  }
  return results
}

/** Remove a handle from the store. */
export async function removeHandle(key) {
  const db = await getIdb()
  await db.delete(STORE, key)
}

/**
 * Verify (and optionally re-request) permission for an existing handle.
 * Returns true if we have readwrite access.
 */
export async function ensurePermission(handle) {
  const opts = { mode: 'readwrite' }
  const state = await handle.queryPermission(opts)
  if (state === 'granted') return true
  const requested = await handle.requestPermission(opts)
  return requested === 'granted'
}

/**
 * Open the file picker, let the user choose a .db file, save the handle,
 * and return { key, handle, bytes }.
 */
export async function pickAndSaveHandle() {
  const [handle] = await window.showOpenFilePicker({
    types: [{ description: 'SQLite Database', accept: { 'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'] } }],
    multiple: false,
    excludeAcceptAllOption: false,
  })
  const key = handle.name
  await saveHandle(key, handle, handle.name)
  return key
}

/**
 * Create a new .db file via the Save File picker.
 * Returns { key, handle }.
 */
export async function createNewFileHandle(suggestedName = 'novo.db') {
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [{ description: 'SQLite Database', accept: { 'application/x-sqlite3': ['.db'] } }],
  })
  const key = handle.name
  await saveHandle(key, handle, handle.name)
  return { key, handle }
}

/** Read all bytes from a stored file handle. */
export async function readFileBytes(handle) {
  const file = await handle.getFile()
  const buf = await file.arrayBuffer()
  return new Uint8Array(buf)
}

/** Flush bytes back to the user's file on disk. */
export async function writeFileBytes(handle, bytes) {
  // Guard: writable.write() only accepts BufferSource | Blob | string
  // If an object is passed by accident it fails with a cryptic WriteParams error
  let data = bytes
  if (bytes && !(bytes instanceof Uint8Array) && !(bytes instanceof ArrayBuffer) && !(bytes instanceof Blob) && typeof bytes !== 'string') {
    // Try to unwrap { bytes: ... } envelope from the worker
    if (bytes.bytes instanceof Uint8Array) data = bytes.bytes
    else if (bytes.bytes instanceof ArrayBuffer) data = new Uint8Array(bytes.bytes)
    else throw new TypeError(`writeFileBytes: expected Uint8Array or ArrayBuffer, got ${typeof bytes}`)
  }
  const writable = await handle.createWritable()
  await writable.write(data)
  await writable.close()
}
