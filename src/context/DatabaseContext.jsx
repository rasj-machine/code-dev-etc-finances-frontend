/**
 * DatabaseContext.jsx
 * ─────────────────────────────────────────────────────────────
 * Central context for all database management.
 *
 * Supports two modes:
 *   'flask'   → server-side SQLite via Flask API
 *   'browser' → client-side SQLite Wasm + OPFS + File System Access API
 *
 * Exposes:
 *   mode                 'flask' | 'browser'
 *   currentDb            { name, path, opfsPath? }
 *   databases[]          list of known databases (with summary stats)
 *   loading              bool
 *   switchMode(mode)     change the operating mode
 *   selectDatabase(…)    switch active database (works in both modes)
 *   createDatabase(…)    create new database
 *   openFilePicker()     (browser mode) pick a user .db file
 *   importFilePicker()   alias for openFilePicker
 *   syncToDisk()         (browser mode) flush OPFS → user disk file
 *   autoSaveEnabled      bool
 *   setAutoSave(bool)
 *   refresh()            reload database list
 *   provider             the active DataProvider instance
 */

import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef,
} from 'react'
import { useAuth } from './AuthContext'
import {
  MODES, getStoredMode, setStoredMode,
  getStoredOpfsPath, setStoredOpfsPath,
  createProvider, hasFsAccess, hasOpfs,
} from '@/lib/dataProvider'
import workerClient from '@/lib/workerClient'
import {
  listHandles, pickAndSaveHandle, createNewFileHandle,
  readFileBytes, writeFileBytes, removeHandle, ensurePermission,
} from '@/lib/fileHandleStore'
import { getLocalConfigs } from '@/lib/dbConfigStore'

const DatabaseContext = createContext(null)

// ── OPFS path convention: /<filename> ────────────────────────
const toOpfsPath = (name) => `/${name}`

