import { useState, useEffect, useCallback } from "react"
import {
  FileText, RefreshCw, Play, CheckCircle2, XCircle, AlertCircle,
  ChevronDown, ChevronUp, Clock, Hash, Database, Upload,
  ShieldCheck, SkipForward, Loader2, Filter, RotateCcw, History,
} from "lucide-react"

// ── api helpers (fetch interceptor in AuthContext adds the token automatically)
const api = {
  get: (path) => fetch(path).then(r => r.json()),
  post: (path, body) => fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json()),
}

// ── helpers ────────────────────────────────────────────────────────────────
function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function fmtDate(iso) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleString("pt-BR") } catch { return iso }
}

const STATUS_META = {
  ok: { icon: CheckCircle2, color: "text-emerald-400", label: "Importado" },
  error: { icon: XCircle, color: "text-red-400", label: "Erro" },
  skipped: { icon: SkipForward, color: "text-amber-400", label: "Ignorado (já processado)" },
}

// ── sub-components ──────────────────────────────────────────────────────────
function Badge({ children, color = "bg-primary/10 text-primary" }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>
      {children}
    </span>
  )
}

function ResultRow({ r }) {
  const meta = STATUS_META[r.status] ?? STATUS_META.error
  const Icon = meta.icon
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border text-sm">
      <Icon size={16} className={`mt-0.5 shrink-0 ${meta.color}`} />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-foreground">{r.filename}</p>
        {r.error && <p className="text-xs text-red-400 mt-0.5">{r.error}</p>}
        {r.status === "ok" && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {r.imported} importadas · {r.duplicates} duplicadas · {r.invalid} inválidas
          </p>
        )}
        {r.status === "skipped" && (
          <p className="text-xs text-muted-foreground mt-0.5">MD5: {r.md5?.slice(0, 12)}…</p>
        )}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
    </div>
  )
}

