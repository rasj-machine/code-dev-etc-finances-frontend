import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
const PrivacyContext = createContext(null)

export function PrivacyProvider({ children }) {
  // Helper to read initial state with priority: sessionStorage > localStorage > default
  const getStoredBool = (key, def = false) => {
    const s = sessionStorage.getItem(key)
    if (s !== null) return s === 'true'
    const l = localStorage.getItem(key)
    if (l !== null) return l === 'true'
    return def
  }

  const [hidden, setHidden] = useState(() => getStoredBool('use_hidden', false))
  console.log('should hidden', hidden);
  const [locked, setLocked] = useState(() => getStoredBool('use_locked', false))
  const [hasPin, setHasPin] = useState(false)
  const [pinVerified, setPinVerified] = useState(!!localStorage.getItem('pin_token'))
  const isInitialMount = useRef(true)

  // Check if PIN is configured on mount
  useEffect(() => {
    fetch("/api/config").then(r => r.json()).then(cfg => {
      setHasPin(!!cfg.privacy_pin_hash)
    }).catch(() => { })

    const onAuthError = () => {
      setPinVerified(false)
      localStorage.removeItem('finance_auth_token')
      setHidden(true)
    }
    const onPinRequired = () => {
      // PIN expired but user session is still valid — just show PIN screen
      setPinVerified(false)
      localStorage.removeItem('pin_token')
      setHidden(true)
    }
    window.addEventListener('unauthorized', onAuthError)
    window.addEventListener('pin_required', onPinRequired)
    return () => {
      window.removeEventListener('unauthorized', onAuthError)
      window.removeEventListener('pin_required', onPinRequired)
    }
  }, [])


  const terminateSession = useCallback(async () => {
    fetch("/api/auth/invalidate", { method: "POST" }).catch(() => { })
    localStorage.removeItem('pin_token')
    Promise.resolve().then(() => {
      setPinVerified(false)
    })
  }, [])

  useEffect(() => {
    sessionStorage.setItem('use_hidden', String(hidden))
    localStorage.setItem('use_hidden', String(hidden))

    // Only terminate session if it's NOT the initial mount and hidden is true
    // This allows F5 to keep the session alive even if blurred
    if (hidden && !isInitialMount.current) {
      terminateSession()
    }

    if (isInitialMount.current) {
      isInitialMount.current = false
    }
  }, [hidden, terminateSession])

  useEffect(() => {
    sessionStorage.setItem('use_locked', locked)
    localStorage.setItem('use_locked', locked)
  }, [locked])

  const toggleHidden = useCallback(() => setHidden(h => !h), [])
  const toggleLocked = useCallback(() => setLocked(l => !l), [])

  const verifyPin = async (pin) => {
    const res = await fetch("/api/auth/pin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin })
    })
    const data = await res.json()
    if (data.status === 'success') {
      localStorage.setItem('pin_token', data.token)  // separate from user JWT
      setPinVerified(true)
      return true
    }
    return false
  }

  // Auto-lock when tab loses focus if 'locked' is enabled
  useEffect(() => {
    const handler = () => {
      if (locked && document.hidden) {
        setHidden(true)
        terminateSession()
      }
    }
    document.addEventListener("visibilitychange", handler)
    return () => document.removeEventListener("visibilitychange", handler)
  }, [locked, terminateSession, setHidden])

  return (
    <PrivacyContext.Provider value={{
      hidden, locked, hasPin, pinVerified,
      toggleHidden, toggleLocked, verifyPin, setHidden
    }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error("usePrivacy must be inside PrivacyProvider")
  return ctx
}
