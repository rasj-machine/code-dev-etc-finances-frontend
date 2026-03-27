import { useState, useEffect, useCallback } from "react"
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom"
import Sidebar from "@/components/Sidebar"
import GlobalSearch from "@/components/GlobalSearch"
import Dashboard from "@/pages/Dashboard"
import Contas from "@/pages/Contas"
import Transacoes from "@/pages/Transacoes"
import Investimentos from "@/pages/Investimentos"
import Crypto from "@/pages/Crypto"
import Vinculos from "@/pages/Vinculos"
import Relatorios from "@/pages/Relatorios"
import Patrimonio from "@/pages/Patrimonio"
import Recorrentes from "@/pages/Recorrentes"
import PreTransacoes from "@/pages/PreTransacoes"
import GastosReceitas from "@/pages/GastosReceitas"
import CategoriasTags from "@/pages/CategoriasTags"
import Conciliacao from "@/pages/Conciliacao"
import ConciliacaoTransferencias from "@/pages/ConciliacaoTransferencias"
import TutorialExtrato from "@/pages/TutorialExtrato"
import Unificado from "@/pages/Unificado"
import Configuracoes from "@/pages/Configuracoes"
import AutomacaoPadroes from "@/pages/AutomacaoPadroes"
import Home from "@/pages/Home"
import AiChat from "@/pages/AiChat"
import AuthShell from "@/pages/AuthShell"
import OrgSetupPage from "@/pages/OrgSetupPage"
import ProfilePage from "@/pages/ProfilePage"
import ProcessarArquivos from "@/pages/ProcessarArquivos"
import { AuthProvider, useAuth } from "@/context/AuthContext"
import OrgUserInfo from "@/components/OrgUserInfo"
import { PrivacyProvider, usePrivacy } from "@/context/PrivacyContext"
import { LanguageProvider } from "@/context/LanguageContext"
import { NotificationProvider } from "@/context/NotificationContext"
import { DatabaseProvider, useDatabase } from "@/context/DatabaseContext"
import { Eye, EyeOff, Lock, LockOpen, Globe } from "lucide-react"

const DUCK_ENABLED = false;

