/**
 * AuthContext.jsx
 * ─────────────────────────────────────────────────────────────
 * Global auth state: user, active org, JWT token.
 * Installs a fetch interceptor so ALL existing API calls
 * automatically include the Bearer token — zero changes needed
 * to existing page components.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

const TOKEN_KEY = 'finance_auth_token'
const GUEST_KEY = 'finance_guest_mode'
const API_BASE_KEY = 'finance_api_base_url'
const AuthCtx   = createContext(null)

function normalizeUrl(base, path) {
  if (!base || path.startsWith('http')) return path
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path : '/' + path
  return b + p
}

// ── Fetch interceptor (installed once) ────────────────────────
let _interceptorInstalled = false
function installFetchInterceptor(getToken, getBaseUrl) {
  if (_interceptorInstalled) return
  _interceptorInstalled = true
  const original = window.fetch
  window.fetch = function (url, opts = {}) {
    const token = getToken()
    const baseUrl = getBaseUrl()
    const pinToken = localStorage.getItem('pin_token')
    
    const isApi = typeof url === 'string' && (url.startsWith('/api/') || url.includes('/api/'))
    
    let finalUrl = url
    if (isApi) {
      finalUrl = normalizeUrl(baseUrl, url)
      const headers = { ...opts.headers }
      if (token) headers['Authorization'] = `Bearer ${token}`
      if (pinToken) headers['X-Pin-Token'] = pinToken
      opts = { ...opts, headers }
    }
    return original(finalUrl, opts).then(res => {
      if (res.status === 401) {
        res.clone().json().then(b => {
          if (b?.code === 'PIN_REQUIRED') window.dispatchEvent(new CustomEvent('pin_required'))
          else window.dispatchEvent(new CustomEvent('unauthorized'))
        }).catch(() => window.dispatchEvent(new CustomEvent('unauthorized')))
      }
      return res
    })
  }
}

// ── API helpers ───────────────────────────────────────────────
const api = {
  post: (path, body) => fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json()),

  get: (path) => fetch(path).then(r => r.json()),
}

// ── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [token,     setToken]     = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user,      setUser]      = useState(null)
  const [org,       setOrg]       = useState(null)
  const [orgs,      setOrgs]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [authError, setAuthError] = useState(null)
  const [isGuest,   setIsGuest]   = useState(() => localStorage.getItem(GUEST_KEY) === '1')
  const [apiBaseUrl, setApiBaseUrl] = useState(() => localStorage.getItem(API_BASE_KEY) || '')

  // Keep a ref so the interceptor always reads the latest values
  const tokenRef = useRef(token)
  tokenRef.current = token
  
  const apiBaseRef = useRef(apiBaseUrl)
  apiBaseRef.current = apiBaseUrl

  // Install interceptor IMMEDIATELY before children mount
  installFetchInterceptor(() => tokenRef.current, () => apiBaseRef.current)

  // Persist values
  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else       localStorage.removeItem(TOKEN_KEY)
  }, [token])

  useEffect(() => {
    if (apiBaseUrl) localStorage.setItem(API_BASE_KEY, apiBaseUrl)
    else            localStorage.removeItem(API_BASE_KEY)
  }, [apiBaseUrl])

  // Load user from /api/auth/me when we have a token
  const loadMe = useCallback(async (tk) => {
    if (!tk) {
      // Check guest mode
      if (localStorage.getItem(GUEST_KEY) === '1') {
        setUser({ name: 'Convidado', email: null, isGuest: true, totp_enabled: false })
        setOrg(null); setOrgs([])
      }
      setLoading(false)
      return
    }
    try {
      const r = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${tk}` }
      })
      if (!r.ok) throw new Error('invalid')
      const { user: u, orgs: o, active_org } = await r.json()
      setUser(u)
      setOrgs(o || [])
      setOrg(active_org || null)
    } catch {
      // Token invalid → clear
      setToken(null)
      setUser(null)
      setOrg(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMe(token) }, [token, loadMe])

  // ── Auth actions ───────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setAuthError(null)
    const res = await api.post('/api/auth/login', { email, password })
    if (res.error) { setAuthError(res.error); return { ok: false, error: res.error } }
    if (res.requires_2fa) return { ok: true, requires_2fa: true, temp_token: res.temp_token }
    setToken(res.token)
    setUser(res.user)
    return { ok: true }
  }, [])

  const verify2fa = useCallback(async (tempToken, code) => {
    setAuthError(null)
    const res = await api.post('/api/auth/verify-2fa', { temp_token: tempToken, code })
    if (res.error) { setAuthError(res.error); return { ok: false, error: res.error } }
    setToken(res.token)
    setUser(res.user)
    return { ok: true }
  }, [])

  const register = useCallback(async (email, password, name) => {
    setAuthError(null)
    const res = await api.post('/api/auth/register', { email, password, name })
    if (res.error) { setAuthError(res.error); return { ok: false, error: res.error } }
    setToken(res.token)
    setUser(res.user)
    return { ok: true }
  }, [])

  const logout = useCallback(() => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setToken(null); setUser(null); setOrg(null); setOrgs([])
    setIsGuest(false)
    localStorage.removeItem(GUEST_KEY)
  }, [])

  const guestLogin = useCallback(() => {
    localStorage.setItem(GUEST_KEY, '1')
    setIsGuest(true)
    setUser({ name: 'Convidado', email: null, isGuest: true, totp_enabled: false })
    setOrg(null); setOrgs([])
    setToken(null)
  }, [])

  const guestLogout = useCallback(() => {
    localStorage.removeItem(GUEST_KEY)
    setIsGuest(false)
    setUser(null)
  }, [])

  const createOrg = useCallback(async (name, require2fa = true) => {
    const res = await api.post('/api/user/orgs', { name, require_2fa: require2fa })
    if (res.error) return { ok: false, error: res.error }
    // Switch to new org
    return await switchOrg(res.id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const switchOrg = useCallback(async (orgId) => {
    const res = await api.post(`/api/orgs/${orgId}/switch`, {})
    if (res.error) return { ok: false, error: res.error, code: res.code }
    setToken(res.token)
    setOrg(res.org)
    // Reload orgs list
    const orgsRes = await api.get('/api/user/orgs')
    if (Array.isArray(orgsRes)) setOrgs(orgsRes)
    return { ok: true }
  }, [])

  const refreshOrgs = useCallback(async () => {
    const res = await api.get('/api/user/orgs')
    if (Array.isArray(res)) setOrgs(res)
  }, [])

  const isOwner = org && user
    ? auth_db_role(orgs, org.id) === 'owner'
    : false

  const myRole = org && user && orgs.length
    ? (orgs.find(o => o.id === org?.id)?.role || null)
    : null

  return (
    <AuthCtx.Provider value={{
      // State
      user, org, orgs, token, loading, authError, isGuest, apiBaseUrl,
      // Computed
      isAuthenticated: !!user,
      hasOrg: !!org || isGuest,  // guests bypass org requirement
      myRole,
      isOwner: myRole === 'owner',
      isAdmin: myRole === 'owner' || myRole === 'admin',
      // Actions
      login, verify2fa, register, logout, guestLogin, guestLogout,
      createOrg, switchOrg, refreshOrgs,
      setAuthError,
      setApiBaseUrl,
      setUser: (u) => { setUser(u) },
      setOrg:  (o) => { setOrg(o)  },
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

function auth_db_role(orgs, orgId) {
  return orgs.find(o => o.id === orgId)?.role || null
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
