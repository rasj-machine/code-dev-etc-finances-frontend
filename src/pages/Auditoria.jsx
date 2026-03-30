import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, Button, Input, Select } from "@/components/ui"
import {
  Shield, Search, RefreshCw, ChevronDown, ChevronUp,
  Clock, User, Table2, Activity, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, LogIn, LogOut, Trash2, Pencil, Plus,
  Eye, Filter, Database, ArrowRight
} from "lucide-react"

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (s) => {
  if (!s) return "—"
  const d = new Date(s)
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

const ACTION_META = {
  create:          { label: "Criação",         icon: Plus,          color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  update:          { label: "Alteração",        icon: Pencil,        color: "text-blue-500",    bg: "bg-blue-500/10 border-blue-500/20" },
  delete:          { label: "Exclusão",         icon: Trash2,        color: "text-red-500",     bg: "bg-red-500/10 border-red-500/20" },
  login:           { label: "Login",            icon: LogIn,         color: "text-purple-500",  bg: "bg-purple-500/10 border-purple-500/20" },
  login_2fa:       { label: "Login 2FA",        icon: LogIn,         color: "text-purple-500",  bg: "bg-purple-500/10 border-purple-500/20" },
  login_fail:      { label: "Login Falhou",     icon: AlertTriangle, color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/20" },
  "2fa_fail":      { label: "2FA Falhou",       icon: AlertTriangle, color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/20" },
  logout:          { label: "Logout",           icon: LogOut,        color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
  register:        { label: "Cadastro",         icon: User,          color: "text-teal-500",    bg: "bg-teal-500/10 border-teal-500/20" },
  change_password: { label: "Senha Alterada",   icon: Shield,        color: "text-orange-500",  bg: "bg-orange-500/10 border-orange-500/20" },
}

const TABLE_LABELS = {
  transactions: "Transações",
  accounts:     "Contas",
  investments:  "Investimentos",
  entities:     "Entidades",
  categories:   "Categorias",
  tags:         "Tags",
}

function ActionBadge({ action }) {
  const meta = ACTION_META[action] || { label: action, icon: Activity, color: "text-muted-foreground", bg: "bg-muted/30 border-border" }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.bg} ${meta.color}`}>
      <Icon size={9} /> {meta.label}
    </span>
  )
}

// ── Stats Summary ─────────────────────────────────────────────────────────────
function StatsRow({ stats }) {
  if (!stats?.total_logs) return null
  const cards = [
    { label: "Total de Eventos", value: (stats.total_logs || 0).toLocaleString("pt-BR"), icon: Activity, color: "text-primary" },
    { label: "Alterações de Campo", value: (stats.total_changes || 0).toLocaleString("pt-BR"), icon: Pencil, color: "text-blue-500" },
    { label: "Ação mais frequente", value: stats.by_action?.[0]?.action ? (ACTION_META[stats.by_action[0].action]?.label || stats.by_action[0].action) : "—", icon: TrendingUp, color: "text-emerald-500" },
    { label: "Tabela mais alterada", value: TABLE_LABELS[stats.by_table?.[0]?.table_name] || stats.by_table?.[0]?.table_name || "—", icon: Table2, color: "text-amber-500" },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: CardIcon, color }) => ( // eslint-disable-line no-unused-vars
        <Card key={label}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <CardIcon size={13} className={color} />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
            </div>
            <p className="text-lg font-bold truncate">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Expandable row detail ─────────────────────────────────────────────────────
function LogRowDetail({ row }) {
  const [open, setOpen] = useState(false)
  let oldData = null, newData = null
  // eslint-disable-next-line no-empty
  try { oldData = row.old_data ? JSON.parse(row.old_data) : null } catch {}
  // eslint-disable-next-line no-empty
  try { newData = row.new_data ? JSON.parse(row.new_data) : null } catch {}

  const changedFields = useMemo(() => {
    if (!oldData || !newData) return []
    return Object.keys({ ...oldData, ...newData }).filter(k => {
      const skip = ['created_at','updated_at']
      return !skip.includes(k) && String(oldData?.[k] ?? '') !== String(newData?.[k] ?? '')
    })
  }, [oldData, newData])

  return (
    <>
      <tr
        className="border-b border-border/40 hover:bg-accent/20 transition-colors cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className="py-2 pr-3 tabular-nums text-muted-foreground text-[11px] whitespace-nowrap">{fmtDate(row.occurred_at)}</td>
        <td className="py-2 pr-3"><ActionBadge action={row.action} /></td>
        <td className="py-2 pr-3 text-xs">
          {row.table_name ? (
            <span className="font-mono text-muted-foreground">{TABLE_LABELS[row.table_name] || row.table_name}
              {row.record_id ? <span className="text-primary/70"> #{row.record_id}</span> : ""}
            </span>
          ) : "—"}
        </td>
        <td className="py-2 pr-3 text-xs font-medium max-w-xs truncate">{row.description || "—"}</td>
        <td className="py-2 pr-3 text-xs text-muted-foreground">{row.user_email || "—"}</td>
        <td className="py-2 pr-3 text-[10px] text-muted-foreground font-mono">{row.ip || "—"}</td>
        <td className="py-2 text-muted-foreground">
          {(oldData || newData) && (open ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
        </td>
      </tr>
      {open && (oldData || newData) && (
        <tr className="bg-accent/10">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {changedFields.length > 0 ? (
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Campos Alterados</p>
                  <div className="space-y-1">
                    {changedFields.map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground w-32 shrink-0 truncate">{f}</span>
                        <span className="text-red-400 line-through truncate max-w-[160px]">{String(oldData?.[f] ?? "—")}</span>
                        <ArrowRight size={10} className="text-muted-foreground shrink-0" />
                        <span className="text-emerald-400 truncate max-w-[160px]">{String(newData?.[f] ?? "—")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {oldData && (
                    <div>
                      <p className="text-[10px] font-semibold text-red-400 mb-1">Antes</p>
                      <pre className="text-[10px] bg-red-500/5 border border-red-500/10 rounded p-2 overflow-auto max-h-40">{JSON.stringify(oldData, null, 2)}</pre>
                    </div>
                  )}
                  {newData && (
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-400 mb-1">Depois</p>
                      <pre className="text-[10px] bg-emerald-500/5 border border-emerald-500/10 rounded p-2 overflow-auto max-h-40">{JSON.stringify(newData, null, 2)}</pre>
                    </div>
                  )}
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Change History row ────────────────────────────────────────────────────────
function ChangeRow({ row }) {
  return (
    <tr className="border-b border-border/40 hover:bg-accent/20 transition-colors">
      <td className="py-1.5 pr-3 tabular-nums text-muted-foreground text-[10px] whitespace-nowrap">{fmtDate(row.occurred_at)}</td>
      <td className="py-1.5 pr-3 text-[10px] font-mono">{TABLE_LABELS[row.table_name] || row.table_name} <span className="text-primary/60">#{row.record_id}</span></td>
      <td className="py-1.5 pr-3 text-[10px] font-mono text-muted-foreground">{row.field}</td>
      <td className="py-1.5 pr-3 text-[10px] text-red-400 font-mono max-w-[120px] truncate">{row.old_value ?? "—"}</td>
      <td className="py-1.5 pr-3">
        <ArrowRight size={9} className="text-muted-foreground" />
      </td>
      <td className="py-1.5 pr-3 text-[10px] text-emerald-400 font-mono max-w-[120px] truncate">{row.new_value ?? "—"}</td>
      <td className="py-1.5 text-[10px] text-muted-foreground">{row.user_email || "—"}</td>
    </tr>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Auditoria() {
  const [tab, setTab] = useState("logs")
  const [stats, setStats] = useState(null)
  const [logs, setLogs] = useState([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [changes, setChanges] = useState([])
  const [changesTotal, setChangesTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Log filters
  const [search, setSearch]       = useState("")
  const [filterAction, setFilterAction] = useState("")
  const [filterTable, setFilterTable]   = useState("")
  const [dateFrom, setDateFrom]   = useState("")
  const [dateTo, setDateTo]       = useState("")
  const [logsPage, setLogsPage]   = useState(0)
  const PAGE = 100

  // Changes filters
  const [chTable, setChTable]         = useState("")
  const [chField, setChField]         = useState("")
  const [chRecordId, setChRecordId]   = useState("")
  const [changesPage, setChangesPage] = useState(0)

  const loadStats = useCallback(async () => {
    const r = await fetch("/api/audit/stats").then(r => r.ok ? r.json() : {}).catch(() => ({}))
    setStats(r)
  }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ limit: PAGE, offset: logsPage * PAGE })
    if (search)       p.set("search", search)
    if (filterAction) p.set("action", filterAction)
    if (filterTable)  p.set("table", filterTable)
    if (dateFrom)     p.set("date_from", dateFrom)
    if (dateTo)       p.set("date_to", dateTo)
    const r = await fetch(`/api/audit/logs?${p}`).then(r => r.ok ? r.json() : { total: 0, items: [] }).catch(() => ({ total: 0, items: [] }))
    setLogs(r.items || [])
    setLogsTotal(r.total || 0)
    setLoading(false)
  }, [search, filterAction, filterTable, dateFrom, dateTo, logsPage])

  const loadChanges = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ limit: PAGE, offset: changesPage * PAGE })
    if (chTable)    p.set("table", chTable)
    if (chField)    p.set("field", chField)
    if (chRecordId) p.set("record_id", chRecordId)
    if (dateFrom)   p.set("date_from", dateFrom)
    if (dateTo)     p.set("date_to", dateTo)
    const r = await fetch(`/api/audit/changes?${p}`).then(r => r.ok ? r.json() : { total: 0, items: [] }).catch(() => ({ total: 0, items: [] }))
    setChanges(r.items || [])
    setChangesTotal(r.total || 0)
    setLoading(false)
  }, [chTable, chField, chRecordId, dateFrom, dateTo, changesPage])

  useEffect(() => { loadStats(); loadLogs() }, []) // eslint-disable-line
  useEffect(() => { if (tab === "logs")    loadLogs()    }, [loadLogs, tab])    // eslint-disable-line
  useEffect(() => { if (tab === "changes") loadChanges() }, [loadChanges, tab]) // eslint-disable-line

  const allActions = Object.keys(ACTION_META)
  const allTables  = Object.keys(TABLE_LABELS)

  const resetFilters = () => {
    setSearch(""); setFilterAction(""); setFilterTable("")
    setDateFrom(""); setDateTo(""); setLogsPage(0)
    setChTable(""); setChField(""); setChRecordId(""); setChangesPage(0)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield size={22} className="text-primary" />
            Auditoria & Histórico
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Rastreamento completo de eventos e alterações no sistema
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadStats(); tab === "logs" ? loadLogs() : loadChanges() }}>
          <RefreshCw size={13} /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <StatsRow stats={stats} />

      {/* Top user activity */}
      {stats?.by_user?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-semibold mb-3">Usuários mais ativos</p>
              <div className="space-y-2">
                {stats.by_user.slice(0,5).map((u, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{i+1}</div>
                      <div>
                        <p className="text-xs font-medium">{u.user_name || u.user_email}</p>
                        <p className="text-[10px] text-muted-foreground">{u.user_email}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{u.cnt} eventos</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-semibold mb-3">Distribuição por ação</p>
              <div className="space-y-1.5">
                {stats.by_action?.slice(0,8).map((a, i) => {
                  const meta = ACTION_META[a.action] || {}
                  const Icon = meta.icon || Activity
                  const pct = stats.total_logs > 0 ? Math.round(a.cnt / stats.total_logs * 100) : 0
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <Icon size={11} className={meta.color || "text-muted-foreground"} />
                      <span className="text-xs text-muted-foreground w-28 truncate">{meta.label || a.action}</span>
                      <div className="flex-1 bg-accent/40 rounded-full h-1.5">
                        <div className="bg-primary/60 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{a.cnt}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: "logs",    label: `Eventos (${logsTotal.toLocaleString("pt-BR")})`,    icon: Activity },
          { id: "changes", label: `Alterações (${changesTotal.toLocaleString("pt-BR")})`, icon: Pencil },
        ].map(({ id, label, icon: TabIcon }) => ( // eslint-disable-line no-unused-vars
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <TabIcon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Shared filters */}
      <Card>
        <CardContent className="pt-3 pb-3">
          <div className="flex flex-wrap gap-2 items-center">
            {tab === "logs" && (
              <>
                <div className="relative flex-1 min-w-44">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-7 h-8 text-sm" placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setLogsPage(0) }} />
                </div>
                <Select className="h-8 text-sm w-36" value={filterAction} onChange={e => { setFilterAction(e.target.value); setLogsPage(0) }}>
                  <option value="">Todas ações</option>
                  {allActions.map(a => <option key={a} value={a}>{ACTION_META[a]?.label || a}</option>)}
                </Select>
                <Select className="h-8 text-sm w-36" value={filterTable} onChange={e => { setFilterTable(e.target.value); setLogsPage(0) }}>
                  <option value="">Todas tabelas</option>
                  {allTables.map(t => <option key={t} value={t}>{TABLE_LABELS[t]}</option>)}
                </Select>
              </>
            )}
            {tab === "changes" && (
              <>
                <Select className="h-8 text-sm w-36" value={chTable} onChange={e => { setChTable(e.target.value); setChangesPage(0) }}>
                  <option value="">Todas tabelas</option>
                  {allTables.map(t => <option key={t} value={t}>{TABLE_LABELS[t]}</option>)}
                </Select>
                <Input className="h-8 text-sm w-36" placeholder="Campo..." value={chField} onChange={e => { setChField(e.target.value); setChangesPage(0) }} />
                <Input className="h-8 text-sm w-24" placeholder="ID registro" value={chRecordId} onChange={e => { setChRecordId(e.target.value); setChangesPage(0) }} />
              </>
            )}
            <Input type="date" className="h-8 text-sm w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <Input type="date" className="h-8 text-sm w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            {(search || filterAction || filterTable || dateFrom || dateTo || chTable || chField || chRecordId) && (
              <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Limpar</button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      {tab === "logs" && (
        <Card>
          <CardContent className="pt-5 overflow-x-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Log de Auditoria</p>
              <span className="text-xs text-muted-foreground">{logsTotal.toLocaleString("pt-BR")} eventos · clique para expandir</span>
            </div>
            {loading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-9 bg-accent/20 rounded animate-pulse" />)}</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Data/Hora", "Evento", "Tabela / Registro", "Descrição", "Usuário", "IP", ""].map(h => (
                      <th key={h} className="pb-2 pr-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(row => <LogRowDetail key={row.id} row={row} />)}
                  {logs.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Shield size={28} className="mx-auto mb-2 opacity-20" />
                      Nenhum evento registrado ainda.
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
            {logsTotal > PAGE && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">Pág. {logsPage+1} de {Math.ceil(logsTotal/PAGE)}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={logsPage===0} onClick={() => setLogsPage(p=>p-1)}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={(logsPage+1)*PAGE>=logsTotal} onClick={() => setLogsPage(p=>p+1)}>Próxima</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Changes Table */}
      {tab === "changes" && (
        <Card>
          <CardContent className="pt-5 overflow-x-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Histórico de Alterações de Campo</p>
              <span className="text-xs text-muted-foreground">{changesTotal.toLocaleString("pt-BR")} registros</span>
            </div>
            {loading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-7 bg-accent/20 rounded animate-pulse" />)}</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Data/Hora", "Tabela / ID", "Campo", "Valor Anterior", "", "Valor Novo", "Usuário"].map(h => (
                      <th key={h} className="pb-2 pr-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {changes.map(row => <ChangeRow key={row.id} row={row} />)}
                  {changes.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Database size={28} className="mx-auto mb-2 opacity-20" />
                      Nenhuma alteração registrada ainda. Edite algum registro para começar.
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
            {changesTotal > PAGE && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">Pág. {changesPage+1} de {Math.ceil(changesTotal/PAGE)}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={changesPage===0} onClick={() => setChangesPage(p=>p-1)}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={(changesPage+1)*PAGE>=changesTotal} onClick={() => setChangesPage(p=>p+1)}>Próxima</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