function PrivacyControls() {
  const { hidden, locked, toggleHidden, toggleLocked } = usePrivacy()
  return (
    <div className="flex items-center gap-1 ml-auto">
      <button
        onClick={toggleLocked}
        title={locked ? "Travar visibilidade: tab não oculta automaticamente" : "Destravar: oculta automaticamente ao trocar de aba"}
        className={`p-1.5 rounded-lg transition-colors hover:bg-accent/60 ${locked ? "text-primary" : "text-muted-foreground"}`}
      >
        {locked ? <Lock size={15} /> : <LockOpen size={15} />}
      </button>
      <button
        onClick={toggleHidden}
        title={hidden ? "Mostrar valores" : "Ocultar valores"}
        className={`p-1.5 rounded-lg transition-colors hover:bg-accent/60 ${hidden ? "text-destructive" : "text-muted-foreground"}`}
      >
        {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

function ApiProxyIndicator() {
  const { apiBaseUrl } = useAuth()
  if (!apiBaseUrl) return null

  return (
    <div className="flex items-center gap-1.5 px-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600 animate-pulse ml-1.5"
      title={`Conectado via API externa: ${apiBaseUrl}`}>
      <Globe size={13} className="shrink-0" />
      <span className="text-[10px] font-bold uppercase tracking-tighter hidden md:block">Proxy Ativo</span>
    </div>
  )
}

// ── Auth Gate ────────────────────────────────────────────────
function AuthGate({ children }) {
  const { isAuthenticated, hasOrg, loading } = useAuth()
  if (loading) return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 animate-pulse" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  )
  if (!isAuthenticated) return <AuthShell />
  if (!hasOrg) return <OrgSetupPage />
  return children
}

function AppInner() {
  const { hidden, locked, hasPin, pinVerified, verifyPin } = usePrivacy()
  const { currentDb, loading: dbLoading } = useDatabase()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [pin, setPin] = useState("")
  const [error, setError] = useState(false)

  // Redirect to home if no DB is selected
  useEffect(() => {
    if (!dbLoading && !currentDb && pathname !== "/") {
      navigate("/")
    }
  }, [currentDb, dbLoading, pathname, navigate])

  const handlePin = useCallback(async (val) => {
    if (val.length === 6) {
      const ok = await verifyPin(val)
      if (ok) {
        setPin("")
        setError(false)
      } else {
        setError(true)
        setPin("")
        setTimeout(() => setError(false), 1000)
      }
    }
  }, [verifyPin])

  const addDigit = useCallback((d) => {
    if (pin.length < 6) {
      const newPin = pin + d
      setPin(newPin)
      handlePin(newPin)
    }
  }, [pin, handlePin])

  const removeDigit = useCallback(() => setPin(p => p.slice(0, -1)), [])

  const showBlocker = hidden && hasPin && !pinVerified

  // ── Duck logic (FULLY independent from eye) ───────────────────────
  //  • Duck appears ONLY on page load when hidden||locked was active when user left.
  //  • Clicking the eye NEVER shows or hides the duck.
  //  • Dismissing the duck NEVER changes hidden (eye stays as-is).
  //  • On beforeunload: if hidden||locked, save duck_pending to sessionStorage.
  //  • On mount: if duck_pending exists, show duck and clear the flag.

  const [duckActive, setDuckActive] = useState(() => {
    const pending = sessionStorage.getItem('duck_pending') === '1'
    if (pending) sessionStorage.removeItem('duck_pending')
    return DUCK_ENABLED && pending
  })

  // Save duck_pending before the page unloads (F5 / close)
  useEffect(() => {
    const handleUnload = () => {
      if (hidden || locked) {
        sessionStorage.setItem('duck_pending', '1')
      } else {
        sessionStorage.removeItem('duck_pending')
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [hidden, locked])

  // Show duck immediately when user RETURNS to the tab while hidden||locked is active
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && (hidden || locked)) {
        setDuckActive(DUCK_ENABLED && true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [hidden, locked])

  // Keyboard handler for PIN entry (only when PIN blocker is visible)
  useEffect(() => {
    if (!showBlocker || duckActive) return
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') addDigit(e.key)
      if (e.key === 'Backspace') removeDigit()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showBlocker, duckActive, pin, addDigit, removeDigit])

  return (
    <>
      {duckActive && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col justify-center items-center select-none cursor-pointer"
          onDoubleClick={() => setDuckActive(false)}>
          <div className="text-[200px] animate-pulse">🦆</div>
          <p className="text-white/20 text-xs font-mono">Hello !</p>
        </div>
      )}

      {(!showBlocker || duckActive) ? (
        <div className={`flex min-h-screen bg-background ${hidden ? "privacy-on" : ""}`}>
          <Sidebar />
          <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
            <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-4 gap-3 sticky top-0 z-40">
              <OrgUserInfo />
              <div className="w-px h-6 bg-border hidden sm:block" />
              <GlobalSearch />
              <ApiProxyIndicator />
              <PrivacyControls />
            </header>
            <main className="flex-1 p-8 overflow-auto">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/contas" element={<Contas />} />
                <Route path="/transacoes" element={<Transacoes />} />
                <Route path="/vinculos" element={<Vinculos />} />
                <Route path="/investimentos" element={<Investimentos />} />
                <Route path="/crypto" element={<Crypto />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/patrimonio" element={<Patrimonio />} />
                <Route path="/recorrentes" element={<Recorrentes />} />
                <Route path="/pre-transacoes" element={<PreTransacoes />} />
                <Route path="/gastos-receitas" element={<GastosReceitas />} />
                <Route path="/categorias-tags" element={<CategoriasTags />} />
                <Route path="/conciliacao" element={<Conciliacao />} />
                <Route path="/conciliacao-transferencias" element={<ConciliacaoTransferencias />} />
                <Route path="/tutorial-extrato" element={<TutorialExtrato />} />
                <Route path="/unificado" element={<Unificado />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/automacao" element={<AutomacaoPadroes />} />
                <Route path="/ai" element={<AiChat />} />
                <Route path="/perfil" element={<ProfilePage />} />
                <Route path="/processar-arquivos" element={<ProcessarArquivos />} />
              </Routes>
            </main>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
          <div className={`w-full max-w-xs space-y-8 text-center ${error ? "animate-bounce" : ""}`}>
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-primary/10 rounded-full text-primary">
                <Lock size={32} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Tela Bloqueada</h2>
              <p className="text-sm text-muted-foreground">Insira o seu PIN de 6 dígitos para acessar</p>
            </div>

            <div className="flex justify-center gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full border-2 transition-all duration-200 ${i < pin.length ? "bg-primary border-primary scale-125" : "border-muted-foreground/30"}`} />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4 px-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                <button key={d} onClick={() => addDigit(d.toString())} className="h-16 rounded-2xl bg-card border border-border text-2xl font-medium hover:bg-accent transition-colors active:scale-95 flex items-center justify-center">
                  {d}
                </button>
              ))}
              <button onClick={() => setPin("")} className="h-16 rounded-2xl bg-card border border-border text-xs font-bold uppercase tracking-widest hover:bg-accent transition-colors active:scale-95 flex items-center justify-center">
                Limpar
              </button>
              <button onClick={() => addDigit("0")} className="h-16 rounded-2xl bg-card border border-border text-2xl font-medium hover:bg-accent transition-colors active:scale-95 flex items-center justify-center">
                0
              </button>
              <button onClick={removeDigit} className="h-16 rounded-2xl bg-card border border-border text-xl hover:bg-accent transition-colors active:scale-95 flex items-center justify-center text-destructive">
                <Trash2 size={24} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <LanguageProvider>
            <DatabaseProvider>
              <PrivacyProvider>
                <AuthGate>
                  <AppInner />
                </AuthGate>
              </PrivacyProvider>
            </DatabaseProvider>
          </LanguageProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
