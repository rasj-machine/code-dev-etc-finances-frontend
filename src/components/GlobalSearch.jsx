import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Search, ArrowRightLeft, Building2, X, CheckCircle2, Hash } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

function useDebounce(value, ms = 260) {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return dv
}

/** Humanise the parsed query back to a readable label */
function queryHint(q) {
  q = q.trim()
  if (/^#\d+$/.test(q)) return `ID ${q}`
  if (/^[><=]{1,2}\s*[\d.,]+$/.test(q)) return `Valor ${q}`
  if (/^\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4}$/.test(q)) return `Período ${q}`
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(q)) return `Data ${q}`
  return null
}

export default function GlobalSearch() {
  const [query, setQuery]     = useState("")
  const [results, setResults] = useState([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef()
  const wrapRef  = useRef()
  const navigate = useNavigate()
  const dq       = useDebounce(query, 260)

  // Cmd/Ctrl + K
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === "Escape") { setOpen(false); setQuery("") }
    }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [])

  // Click-outside
  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  // Fetch — allow single char for operators like #5
  useEffect(() => {
    const q = dq.trim()
    if (q.length < 1) {
      setResults(prev => prev.length ? [] : prev)
      return
    }
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => { setResults(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [dq])

  const pick = (r) => {
    if (r.kind === "transaction") navigate(`/transacoes?id=${r.id}`)
    if (r.kind === "entity")      navigate(`/vinculos?id=${r.id}`)
    setOpen(false); setQuery("")
  }

  const hint    = queryHint(query)
  const txns    = results.filter(r => r.kind === "transaction")
  const ents    = results.filter(r => r.kind === "entity")
  const hasRes  = results.length > 0
  const showDrop = open && query.trim().length >= 1

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <div className={`flex items-center gap-2 h-9 px-3 rounded-xl border transition-all bg-card ${open ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
        <Search size={14} className="text-muted-foreground shrink-0"/>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar… #id, >100, 01/01/2025, NETFLIX"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
        />
        {query ? (
          <button onClick={() => { setQuery(""); setResults([]) }}><X size={13} className="text-muted-foreground hover:text-foreground"/></button>
        ) : (
          <kbd className="hidden md:inline text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
        )}
      </div>

      {showDrop && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden max-h-[440px] overflow-y-auto">

          {/* Smart query badge */}
          {hint && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-primary/5">
              <Hash size={12} className="text-primary"/>
              <span className="text-xs font-medium text-primary">{hint}</span>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin"/>
              Buscando…
            </div>
          )}
          {!loading && !hasRes && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum resultado
              <p className="text-xs mt-1 text-muted-foreground/60">
                Tente: <code className="bg-muted px-1 rounded">#123</code>&nbsp;
                <code className="bg-muted px-1 rounded">&gt;500</code>&nbsp;
                <code className="bg-muted px-1 rounded">01/01/2025</code>&nbsp;
                <code className="bg-muted px-1 rounded">01/01/2025-31/12/2025</code>
              </p>
            </div>
          )}

          {txns.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Transações <span className="font-normal">({txns.length})</span>
              </p>
              {txns.map((r) => (
                <button key={r.id} onClick={() => pick(r)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/60 transition-colors text-left">
                  <ArrowRightLeft size={14} className={r.type === "expense" ? "text-destructive" : "text-success"}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-mono tabular-nums">#{r.id}</span>
                      <p className="text-sm font-medium truncate">{r.description}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.date)}
                      {r.category && ` · ${r.category}`}
                      {r.account_name && ` · ${r.account_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(r.conciliation_status & 1) === 1 && <CheckCircle2 size={12} className="text-success"/>}
                    <span className={`text-sm font-bold tabular-nums ${r.type === "expense" ? "text-destructive" : "text-success"}`}>
                      {r.type === "expense" ? "-" : "+"}{formatCurrency(r.amount)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {ents.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Vínculos <span className="font-normal">({ents.length})</span>
              </p>
              {ents.map((r) => (
                <button key={r.id} onClick={() => pick(r)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/60 transition-colors text-left">
                  <Building2 size={14} className="text-primary"/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-mono tabular-nums">#{r.id}</span>
                      <p className="text-sm font-medium">{r.name}</p>
                    </div>
                    {r.document && <p className="text-xs text-muted-foreground truncate">{r.document}{r.bank && ` · ${r.bank}`}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground capitalize shrink-0">{r.type}</span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border/50 px-4 py-2 flex gap-4 text-xs text-muted-foreground">
            <span><code className="bg-muted px-1 rounded">#123</code> ID</span>
            <span><code className="bg-muted px-1 rounded">&gt;100</code> valor</span>
            <span><code className="bg-muted px-1 rounded">01/01/2025</code> data</span>
            <span>Esc fechar</span>
          </div>
        </div>
      )}
    </div>
  )
}
