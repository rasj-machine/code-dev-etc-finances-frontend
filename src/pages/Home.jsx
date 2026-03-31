import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, Button, Input } from "@/components/ui"
import { useDatabase } from "@/context/DatabaseContext"
import { useNotification } from "@/context/NotificationContext"
import { usePrivacy } from "@/context/PrivacyContext"
import { formatCurrency } from "@/lib/utils"
import {
  saveLocalConfig, removeLocalConfig,
  exportConfigsAsJson, importConfigsFromJson, downloadJson,
} from "@/lib/dbConfigStore"
import {
  Database, Plus, CheckCircle2, TrendingUp, TrendingDown, Wallet,
  ArrowRight, FileText, Calendar, RefreshCw, X, HardDrive, Layers,
  Monitor, FolderOpen, Save, Trash2, AlertCircle,
  WifiOff, ShieldCheck, Zap, Eye, EyeOff, ChevronDown, ChevronUp,
  Cloud, Server, Globe, Download, Upload, BookOpen, Settings, Lock,
} from "lucide-react"

// ── Tiny helpers ───────────────────────────────────────────────
function humanSize(bytes) {
  if (!bytes) return "0 B"
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}
function BlurValue({ hidden, children }) {
  return <span className={`transition-all duration-200 ${hidden ? "blur-sm select-none pointer-events-none" : ""}`}>{children}</span>
}
function SourceBadge({ storageType }) {
  return storageType === 'local'
    ? <span className="text-[9px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/25 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0"><HardDrive size={8} />Local</span>
    : <span className="text-[9px] font-bold bg-sky-500/15 text-sky-600 border border-sky-500/25 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0"><Cloud size={8} />Cloud/API</span>
}
function TypeBadge({ type }) {
  const map = {
    'api': { label: 'API', cls: 'bg-primary/10 text-primary border-primary/20' },
    'self-hosted': { label: 'Self-hosted', cls: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
    'browser': { label: 'Browser', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  }
  const { label, cls } = map[type] || map.api
  return <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full ${cls}`}>{label}</span>
}

// ── Source filter tabs ─────────────────────────────────────────
function SourceFilter({ value, onChange, counts }) {
  const tabs = [
    { id: 'all', label: 'Todos', count: counts.all },
    { id: 'cloud', label: 'Cloud / API', count: counts.cloud, icon: Cloud },
    { id: 'local', label: 'Local Storage', count: counts.local, icon: HardDrive },
  ]
  return (
    <div className="flex gap-1 p-0.5 bg-accent/40 rounded-lg border border-border/50">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
            ${value === t.id ? "bg-background border border-border shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {t.icon && <t.icon size={11} />}
          {t.label}
          <span className={`text-[10px] px-1.5 rounded-full font-bold font-mono
            ${value === t.id ? "bg-primary/10 text-primary" : "bg-accent text-muted-foreground"}`}>
            {t.count}
          </span>
        </button>
      ))}
    </div>
  )
}

// ── Mode toggle (API vs Browser) ───────────────────────────────
function ModeToggle({ mode, MODES, onSwitch, hasFsAccess }) {
  return (
    <div className="flex gap-2 p-1 bg-accent/40 rounded-xl border border-border/60">
      {/* API mode */}
      <button onClick={() => onSwitch(MODES.FLASK)}
        className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
          ${mode === MODES.FLASK
            ? "bg-background border border-border shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
      >
        <Globe size={15} className={mode === MODES.FLASK ? "text-primary" : ""} />
        <div className="text-left flex-1">
          <div className="text-xs font-semibold leading-none">API</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Self-host ou Cloud</div>
        </div>
        {mode === MODES.FLASK && <CheckCircle2 size={13} className="text-primary" />}
      </button>

      {/* Browser Local mode */}
      <button disabled={!hasFsAccess} onClick={() => hasFsAccess && onSwitch(MODES.BROWSER)}
        className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
          ${mode === MODES.BROWSER
            ? "bg-background border border-border shadow-sm text-foreground"
            : hasFsAccess ? "text-muted-foreground hover:text-foreground hover:bg-accent/60" : "opacity-40 cursor-not-allowed text-muted-foreground"
          }`}
        title={!hasFsAccess ? "Requer Chrome 86+ ou Edge 86+" : ""}
      >
        <Monitor size={15} className={mode === MODES.BROWSER ? "text-primary" : ""} />
        <div className="text-left flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold leading-none">Browser Local</span>
            <span className="text-[9px] font-bold bg-amber-500/20 text-amber-600 border border-amber-500/30 px-1.5 py-0.5 rounded-full">BETA</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">SQLite Wasm · OPFS</div>
          <div className="flex gap-1 mt-1 flex-wrap">
            {[["✓ Chrome 86+", true], ["✓ Edge 86+", true], ["✗ Firefox", false], ["✗ Safari", false]].map(([n, ok]) => (
              <span key={n} className={`text-[9px] px-1 py-0.5 rounded font-medium border ${ok ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"}`}>{n}</span>
            ))}
          </div>
        </div>
        {mode === MODES.BROWSER && <CheckCircle2 size={13} className="text-primary shrink-0" />}
      </button>
    </div>
  )
}