function LogTable({ logs }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <History size={15} className="text-primary" />
          Histórico de Importações ({logs.length})
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-border">
          {logs.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma importação registrada.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Arquivo", "MD5", "Banco", "Conta", "Importadas", "Duplic.", "Inválidas", "Data"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
                    <td className="px-3 py-2 font-medium text-foreground max-w-[180px] truncate">{l.filename}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{l.md5?.slice(0, 10)}…</td>
                    <td className="px-3 py-2"><Badge>{l.bank}</Badge></td>
                    <td className="px-3 py-2 text-muted-foreground">{l.account_id ?? "—"}</td>
                    <td className="px-3 py-2 text-emerald-400 font-semibold">{l.imported}</td>
                    <td className="px-3 py-2 text-amber-400">{l.duplicates}</td>
                    <td className="px-3 py-2 text-red-400">{l.invalid}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(l.processed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── main page ───────────────────────────────────────────────────────────────
export default function ProcessarArquivos() {

  const [files, setFiles] = useState([])       // all .csv.enc in folder
  const [logs, setLogs] = useState([])       // import history
  const [accounts, setAccounts] = useState([])
  const [profiles, setProfiles] = useState([])

  const [selected, setSelected] = useState(new Set()) // selected filenames
  const [bank, setBank] = useState("generic")
  const [accountId, setAccountId] = useState("")
  const [importType, setImportType] = useState("debit")  // debit | credit

  const [showProcessed, setShowProcessed] = useState(false)

  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState(null)

  // ── fetch data ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [files, logs, accs, profs] = await Promise.all([
        api.get("/api/files"),
        api.get("/api/files/log"),
        api.get("/api/accounts"),
        api.get("/api/import/profiles"),
      ])
      setFiles(Array.isArray(files) ? files : [])
      setLogs(Array.isArray(logs) ? logs : [])
      setAccounts(Array.isArray(accs) ? accs : [])
      if (Array.isArray(accs) && accs.length > 0) setAccountId(a => a || String(accs[0].id))
      setProfiles(Array.isArray(profs) ? profs : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── visible files ─────────────────────────────────────────────────────────
  const visible = files.filter(f => showProcessed || !f.already_processed)

  const allSelected = visible.length > 0 && visible.every(f => selected.has(f.filename))

  function toggleSelect(fname) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(fname) ? next.delete(fname) : next.add(fname)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        visible.forEach(f => next.delete(f.filename))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        visible.forEach(f => next.add(f.filename))
        return next
      })
    }
  }

  // ── process ───────────────────────────────────────────────────────────────
  async function handleProcess() {
    if (selected.size === 0 || !accountId) return
    setProcessing(true)
    setResults(null)
    try {
      const data = await api.post("/api/files/process", {
        files: [...selected],
        bank,
        account_id: Number(accountId),
        type: importType,
      })
      setResults(data.results ?? [])
      setSelected(new Set())
      fetchAll()
    } catch (e) {
      setResults([{ filename: "—", status: "error", error: String(e) }])
    } finally {
      setProcessing(false)
    }
  }

  const pendingCount = files.filter(f => !f.already_processed).length
  const processedCount = files.filter(f => f.already_processed).length
  const selectedArr = [...selected]

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Upload size={22} className="text-primary" />
            Processar Arquivos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importe extratos <code className="text-xs bg-muted px-1 py-0.5 rounded">.csv.enc</code> criptografados diretamente da pasta <code className="text-xs bg-muted px-1 py-0.5 rounded">files/</code>
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: files.length, icon: FileText, color: "text-primary" },
          { label: "Pendentes", value: pendingCount, icon: AlertCircle, color: "text-amber-400" },
          { label: "Processados", value: processedCount, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Selecionados", value: selected.size, icon: ShieldCheck, color: "text-blue-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2 bg-accent/50 rounded-xl">
              <s.icon size={16} className={s.color} />
            </div>
            <div>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* ── File List ── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Arquivos disponíveis</span>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showProcessed}
                onChange={e => setShowProcessed(e.target.checked)}
                className="rounded"
              />
              <Filter size={11} />
              Mostrar processados
            </label>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 size={24} className="animate-spin" />
              <p className="text-sm">Carregando arquivos…</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border border-dashed border-border text-muted-foreground">
              <FileText size={32} className="opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {showProcessed ? "Nenhum arquivo .csv.enc encontrado" : "Nenhum arquivo pendente"}
                </p>
                <p className="text-xs mt-1">
                  {!showProcessed && processedCount > 0
                    ? `${processedCount} arquivo(s) já foram processados. Ative "Mostrar processados" para vê-los.`
                    : "Coloque arquivos .csv.enc na pasta files/ do servidor."}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {/* Select-all header */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/20">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded"
                  id="select-all-files"
                />
                <label htmlFor="select-all-files" className="text-xs font-semibold cursor-pointer text-muted-foreground uppercase tracking-wide">
                  Selecionar tudo ({visible.length})
                </label>
              </div>

              <div className="divide-y divide-border/40">
                {visible.map(f => (
                  <label
                    key={f.filename}
                    className={`flex items-start gap-3 p-4 cursor-pointer transition-colors hover:bg-accent/30 ${f.already_processed ? "opacity-50" : ""
                      } ${selected.has(f.filename) ? "bg-primary/5" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(f.filename)}
                      onChange={() => toggleSelect(f.filename)}
                      className="mt-0.5 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className=" whitespace-pre-wrap break-words font-medium text-sm text-foreground truncate">{f.filename}</span>
                        {f.already_processed && (
                          <Badge color="bg-emerald-500/10 text-emerald-400">✓ Processado</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Database size={10} />{fmt(f.size)}</span>
                        <span className="flex items-center gap-1"><Clock size={10} />{fmtDate(f.modified_at)}</span>
                        <span className="flex items-center gap-1 font-mono"><Hash size={10} />{f.md5?.slice(0, 10)}…</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Config sidebar ── */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <ShieldCheck size={14} className="text-primary" />
              Configurações de Importação
            </h2>

            {/* Bank profile */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Modelo de Ingestão
              </label>
              <select
                value={bank}
                onChange={e => setBank(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Account */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Conta de Destino
              </label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {accounts.length === 0 && <option value="">— Nenhuma conta —</option>}
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tipo de Integração
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "debit", l: "Débito / Conta" },
                  { v: "credit", l: "Crédito / Fatura" },
                ].map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => setImportType(opt.v)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${importType === opt.v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:bg-accent"
                      }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            {selectedArr.length > 0 && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1">
                <p className="font-semibold text-primary">{selectedArr.length} arquivo(s) selecionado(s)</p>
                <ul className="text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
                  {selectedArr.map(n => <li key={n} className="truncate">· {n}</li>)}
                </ul>
              </div>
            )}

            {/* Process button */}
            <button
              onClick={handleProcess}
              disabled={processing || selectedArr.length === 0 || !accountId}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {processing
                ? <><Loader2 size={15} className="animate-spin" /> Processando…</>
                : <><Play size={15} /> Processar {selectedArr.length > 0 ? `(${selectedArr.length})` : ""}</>
              }
            </button>
          </div>

          {/* Reset results */}
          {results && (
            <button
              onClick={() => setResults(null)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw size={11} /> Limpar resultados
            </button>
          )}
        </div>
      </div>

      {/* ── Processing results ── */}
      {results && (
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <CheckCircle2 size={14} className="text-primary" />
            Resultado do Processamento
          </h2>
          <div className="space-y-2">
            {results.map((r, i) => <ResultRow key={i} r={r} />)}
          </div>
        </div>
      )}

      {/* ── Log history ── */}
      <LogTable logs={logs} />
    </div>
  )
}