export function DatabaseProvider({ children }) {
  const [mode, setMode] = useState(getStoredMode)
  const [currentDb, setCurrentDb] = useState(null)
  const [databases, setDatabases] = useState([])
  const [cloudConfigs, setCloudConfigs] = useState([])
  const [localConfigs, setLocalConfigs] = useState(() => getLocalConfigs())
  const [loading, setLoading] = useState(true)
  const [autoSaveEnabled, setAutoSaveState] = useState(
    () => localStorage.getItem('autoSave') !== 'false'
  )
  const { isAuthenticated } = useAuth()
  const autoSaveTimer = useRef(null)

  // Provider is derived from mode + currentDb
  const [provider, setProvider] = useState(() =>
    createProvider(getStoredMode(), getStoredOpfsPath())
  )

  // ── Browser mode: load databases from IndexedDB file handles ─
  const loadBrowserDatabases = useCallback(async () => {
    const handles = await listHandles()
    const dbs = await Promise.all(handles.map(async ({ key, handle, label }) => {
      const opfsPath = toOpfsPath(key)
      let summary = { balance: 0, accounts: 0, transactions: 0, lastDate: null, month_income: 0, month_expense: 0 }
      try {
        const hasPerm = await ensurePermission(handle)
        if (hasPerm) {
          await workerClient.init()
          await workerClient.openDb(opfsPath)
          summary = await workerClient.summary(opfsPath)
        }
      } catch (e) {
        console.warn('summary error for', key, e)
      }
      return {
        name: label || key,
        path: key,
        opfsPath,
        is_current: opfsPath === getStoredOpfsPath(),
        size: 0,
        ...summary,
        total_balance: summary.balance,
        account_count: summary.accounts,
        txn_count: summary.transactions,
        last_txn_date: summary.lastDate,
      }
    }))
    setDatabases(dbs)
    // Set currentDb
    const active = dbs.find(d => d.is_current) || dbs[0] || null
    if (active) setCurrentDb(active)
  }, [])

  // ── Flask mode: load databases from /api/databases ───────────
  const loadFlaskDatabases = useCallback(async () => {
    try {
      const r = await fetch('/api/databases')
      if (!r.ok) return
      const list = await r.json()
      setDatabases(list)
      const active = list.find(d => d.is_current) || list[0] || null
      if (active) setCurrentDb({ name: active.name, path: active.path })
    } catch (e) {
      console.warn('loadFlaskDatabases', e)
    }

    // Also load cloud configs
    try {
      const r = await fetch('/api/db-configs')
      if (r.ok) setCloudConfigs(await r.json())
    } catch (e) {
      console.warn('loadCloudConfigs', e)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setLocalConfigs(getLocalConfigs())
      if (mode === MODES.BROWSER) {
        await loadBrowserDatabases()
      } else {
        await loadFlaskDatabases()
      }
    } finally {
      setLoading(false)
    }
  }, [mode, loadBrowserDatabases, loadFlaskDatabases])

  // Initial load is now handled by the isAuthenticated effect below
  // to avoid calling the API before the user is authenticated.

  // Refresh when user authenticates
  useEffect(() => {
    if (isAuthenticated) {
      refresh()
    } else {
      // Clear cloud-specific data if unauthenticated
      setCloudConfigs([])
      if (mode === MODES.FLASK) {
        setDatabases([])
        setCurrentDb(null)
      }
    }
  }, [isAuthenticated, refresh, mode])

  // ── Auto-save (browser mode) ─────────────────────────────────
  const syncToDisk = useCallback(async () => {
    if (mode !== MODES.BROWSER || !currentDb?.opfsPath) return false
    const handles = await listHandles()
    const entry = handles.find(h => h.key === currentDb.path)
    if (!entry) return false
    const hasPerm = await ensurePermission(entry.handle)
    if (!hasPerm) return false
    const bytes = await workerClient.exportBytes(currentDb.opfsPath)
    await writeFileBytes(entry.handle, bytes)
    return true
  }, [mode, currentDb])

  // Auto-save every 30s in browser mode
  useEffect(() => {
    if (mode !== MODES.BROWSER || !autoSaveEnabled) return
    autoSaveTimer.current = setInterval(syncToDisk, 30_000)
    return () => clearInterval(autoSaveTimer.current)
  }, [mode, autoSaveEnabled, syncToDisk])

  // ── Switch operating mode ────────────────────────────────────
  const switchMode = useCallback(async (newMode) => {
    setStoredMode(newMode)
    setMode(newMode)
    const opfsPath = newMode === MODES.BROWSER ? getStoredOpfsPath() : null
    const p = createProvider(newMode, opfsPath)
    setProvider(p)
    // Will trigger refresh via mode dep
  }, [])

  // ── Flask: select a database ─────────────────────────────────
  const selectFlaskDatabase = useCallback(async (path) => {
    const r = await fetch('/api/databases/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    if (!r.ok) return false
    const data = await r.json()
    setCurrentDb({ name: data.name, path: data.path })
    await loadFlaskDatabases()
    return true
  }, [loadFlaskDatabases])

  // ── Browser: select (activate) a database ────────────────────
  const selectBrowserDatabase = useCallback(async (key) => {
    const opfsPath = toOpfsPath(key)
    await workerClient.init()
    await workerClient.openDb(opfsPath)
    setStoredOpfsPath(opfsPath)
    const p = createProvider(MODES.BROWSER, opfsPath)
    setProvider(p)
    setCurrentDb(dbs => {
      const found = dbs.find ? null : null // we'll use the setter pattern
      return found
    })
    await loadBrowserDatabases()
    return true
  }, [loadBrowserDatabases])

  const selectDatabase = useCallback(async (pathOrKey) => {
    if (mode === MODES.BROWSER) return selectBrowserDatabase(pathOrKey)
    return selectFlaskDatabase(pathOrKey)
  }, [mode, selectBrowserDatabase, selectFlaskDatabase])

  // ── Flask: create database ────────────────────────────────────
  const createFlaskDatabase = useCallback(async (name) => {
    const r = await fetch('/api/databases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await r.json()
    if (r.ok) await loadFlaskDatabases()
    return { ok: r.ok, data }
  }, [loadFlaskDatabases])

  // ── Browser: open file picker and import a .db file ──────────
  const openFilePicker = useCallback(async () => {
    if (!hasFsAccess()) throw new Error('File System Access API not supported in this browser (use Chrome/Edge)')
    await workerClient.init()
    const key = await pickAndSaveHandle()
    const opfsPath = toOpfsPath(key)
    // Load bytes into OPFS
    const handles = await listHandles()
    const entry = handles.find(h => h.key === key)
    if (entry) {
      const bytes = await readFileBytes(entry.handle)
      if (bytes.length > 0) {
        await workerClient.importBytes(opfsPath, bytes)
      } else {
        await workerClient.openDb(opfsPath)
        await workerClient.initSchema(opfsPath)
      }
    }
    setStoredOpfsPath(opfsPath)
    const p = createProvider(MODES.BROWSER, opfsPath)
    setProvider(p)
    await loadBrowserDatabases()
    return key
  }, [loadBrowserDatabases])

  // ── Browser: create a brand new .db via save picker ──────────
  const createBrowserDatabase = useCallback(async () => {
    if (!hasFsAccess()) throw new Error('File System Access API not supported')
    await workerClient.init()
    const { key } = await createNewFileHandle()
    const opfsPath = toOpfsPath(key)
    await workerClient.openDb(opfsPath)
    await workerClient.initSchema(opfsPath)
    // Write empty DB to disk immediately
    const bytes = await workerClient.exportBytes(opfsPath)
    const handles = await listHandles()
    const entry = handles.find(h => h.key === key)
    if (entry) await writeFileBytes(entry.handle, bytes)
    setStoredOpfsPath(opfsPath)
    const p = createProvider(MODES.BROWSER, opfsPath)
    setProvider(p)
    await loadBrowserDatabases()
    return { ok: true, data: { name: key, opfsPath } }
  }, [loadBrowserDatabases])

  const createDatabase = useCallback(async (name) => {
    if (mode === MODES.BROWSER) return createBrowserDatabase()
    return createFlaskDatabase(name)
  }, [mode, createBrowserDatabase, createFlaskDatabase])

  // ── Remove a browser database ─────────────────────────────────
  const removeBrowserDatabase = useCallback(async (key) => {
    await removeHandle(key)
    await workerClient.closeDb(toOpfsPath(key))
    await loadBrowserDatabases()
  }, [loadBrowserDatabases])

  const setAutoSave = useCallback((val) => {
    localStorage.setItem('autoSave', val ? 'true' : 'false')
    setAutoSaveState(val)
  }, [])

  // ── Unified List ──
  const allDatabases = [
    ...databases.map(d => ({ ...d, storageType: d.storageType || (mode === MODES.BROWSER ? 'local' : 'cloud'), type: d.type || (mode === MODES.BROWSER ? 'browser' : 'api') })),
    ...(mode === MODES.FLASK ? cloudConfigs
      .filter(c => !databases.find(d => d.path === c.db_path || d.name === c.filename))
      .map(c => ({ ...c, path: c.db_path || c.filename })) : []),
    ...(mode === MODES.FLASK ? localConfigs.map(c => ({
      id: c.id,
      name: c.name,
      path: c.dbPath || c.db_path || '',
      filename: c.filename,
      type: c.type,
      baseUrl: c.baseUrl || c.base_url || '',
      storageType: 'local',
      is_current: false,
      size: 0,
    })) : []),
  ]

  const value = {
    mode,
    currentDb,
    databases: allDatabases,
    serverDatabases: databases, // Original list for internal use
    cloudConfigs,
    localConfigs,
    loading,
    provider,
    autoSaveEnabled,
    setAutoSave,
    hasFsAccess: hasFsAccess(),
    hasOpfs: hasOpfs(),
    refresh,
    switchMode,
    selectDatabase,
    createDatabase,
    openFilePicker,
    importFilePicker: openFilePicker,
    createBrowserDatabase,
    removeBrowserDatabase,
    syncToDisk,
    MODES,
  }

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  )
}

export function useDatabase() {
  const ctx = useContext(DatabaseContext)
  if (!ctx) throw new Error('useDatabase must be used within DatabaseProvider')
  return ctx
}