// ── Add DB Dialog ──────────────────────────────────────────────
function AddDbDialog({ onClose, onAdd, currentMode, MODES }) {
  const [type, setType] = useState('api')
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [dbPath, setDbPath] = useState('')
  const [engine, setEngine] = useState('postgres')
  const [saveLocal, setSaveLocal] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      await onAdd({ type, name: name.trim(), baseUrl: baseUrl.trim(), dbPath: dbPath.trim(), saveLocal, engine })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (currentMode === MODES.BROWSER) {
    onClose()
    return null
  }

  const types = [
    { id: 'api', icon: Globe, label: 'API Configurada', desc: 'Usa o endpoint da API atual do projeto' },
    { id: 'self-hosted', icon: Server, label: 'Self-hosted', desc: 'Informe a URL base de outro servidor' },
  ]

  return (
    <div className="fixed top-[-20px] left-0 right-0 bottom-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm " onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus size={16} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm">Adicionar Banco de Dados</p>
              <p className="text-[11px] text-muted-foreground">Registre uma conexão com um banco SQLite</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type selector */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tipo de conexão</p>
            <div className="grid grid-cols-2 gap-2">
              {types.map(t => (
                <button key={t.id} type="button" onClick={() => setType(t.id)}
                  className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all
                    ${type === t.id ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40 text-foreground"}`}>
                  <div className="flex items-center gap-2 w-full">
                    <t.icon size={14} className={type === t.id ? "text-primary" : "text-muted-foreground"} />
                    <span className="text-xs font-semibold">{t.label}</span>
                    {type === t.id && <CheckCircle2 size={11} className="ml-auto text-primary" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome de exibição</label>
            <Input required value={name} autoFocus onChange={e => setName(e.target.value)} placeholder="Ex: Pessoal, Empresa 2026..." className="text-sm" />
          </div>

          {/* Self-hosted: base URL */}
          {type === 'self-hosted' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">URL Base da API</label>
              <Input required value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://meuservidor.com:5001" className="text-sm font-mono" />
              <p className="text-[10px] text-muted-foreground mt-1">A URL do servidor Flask onde o banco está hospedado</p>
            </div>
          )}

          {/* DB file path (optional for api type) */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              DB Path ou Identificador {type === 'api' ? '(opcional)' : ''}
            </label>
            <Input value={dbPath} onChange={e => setDbPath(e.target.value)} placeholder="Opcional. Ex: meubanco.db ou dsn postgres" className="text-sm font-mono" />
          </div>

          {/* Engine selector for API type */}
          {type === 'api' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Motor de Banco de Dados</label>
              <div className="flex bg-accent/30 p-1 rounded-lg border border-border/50">
                <button
                  type="button"
                  onClick={() => setEngine('postgres')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${engine === 'postgres' ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  PostgreSQL
                </button>
                <button
                  type="button"
                  onClick={() => setEngine('sqlite')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${engine === 'sqlite' ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  SQLite
                </button>
              </div>
            </div>
          )}

          {/* Storage toggle */}
          <div className="rounded-xl border border-border p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Save size={12} className="text-muted-foreground" /> Onde salvar esta configuração?
            </p>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={saveLocal} onChange={e => setSaveLocal(e.target.checked)}
                className="mt-0.5 rounded border-border accent-primary" />
              <div>
                <p className="text-xs font-medium group-hover:text-foreground transition-colors">Salvar apenas no Local Storage</p>
                <p className="text-[10px] text-muted-foreground">Ficará só neste navegador. Sem essa opção, salva na Cloud/API (compartilhado entre dispositivos).</p>
              </div>
            </label>
            <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg font-medium transition-all
              ${saveLocal ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-sky-500/10 text-sky-600 border border-sky-500/20"}`}>
              {saveLocal ? <><HardDrive size={11} /> Local Storage (apenas neste browser)</> : <><Cloud size={11} /> Cloud/API (sincronizado entre dispositivos)</>}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1 gap-1.5" disabled={loading || !name.trim()}>
              {loading ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
              {saveLocal ? "Salvar Localmente" : "Salvar na Cloud"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Import JSON button ─────────────────────────────────────────
function ImportJsonButton({ onImport }) {
  const ref = useRef()
  return (
    <>
      <input ref={ref} type="file" accept=".json" className="hidden" onChange={async e => {
        const file = e.target.files?.[0]
        if (!file) return
        const text = await file.text()
        onImport(text)
        e.target.value = ''
      }} />
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => ref.current?.click()}>
        <Upload size={12} /> Importar JSON
      </Button>
    </>
  )
}

// Calls the existing /api/auth/pin/verify endpoint then resolves true/false
async function verifyDbPin(pin) {
  try {
    const r = await fetch('/api/auth/pin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    const d = await r.json()
    return d.status === 'success'
  } catch { return false }
}

function DbPinDialog({ dbName, onSuccess, onCancel }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (pin.length < 4) return
    setBusy(true); setError(null)
    const ok = await verifyDbPin(pin)
    setBusy(false)
    if (ok) onSuccess()
    else { setError('PIN incorreto'); setPin('') }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="w-full max-w-xs bg-card border border-border rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Lock size={15} className="text-primary" />
          <div className="flex-1">
            <p className="font-bold text-sm">Banco protegido por PIN</p>
            <p className="text-xs text-muted-foreground truncate">{dbName}</p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent transition-colors"><X size={14} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <input
            type="password" value={pin} onChange={e => setPin(e.target.value)}
            placeholder="Digite o PIN" autoFocus maxLength={10}
            className="w-full text-center text-lg font-mono tracking-[0.3em] bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {error && <p className="text-xs text-destructive text-center">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="flex-1 h-9 rounded-xl border border-border text-sm hover:bg-accent text-muted-foreground">Cancelar</button>
            <button type="submit" disabled={busy || pin.length < 4}
              className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
              {busy ? <RefreshCw size={13} className="animate-spin" /> : <Lock size={13} />} Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── DB Card ──────────────────────────────────────────────────
function DbCard({ db, mode, MODES, onSelect, onOpen, onRemove, hidden }) {
  const [expanded, setExpanded] = useState(false)
  const [showPinDlg, setShowPinDlg] = useState(false)
  const isActive = db.is_current
  const hasPinLock = db.has_pin && !isActive  // lock non-active PIN-protected DBs
  const balance = db.total_balance ?? db.balance ?? 0
  const positive = balance >= 0
  const hasStats = db.account_count != null || db.accounts != null

  const handleClick = () => {
    if (isActive) { onOpen(); return }
    if (hasPinLock) { setShowPinDlg(true); return }
    onSelect(db)
  }

  return (
    <Card className={`relative overflow-hidden transition-all duration-300 group
      ${isActive
        ? "border-primary/60 bg-primary/5 shadow-primary/10 shadow-md ring-1 ring-primary/20"
        : "hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30"
      }`}>

      {/* PIN dialog overlay */}
      {showPinDlg && <DbPinDialog dbName={db.name} onSuccess={() => { setShowPinDlg(false); onSelect(db) }} onCancel={() => setShowPinDlg(false)} />}

      {isActive && (
        <div className="absolute top-3 right-10 flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full z-10">
          <CheckCircle2 size={9} /> Ativo
        </div>
      )}
      {hasPinLock && (
        <div className="absolute top-3 right-10 flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-accent border border-border px-2 py-0.5 rounded-full z-10">
          <Lock size={9} /> PIN
        </div>
      )}

      <CardContent className="pt-5 pb-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3 cursor-pointer" onClick={handleClick}>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors
            ${isActive ? "bg-primary text-primary-foreground" : hasPinLock ? "bg-accent text-muted-foreground" : "bg-accent/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"}`}>
            {hasPinLock ? <Lock size={16} /> : <Database size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm leading-tight truncate">{db.name}</h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <SourceBadge storageType={db.storageType} />
              <TypeBadge type={db.type || (mode === MODES.BROWSER ? 'browser' : 'api')} />
              {db.db_version && (
                <span className="text-[9px] font-mono text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">v{db.db_version}</span>
              )}
              {db.size > 0 && <span className="text-[9px] text-muted-foreground font-mono">{humanSize(db.size)}</span>}
            </div>
          </div>
        </div>

        {/* Error */}
        {db.error ? (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle size={12} /> {db.error}
          </div>
        ) : hasPinLock ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/40 rounded-lg px-3 py-2">
            <Lock size={11} /> Protegido por PIN — clique para desbloquear
          </div>
        ) : hasStats && (
          <>
            {/* Balance & Wealth */}
            <div className="grid grid-cols-2 gap-4 cursor-pointer" onClick={handleClick}>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Saldo Total</p>
                <p className={`text-lg font-bold tabular-nums leading-none amount-value ${positive ? "text-success" : "text-destructive"}`}>
                  <BlurValue hidden={hidden}>{formatCurrency(balance)}</BlurValue>
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Patrimônio Real</p>
                <p className={`text-lg font-bold tabular-nums leading-none amount-value ${(db.real_net_worth || 0) >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  <BlurValue hidden={hidden}>{formatCurrency(db.real_net_worth || 0)}</BlurValue>
                </p>
              </div>
            </div>

            <div className="pt-1 cursor-pointer" onClick={handleClick}>
              <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-0.5">Total BRUTO (Saldos + Patr.)</p>
              <p className={`text-2xl font-black tabular-nums leading-none amount-value ${(db.total_wealth || 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                <BlurValue hidden={hidden}>{formatCurrency(db.total_wealth || 0)}</BlurValue>
              </p>
            </div>

            {/* Month stats */}
            <div className="flex gap-3 flex-wrap text-[10px]">
              <div className="flex items-center gap-1">
                <TrendingUp size={10} className="text-emerald-500" />
                <span className="text-muted-foreground font-medium">Entradas mês</span>
                <span className="text-emerald-500 font-bold font-mono"><BlurValue hidden={hidden}>{formatCurrency(db.month_income || 0)}</BlurValue></span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown size={10} className="text-rose-500" />
                <span className="text-muted-foreground font-medium">Saídas mês</span>
                <span className="text-rose-500 font-bold font-mono"><BlurValue hidden={hidden}>{formatCurrency(db.month_expense || 0)}</BlurValue></span>
              </div>
            </div>

            {/* Counts */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-border/40 text-[10px]">
              <div className="flex items-center gap-1"><Wallet size={10} className="text-primary" /><span className="text-muted-foreground">Contas</span><span className="font-mono font-semibold">{db.account_count ?? db.accounts ?? "—"}</span></div>
              <div className="flex items-center gap-1"><FileText size={10} /><span className="text-muted-foreground">Transações</span><span className="font-mono font-semibold">{(db.txn_count ?? db.transactions ?? 0).toLocaleString()}</span></div>
              {(db.last_txn_date || db.lastDate) && (
                <div className="flex items-center gap-1"><Calendar size={10} /><span className="text-muted-foreground">Última</span><span className="font-mono font-semibold">{db.last_txn_date || db.lastDate}</span></div>
              )}
            </div>
          </>
        )}

        {/* Config-only card (no stats) — for db-configs without live stats */}
        {!hasStats && !db.error && (
          <div className="text-xs text-muted-foreground italic py-1">
            {db.baseUrl || db.base_url ? (
              <span className="font-mono text-[10px] text-primary/70 truncate block">{db.baseUrl || db.base_url}</span>
            ) : "Banco registrado — clique para conectar"}
          </div>
        )}

        {/* Expanded detail panel */}
        {expanded && (
          <div className="pt-2 border-t border-border/40 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Detalhes</p>
            {[
              { label: "Arquivo", val: db.filename || db.name },
              { label: "Caminho", val: db.path || db.db_path || db.dbPath || "—", truncate: true },
              { label: "Tamanho", val: humanSize(db.size) },
              { label: "Versão", val: db.db_version ? `v${db.db_version}` : "—" },
              { label: "URL Base", val: db.baseUrl || db.base_url || "(API configurada)" },
              { label: "Config em", val: db.storageType === 'local' ? "Local Storage" : "Cloud/API" },
            ].map(({ label, val, truncate }) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <span className="text-[10px] text-muted-foreground shrink-0">{label}</span>
                <span className={`text-[10px] font-mono text-primary/80 text-right ${truncate ? "truncate max-w-[180px]" : ""}`} title={truncate ? val : undefined}>{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1.5 pt-1">
          {isActive ? (
            <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={onOpen}>
              Dashboard <ArrowRight size={12} />
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 group-hover:border-primary/50 group-hover:text-primary" onClick={() => onSelect(db)}>
              Selecionar <ArrowRight size={12} />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive/50 hover:text-destructive" onClick={() => onRemove(db)} title="Remover">
            <Trash2 size={13} />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Browser: file actions card ─────────────────────────────────
function BrowserActionsCard({ onOpen, onCreate }) {
  return (
    <Card className="border-dashed border-border hover:border-primary/30 transition-all">
      <CardContent className="pt-5 pb-4 space-y-3 min-h-[200px] flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-xl bg-accent/60 flex items-center justify-center"><HardDrive size={16} className="text-muted-foreground" /></div>
          <div><p className="font-bold text-sm">Adicionar Banco</p><p className="text-[10px] text-muted-foreground">Arquivo .db local</p></div>
        </div>
        <Button className="w-full h-9 text-sm gap-2" onClick={onOpen}><FolderOpen size={14} /> Abrir Arquivo .db</Button>
        <Button variant="outline" className="w-full h-9 text-sm gap-2" onClick={onCreate}><Plus size={14} /> Criar Novo .db</Button>
      </CardContent>
    </Card>
  )
}

// ── Sync bar (browser) ─────────────────────────────────────────
function SyncBar({ syncToDisk, autoSaveEnabled, setAutoSave }) {
  const [syncing, setSyncing] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const handleSync = async () => {
    setSyncing(true)
    try { const ok = await syncToDisk(); if (ok) setLastSaved(new Date()) }
    finally { setSyncing(false) }
  }
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs flex-wrap gap-y-2">
      <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
      <span className="text-muted-foreground">Dados no OPFS</span>
      {lastSaved && <span className="text-emerald-600">· Salvo {lastSaved.toLocaleTimeString()}</span>}
      <div className="ml-auto flex items-center gap-3">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={autoSaveEnabled} onChange={e => setAutoSave(e.target.checked)} className="rounded h-3 w-3 accent-primary" />
          <span className="text-muted-foreground">Auto-save 30s</span>
        </label>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleSync} disabled={syncing}>
          {syncing ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />} Salvar no Disco
        </Button>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate()
  const { alert, confirm } = useNotification()
  const {
    mode, MODES, currentDb, loading,
    hasFsAccess: fsAccess, switchMode, selectDatabase,
    createDatabase, openFilePicker, createBrowserDatabase,
    removeBrowserDatabase, syncToDisk, autoSaveEnabled, setAutoSave,
    refresh, serverDatabases: flaskDbs, databases: allDbs, localConfigs,
  } = useDatabase()

  const { hidden, toggleHidden } = usePrivacy()
  const [sourceFilter, setSourceFilter] = useState('all')
  const [showAddDialog, setShowAddDialog] = useState(false)



  const counts = {
    all: allDbs.length,
    cloud: allDbs.filter(d => d.storageType !== 'local').length,
    local: allDbs.filter(d => d.storageType === 'local').length,
  }

  const filteredDbs = sourceFilter === 'cloud'
    ? allDbs.filter(d => d.storageType !== 'local')
    : sourceFilter === 'local'
      ? allDbs.filter(d => d.storageType === 'local')
      : allDbs

  const totalBalance = allDbs.reduce((s, d) => s + (d.total_balance ?? d.balance ?? 0), 0)
  const totalTxns = allDbs.reduce((s, d) => s + (d.txn_count ?? d.transactions ?? 0), 0)

  // ── Handlers ─────────────────────────────────────────────────
  const handleSelect = async (db) => {
    if (db.storageType === 'local' && !db.path) {
      alert('info', `"${db.name}" é uma config local. Conecte o servidor para selecioná-lo.`)
      return
    }
    if (db.is_current) { navigate("/dashboard"); location.reload(true); return }
    const ok = await selectDatabase(db.path)
    if (ok) alert("success", `Banco "${db.name}" selecionado!`);
    location.reload(true);
  }

  const handleRemove = async (db) => {
    if (!await confirm(`Remover "${db.name}" da lista?`)) return
    if (db.storageType === 'local') {
      removeLocalConfig(db.id)
      refresh()
    } else if (db.storageType === 'cloud' && !flaskDbs.find(f => f.path === db.path)) {
      await fetch(`/api/db-configs/${db.id}`, { method: 'DELETE' })
      refresh()
    } else if (mode === MODES.BROWSER) {
      await removeBrowserDatabase(db.path)
    } else {
      alert('info', 'Bancos físicos no servidor não podem ser removidos da lista daqui.')
      return
    }
    alert("info", `"${db.name}" removido.`)
  }

  const handleAdd = async ({ type, name, baseUrl, dbPath, saveLocal, engine }) => {
    const config = {
      name,
      type,
      baseUrl,
      dbPath,
      filename: dbPath ? dbPath.split('/').pop() : '',
    }
    if (saveLocal) {
      saveLocalConfig(config)
      refresh()
      alert("success", `"${name}" salvo no Local Storage.`)
    } else {
      // Save in cloud API
      const body = { name, type, base_url: baseUrl, db_path: dbPath, filename: dbPath ? dbPath.split('/').pop() : '', engine }
      if (type === 'api' && !dbPath) {
        // Also create the physical DB on the server
        await createDatabase(name, engine)
        await refresh()
      } else {
        await fetch('/api/db-configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        await refresh()
      }
      alert("success", `"${name}" salvo na Cloud/API.`)
    }
  }

  const handleOpenFile = async () => {
    try { const key = await openFilePicker(); alert("success", `"${key}" importado!`) }
    catch (e) { alert("error", e.message) }
  }

  const handleExport = () => {
    const data = exportConfigsAsJson()
    downloadJson(data, 'db-configs.json')
    alert("success", "Arquivo JSON exportado!")
  }

  const handleImport = (jsonStr) => {
    try {
      const { added } = importConfigsFromJson(jsonStr)
      refresh()
      alert("success", `${added} config(s) importada(s) com sucesso!`)
    } catch (e) {
      alert("error", `Erro ao importar: ${e.message}`)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Hero ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-start justify-between flex-wrap gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                <Layers size={20} className="text-primary-foreground" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">FinancePro</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Dados</h1>
            <p className="text-muted-foreground mt-1.5 text-sm max-w-lg">Multi-banco · API configurada, Self-hosted ou Browser Local</p>
          </div>
          <div className="flex gap-2 items-start flex-wrap">
            <Button variant="ghost" size="icon" onClick={toggleHidden} className="h-9 w-9 text-muted-foreground hover:text-foreground" title={hidden ? "Mostrar valores" : "Ocultar valores"}>
              {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refresh()} className="gap-1.5 text-xs">
              <RefreshCw size={13} /> Atualizar
            </Button>
            {currentDb && (
              <Button size="sm" onClick={() => { navigate('/dashboard'); }} className="gap-1.5 text-xs">
                Dashboard <ArrowRight size={13} />
              </Button>
            )}
          </div>
        </div>

        {/* Aggregate stats */}
        <div className="relative mt-6 grid grid-cols-3 gap-4">
          {[
            { icon: Database, label: "Bancos", val: allDbs.length, color: "text-primary", noBlur: true },
            { icon: Wallet, label: "Saldo Combinado", val: formatCurrency(totalBalance), color: totalBalance >= 0 ? "text-emerald-500" : "text-rose-500" },
            { icon: FileText, label: "Transações", val: totalTxns.toLocaleString(), color: "text-foreground" },
          ].map(s => (
            <div key={s.label} className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/60">
              <div className="flex items-center gap-2 mb-1">
                <s.icon size={14} className={s.color} />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</span>
              </div>
              <p className={`text-xl font-bold tabular-nums amount-value ${s.color}`}>
                {s.noBlur ? s.val : <BlurValue hidden={hidden}>{s.val}</BlurValue>}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Mode Toggle ── */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Zap size={14} className="text-primary" /> Modo de Operação
          <span className={`text-[10px] font-bold flex items-center gap-1 ml-auto ${mode === MODES.BROWSER ? "text-emerald-600" : "text-primary"}`}>
            {mode === MODES.BROWSER ? <><WifiOff size={10} /> Browser Local</> : <><Globe size={10} /> API</>}
          </span>
        </h2>
        <ModeToggle mode={mode} MODES={MODES} onSwitch={switchMode} hasFsAccess={fsAccess} />
      </div>

      {/* ── Active indicator ── */}
      {
        currentDb && (
          <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-sm">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-muted-foreground">Banco ativo:</span>
            <span className="font-semibold text-primary flex items-center gap-1.5"><HardDrive size={13} />{currentDb.name}</span>
            <Button size="sm" variant="ghost" className="ml-auto text-xs h-7 gap-1" onClick={() => navigate("/dashboard")}>
              Abrir <ArrowRight size={11} />
            </Button>
          </div>
        )
      }

      {/* ── Browser sync bar ── */}
      {
        mode === MODES.BROWSER && allDbs.length > 0 && (
          <SyncBar syncToDisk={syncToDisk} autoSaveEnabled={autoSaveEnabled} setAutoSave={setAutoSave} />
        )
      }

      {/* ── DB List ── */}
      <div className="space-y-4">
        {/* Section header with filter + actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Database size={14} className="text-primary" /> Bancos de Dados
            </h2>
            <SourceFilter value={sourceFilter} onChange={setSourceFilter} counts={counts} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={toggleHidden} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              {hidden ? <><EyeOff size={11} /> Revelar</> : <><Eye size={11} /> Ocultar</>}
            </button>
            <div className="w-px h-4 bg-border" />
            {/* Export/Import localStorage configs */}
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExport} title="Exportar configs do Local Storage como JSON">
              <Download size={12} /> Exportar JSON
            </Button>
            <ImportJsonButton onImport={handleImport} />
            <div className="w-px h-4 bg-border" />
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => mode === MODES.BROWSER ? null : setShowAddDialog(true)}>
              <Plus size={13} /> Adicionar
            </Button>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
            <RefreshCw size={20} className="animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDbs.map((db) => (
              <DbCard
                key={db.id}
                db={db}
                mode={mode}
                MODES={MODES}
                onSelect={handleSelect}
                onOpen={() => { navigate("/dashboard") && location.reload(true); }}
                onRemove={handleRemove}
                hidden={hidden}
              />
            ))}

            {/* Add Card */}
            {mode === MODES.BROWSER
              ? <BrowserActionsCard onOpen={handleOpenFile} onCreate={async () => { try { await createBrowserDatabase(); alert("success", "Banco criado!") } catch (e) { alert("error", e.message) } }} />
              : (
                <Card className="border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group" onClick={() => setShowAddDialog(true)}>
                  <CardContent className="pt-5 pb-4 flex flex-col items-center justify-center gap-3 min-h-[200px]">
                    <div className="h-12 w-12 rounded-xl bg-accent/60 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                      <Plus size={22} className="text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors">Adicionar Banco</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">API ou Self-hosted</p>
                    </div>
                  </CardContent>
                </Card>
              )
            }
          </div>
        )}

        {/* Local Storage section */}
        {localConfigs.length > 0 && sourceFilter !== 'cloud' && (
          <div className="mt-2 px-4 py-3 bg-amber-500/5 border border-amber-500/15 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <HardDrive size={13} className="text-amber-600" />
              <span className="text-muted-foreground">{localConfigs.length} configuração(ões) salva(s) no Local Storage deste browser.</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-amber-600" onClick={handleExport}>
                <Download size={11} /> Exportar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="text-center text-xs text-muted-foreground pb-4 space-y-1">
        {mode === MODES.FLASK && <p>Bancos físicos em <code className="font-mono text-primary">{flaskDbs[0]?.path?.replace(/\/[^/]+$/, '') || '…'}</code></p>}
        {mode === MODES.BROWSER && <p>Dados ativos no <code className="font-mono text-primary">OPFS</code> · "Salvar no Disco" persiste no arquivo físico</p>}
        <p className="text-[10px]">Configs <span className="text-amber-600 font-medium">Local Storage</span> ficam só neste browser · Configs <span className="text-sky-600 font-medium">Cloud/API</span> são compartilhadas entre dispositivos</p>
      </div>

      {/* Add dialog */}
      {
        showAddDialog && (
          <AddDbDialog
            onClose={() => setShowAddDialog(false)}
            onAdd={handleAdd}
            currentMode={mode}
            MODES={MODES}
          />
        )
      }
    </div >
  )
}
