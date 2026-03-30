import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, Button, Input, Select } from "@/components/ui"
import {
  RefreshCw, TrendingUp, Search,
  ChevronUp, Database, Clock, Activity,
} from "lucide-react"

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const fmtDate = (s) => {
  if (!s) return "—"
  const d = new Date(s)
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

const INDICATOR_LABELS = {
  cdi: "CDI",
  selic: "SELIC",
  ipca: "IPCA",
  usd_brl: "Dólar (USD/BRL)",
  eur_brl: "Euro (EUR/BRL)",
}
const getLabel = (ind) => {
  if (INDICATOR_LABELS[ind]) return INDICATOR_LABELS[ind]
  if (ind.startsWith("stock_")) return `Ação: ${ind.replace("stock_", "")}`
  if (ind.startsWith("crypto_") && ind.endsWith("_brl")) return `Crypto: ${ind.replace("crypto_", "").replace("_brl", "")} (BRL)`
  if (ind.startsWith("crypto_") && ind.endsWith("_usd")) return `Crypto: ${ind.replace("crypto_", "").replace("_usd", "")} (USD)`
  return ind
}

const SOURCE_COLORS = {
  bcb: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  awesomeapi: "bg-green-500/10 text-green-500 border-green-500/20",
  brapi: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  coingecko: "bg-amber-500/10 text-amber-600 border-amber-500/20",
}

function SourceBadge({ source }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SOURCE_COLORS[source] || "bg-muted/50 text-muted-foreground border-border"}`}>
      {source}
    </span>
  )
}

// ── Simple sparkline SVG ──────────────────────────────────────────────────────
function Sparkline({ data, width = 120, height = 32 }) {
  if (!data || data.length < 2) return <span className="text-xs text-muted-foreground">—</span>
  const vals = data.map(d => d.value).filter(v => v != null)
  if (vals.length < 2) return null
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  const last = vals[vals.length - 1]
  const first = vals[0]
  const color = last >= first ? "#10b981" : "#ef4444"
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={(vals.length - 1) / (vals.length - 1) * width} cy={height - ((last - min) / range) * height} r="2.5" fill={color} />
    </svg>
  )
}

// ── Indicator Summary Cards ───────────────────────────────────────────────────
function IndicatorCard({ item, timeseries, onClick, active }) {
  const label = getLabel(item.indicator)
  const lastVal = item.value
  const totalChanges = item.total_changes ?? 0
  const totalRecords = item.total_records ?? 0

  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 w-full ${
        active
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{item.source}</p>
          <p className="text-sm font-semibold truncate">{label}</p>
        </div>
        <SourceBadge source={item.source} />
      </div>
      <p className="text-xl font-bold tabular-nums mb-1">
        {lastVal != null ? lastVal.toFixed(4) : "—"}
      </p>
      <div className="flex items-center gap-3 mt-2">
        <Sparkline data={timeseries || []} width={80} height={22} />
        <div className="text-right ml-auto">
          <p className="text-[10px] text-muted-foreground">{totalRecords} consultas</p>
          <p className="text-[10px] text-emerald-500">{totalChanges} alterações</p>
        </div>
      </div>
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RelatoriosMercado() {
  const [indicators, setIndicators] = useState([])
  const [timeseries, setTimeseries] = useState({}) // indicator -> []
  const [history, setHistory] = useState([])
  const [histTotal, setHistTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [histLoading, setHistLoading] = useState(false)
  const [activeIndicator, setActiveIndicator] = useState(null)

  // Filters
  const [search, setSearch] = useState("")
  const [filterSource, setFilterSource] = useState("")
  const [filterChanged, setFilterChanged] = useState(false)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 100

  const loadIndicators = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/market-data/indicators").then(r => r.ok ? r.json() : [])
      setIndicators(Array.isArray(r) ? r : [])
      // Load timeseries for each
      const ts = {}
      await Promise.all((Array.isArray(r) ? r : []).map(async (item) => {
        const data = await fetch(`/api/market-data/timeseries/${encodeURIComponent(item.indicator)}?limit=60`).then(r => r.ok ? r.json() : [])
        ts[item.indicator] = data
      }))
      setTimeseries(ts)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const loadHistory = useCallback(async () => {
    setHistLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("indicator", search)
    if (filterSource) params.set("source", filterSource)
    if (filterChanged) params.set("changed", "1")
    if (dateFrom) params.set("date_from", dateFrom)
    if (dateTo) params.set("date_to", dateTo)
    if (activeIndicator) params.set("indicator", activeIndicator)
    params.set("limit", PAGE_SIZE)
    params.set("offset", page * PAGE_SIZE)
    try {
      const r = await fetch(`/api/market-data/history?${params}`).then(r => r.ok ? r.json() : { total: 0, items: [] })
      setHistory(r.items || [])
      setHistTotal(r.total || 0)
    } catch { /* ignore */ }
    setHistLoading(false)
  }, [search, filterSource, filterChanged, dateFrom, dateTo, activeIndicator, page])

  useEffect(() => { loadIndicators() }, [loadIndicators]) // eslint-disable-line
  useEffect(() => { loadHistory() }, [loadHistory]) // eslint-disable-line

  const filteredIndicators = useMemo(() =>
    indicators.filter(i => !search || getLabel(i.indicator).toLowerCase().includes(search.toLowerCase())),
    [indicators, search]
  )

  const sources = useMemo(() => [...new Set(indicators.map(i => i.source))], [indicators])

  const refreshAll = async () => {
    // Trigger a market-data fetch to log new data
    await fetch("/api/investments/market-data").catch(() => {})
    loadIndicators()
    loadHistory()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity size={22} className="text-primary" />
            Relatórios de Mercado
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Histórico de consultas às APIs externas · {indicators.length} indicadores monitorados
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw size={14} /> Consultar APIs agora
          </Button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Indicadores Monitorados</p>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="rounded-xl border border-border p-4 h-28 bg-accent/20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredIndicators.map(item => (
              <IndicatorCard
                key={item.indicator}
                item={item}
                timeseries={timeseries[item.indicator]}
                active={activeIndicator === item.indicator}
                onClick={() => {
                  setActiveIndicator(activeIndicator === item.indicator ? null : item.indicator)
                  setPage(0)
                }}
              />
            ))}
            {filteredIndicators.length === 0 && !loading && (
              <div className="col-span-4 text-center py-12 text-muted-foreground">
                <Database size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum dado encontrado. Clique em "Consultar APIs agora" para iniciar o histórico.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Indicator Detail */}
      {activeIndicator && timeseries[activeIndicator] && (
        <Card className="border-primary/20">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">{getLabel(activeIndicator)} — Série histórica</p>
              <button onClick={() => setActiveIndicator(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronUp size={16} />
              </button>
            </div>
            <TimeseriesChart data={timeseries[activeIndicator]} label={getLabel(activeIndicator)} />
          </CardContent>
        </Card>
      )}

      {/* Filters for history table */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-44">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-7 h-8 text-sm" placeholder="Buscar indicador..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} />
            </div>
            <Select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(0) }} className="h-8 text-sm w-36">
              <option value="">Todas fontes</option>
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input type="date" className="h-8 text-sm w-36" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }} placeholder="De" />
            <Input type="date" className="h-8 text-sm w-36" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }} placeholder="Até" />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={filterChanged}
                onChange={e => { setFilterChanged(e.target.checked); setPage(0) }}
                className="accent-primary"
              />
              Só alterados
            </label>
            {(search || filterSource || filterChanged || dateFrom || dateTo || activeIndicator) && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { setSearch(""); setFilterSource(""); setFilterChanged(false); setDateFrom(""); setDateTo(""); setActiveIndicator(null); setPage(0) }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Log de Consultas</p>
            <span className="text-xs text-muted-foreground">{histTotal.toLocaleString("pt-BR")} registros</span>
          </div>

          {histLoading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-9 bg-accent/20 rounded animate-pulse" />)}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Data / Hora", "Fonte", "Indicador", "Valor", "Anterior", "Status"].map(h => (
                    <th key={h} className="pb-2 pr-4 font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(row => {
                  const changed = row.changed === 1
                  return (
                    <tr key={row.id} className={`border-b border-border/40 hover:bg-accent/20 transition-colors ${changed ? "bg-emerald-500/3" : ""}`}>
                      <td className="py-2 pr-4 tabular-nums text-muted-foreground whitespace-nowrap">{fmtDate(row.queried_at)}</td>
                      <td className="py-2 pr-4"><SourceBadge source={row.source} /></td>
                      <td className="py-2 pr-4 font-medium">{getLabel(row.indicator)}</td>
                      <td className="py-2 pr-4 tabular-nums font-mono font-semibold">
                        {row.value != null ? row.value.toFixed(6) : "—"}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-muted-foreground font-mono">
                        {row.prev_value != null ? row.prev_value.toFixed(6) : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {changed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold border border-emerald-500/20">
                            <TrendingUp size={9} /> Alterado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground text-[10px] border border-border">
                            Igual
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <Clock size={24} className="mx-auto mb-2 opacity-30" />
                      Nenhum registro encontrado. Faça uma consulta de mercado primeiro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {histTotal > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Pág. {page + 1} de {Math.ceil(histTotal / PAGE_SIZE)}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= histTotal} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Simple line chart (SVG) ───────────────────────────────────────────────────
function TimeseriesChart({ data }) {
  if (!data || data.length < 2) return (
    <p className="text-sm text-muted-foreground text-center py-8">Dados insuficientes para o gráfico</p>
  )
  const W = 800, H = 180, PAD = { t: 16, r: 16, b: 32, l: 60 }
  const vals = data.map(d => d.value).filter(v => v != null)
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const rangeV = maxV - minV || 1

  const pts = data.map((d, i) => {
    const x = PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r)
    const y = PAD.t + (1 - (d.value - minV) / rangeV) * (H - PAD.t - PAD.b)
    return { x, y, ...d }
  })

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
  const areaD = `${pathD} L ${pts[pts.length-1].x.toFixed(1)} ${H - PAD.b} L ${pts[0].x.toFixed(1)} ${H - PAD.b} Z`

  // Y axis labels (4 steps)
  const ySteps = 4
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = minV + (i / ySteps) * rangeV
    const y = H - PAD.b - (i / ySteps) * (H - PAD.t - PAD.b)
    return { val, y }
  })

  // X axis labels (max 8)
  const xStep = Math.max(1, Math.floor(data.length / 8))
  const xLabels = pts.filter((_, i) => i % xStep === 0 || i === pts.length - 1)

  const last = vals[vals.length - 1]
  const first = vals[0]
  const lineColor = last >= first ? "#10b981" : "#ef4444"

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
        <defs>
          <linearGradient id="tsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid */}
        {yLabels.map(({ y }, i) => (
          <line key={i} x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="var(--border)" strokeWidth="0.5" />
        ))}
        {/* Area */}
        <path d={areaD} fill="url(#tsGrad)" />
        {/* Line */}
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" />
        {/* Changed markers */}
        {pts.filter(p => p.changed).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={lineColor} opacity="0.8" />
        ))}
        {/* Y labels */}
        {yLabels.map(({ val, y }, i) => (
          <text key={i} x={PAD.l - 6} y={y + 4} fontSize="9" fill="var(--muted-foreground)" textAnchor="end">
            {val.toFixed(4)}
          </text>
        ))}
        {/* X labels */}
        {xLabels.map((p, i) => (
          <text key={i} x={p.x} y={H - 6} fontSize="8" fill="var(--muted-foreground)" textAnchor="middle">
            {new Date(p.queried_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </text>
        ))}
      </svg>
    </div>
  )
}
