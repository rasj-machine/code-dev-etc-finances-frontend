/**
 * dbConfigStore.js
 * ─────────────────────────────────────────────────────────────
 * Manages "database connection configs" in browser localStorage.
 *
 * A config keeps track of a database the user has registered:
 * {
 *   id: string,
 *   name: string,        — friendly display name
 *   type: 'api'|'self-hosted'|'browser',
 *   baseUrl: string,     — '' for default API, url for self-hosted
 *   dbPath: string,      — server-side .db path (API/self-hosted)
 *   filename: string,    — .db filename
 *   storageType: 'local'|'cloud',
 *   addedAt: ISO string,
 * }
 */

const LS_KEY = 'finance_pro_db_configs'

let _seq = Date.now()
function uid() { return `${(++_seq).toString(36)}-${Math.random().toString(36).slice(2, 7)}` }

// ── Read / Write ───────────────────────────────────────────────
export function getLocalConfigs() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') }
  catch { return [] }
}

export function saveLocalConfig(config) {
  const all = getLocalConfigs()
  const entry = {
    id: uid(),
    storageType: 'local',
    addedAt: new Date().toISOString(),
    ...config,
  }
  const idx = all.findIndex(c => c.id === entry.id)
  if (idx >= 0) all[idx] = entry
  else all.push(entry)
  localStorage.setItem(LS_KEY, JSON.stringify(all))
  return entry
}

export function removeLocalConfig(id) {
  const filtered = getLocalConfigs().filter(c => c.id !== id)
  localStorage.setItem(LS_KEY, JSON.stringify(filtered))
}

// ── Export / Import ────────────────────────────────────────────
export function exportConfigsAsJson() {
  return JSON.stringify(getLocalConfigs(), null, 2)
}

export function importConfigsFromJson(jsonStr) {
  const imported = JSON.parse(jsonStr)
  if (!Array.isArray(imported)) throw new Error('Formato inválido — esperado um array JSON')
  const current = getLocalConfigs()
  const merged = [...current]
  let added = 0
  for (const c of imported) {
    if (!merged.find(m => m.id === c.id)) {
      merged.push({ ...c, storageType: 'local' })
      added++
    }
  }
  localStorage.setItem(LS_KEY, JSON.stringify(merged))
  return { merged, added }
}

export function downloadJson(data, filename = 'db-configs.json') {
  const blob = new Blob([data], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
