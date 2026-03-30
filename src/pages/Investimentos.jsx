import { useState, useEffect, useMemo, useCallback } from "react"
import { Button, Card, CardContent, Input, Select, Badge, MoneyInput } from "@/components/ui"
import { Dialog, FormField } from "@/components/Dialog"
import { NumericFormat } from "react-number-format"
import { formatCurrency } from "@/lib/utils"
import {
  Plus, Pencil, Trash2, TrendingUp, TrendingDown, Search,
  RefreshCw, BarChart2, Briefcase, AlertTriangle, X,
  Minus, Calendar, Clock, ChevronDown, ChevronUp, Info, Zap,
  DollarSign, LineChart, PieChart, ArrowRight, Landmark, Coins,
  Building2, Shield, Rocket, ExternalLink, Activity, Globe
} from "lucide-react"

// ── Constants ────────────────────────────────────────────────────────────────

const TYPES = [
  { key: "fixed",   label: "Renda Fixa",           icon: Shield,    color: "#3b82f6" },
  { key: "fund",    label: "Fundo de Inv.",         icon: Briefcase, color: "#8b5cf6" },
  { key: "cri_cra", label: "CRI / CRA",             icon: Landmark,  color: "#f59e0b" },
  { key: "stock",   label: "Ações",                 icon: LineChart, color: "#10b981" },
  { key: "reit",    label: "FII",                   icon: Building2, color: "#06b6d4" },
  { key: "tesouro", label: "Tesouro Direto",        icon: Coins,     color: "#f97316" },
  { key: "crypto",  label: "Crypto",                icon: Rocket,    color: "#a855f7" },
]

const INDEXERS = ["CDI", "IPCA", "SELIC", "Prefixado", "IGP-M", "IPCA+"]
const REDEMPTIONS = ["D+0", "D+1", "D+2", "D+30", "D+60", "D+90", "D+180", "No vencimento"]

// CoinGecko ID map (module-level constant)
const CG_MAP = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  ADA: 'cardano', DOT: 'polkadot', MATIC: 'matic-network', LINK: 'chainlink',
  AVAX: 'avalanche-2', XRP: 'ripple', DOGE: 'dogecoin', LTC: 'litecoin',
  USDT: 'tether', USDC: 'usd-coin', NEAR: 'near', FTM: 'fantom',
}

const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.key, t]))

const emptyForm = {
  name: "", type: "fixed", account_id: "",
  // price fields (stored as centavos in state, converted to reais for API)
  applied: 0,          // valor aplicado / principal (centavos)
  purchase_price: 0,   // preço de compra por unidade (centavos)
  current_price: 0,    // preço atual por unidade (centavos)
  quantity: "",
  gross_value: 0,      // valor bruto atual (centavos)
  net_value: 0,        // valor líquido atual (centavos)
  tax: 0,              // IR / IOF (centavos)
  quota_value: 0,      // valor da cota (centavos)
  quota_date: "",
  // metadata
  ticker: "", indexer: "CDI", rate: "",
  date: new Date().toISOString().slice(0, 10),
  application_date: "", maturity_date: "",
  redemption_term: "D+0", institution: "", notes: "",
}

// ── Tiny helpers ─────────────────────────────────────────────────────────────

const fmtPct = (v, decimals = 2) => {
  if (v == null || isNaN(v)) return "—"
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`
}

const daysLeft = (dateStr) => {
  if (!dateStr) return null
  const d = new Date(dateStr + "T00:00:00")
  return Math.round((d - new Date()) / 86400000)
}

const formatDateShort = (s) => {
  if (!s) return "—"
  const [y, m, d] = s.split("-")
  return `${d}/${m}/${y}`
}

// Fields shown per type
const TYPE_FIELDS = {
  fixed:   ["indexer", "rate", "application_date", "maturity_date", "redemption_term", "applied", "gross_value", "net_value", "tax"],
  cri_cra: ["indexer", "rate", "application_date", "maturity_date", "applied", "gross_value", "net_value", "tax"],
  tesouro: ["indexer", "rate", "application_date", "maturity_date", "applied", "gross_value", "net_value", "tax"],
  fund:    ["quantity", "quota_value", "quota_date", "redemption_term", "applied", "gross_value", "net_value", "tax"],
  stock:   ["ticker", "quantity"],
  reit:    ["ticker", "quantity"],
  crypto:  ["ticker", "quantity"],
}

const hasField = (type, field) => (TYPE_FIELDS[type] || []).includes(field)

// ── TabButton ────────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
        ${active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/60"}`}
    >
      {children}
    </button>
  )
}

// ── Indicator card ───────────────────────────────────────────────────────────
function IndicatorCard({ label, value, sub, color = "text-foreground", loading }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        {loading
          ? <div className="h-7 w-24 bg-accent/40 rounded animate-pulse" />
          : <p className={`text-2xl font-bold tabular-nums ${color}`}>{value ?? "—"}</p>}
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ── Insight badge ────────────────────────────────────────────────────────────
function InsightBadge({ rec }) {
  if (!rec) return null
  const colors = {
    success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    destructive: "bg-red-500/10 text-red-500 border-red-500/20",
    muted: "bg-muted/50 text-muted-foreground border-border",
  }
  const icons = {
    "trending-up": TrendingUp,
    "trending-down": TrendingDown,
    "minus": Minus,
  }
  const Icon = icons[rec.icon] || Minus
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[rec.color] || colors.muted}`}>
      <Icon size={10} />
      {rec.label}
    </span>
  )
}

// ── Type Icon ─────────────────────────────────────────────────────────────────
function TypeIcon({ type, size = 16 }) {
  const t = TYPE_MAP[type]
  if (!t) return null
  const Icon = t.icon
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: t.color + "22" }}>
      <Icon size={size} style={{ color: t.color }} />
    </span>
  )
}

// ── Donut mini chart (SVG) ────────────────────────────────────────────────────
function DonutChart({ data, size = 140 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return null
  const r = size / 2 - 10
  const cx = size / 2, cy = size / 2
  // Build slices without mutating a `let` across map iterations
  const slices = data.reduce((acc, d) => {
    const startAngle = acc.length > 0 ? acc[acc.length - 1]._endAngle : -Math.PI / 2
    const sweep = (d.value / total) * 2 * Math.PI
    const endAngle = startAngle + sweep
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const large = sweep > Math.PI ? 1 : 0
    return [...acc, { ...d, sweep, x1, y1, x2, y2, large, _endAngle: endAngle }]
  }, [])

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => (
        <path key={i}
          d={`M ${cx} ${cy} L ${s.x1} ${s.y1} A ${r} ${r} 0 ${s.large} 1 ${s.x2} ${s.y2} Z`}
          fill={s.color}
          opacity={0.85}
          className="transition-opacity hover:opacity-100"
        />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.6} fill="var(--card)" />
    </svg>
  )
}

// ── Forecast Bar ──────────────────────────────────────────────────────────────
function ForecastBar({ gain, maxGain, period }) {
  const pct = maxGain > 0 ? (gain / maxGain) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-10 shrink-0">{period}m</span>
      <div className="flex-1 h-2 rounded-full bg-accent/40 overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums amount-value w-24 text-right">{formatCurrency(gain)}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Investimentos() {
  const [tab, setTab] = useState("overview")
  const [investments, setInvestments] = useState([])
  const [accounts, setAccounts] = useState([])
  const [insights, setInsights] = useState([])
  const [forecast, setForecast] = useState([])
  const [marketData, setMarketData] = useState(null)
  const [marketLoading, setMarketLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)

  // Filter state
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [sortKey, setSortKey] = useState("net_desc")
  const [expandedInsight, setExpandedInsight] = useState(null)

  // Detail modal state
  const [detailInv, setDetailInv] = useState(null)
  const [detailTimeseries, setDetailTimeseries] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  const openDetail = useCallback(async (inv) => {
    setDetailInv(inv)
    setDetailTimeseries([])
    const sym = (inv.ticker || inv.name || '').toUpperCase()
    if (inv.type === 'crypto' && sym) {
      setDetailLoading(true)
      const brl = await fetch(`/api/market-data/timeseries/crypto_${sym}_brl?limit=120`).then(r => r.ok ? r.json() : [])
      const usd = await fetch(`/api/market-data/timeseries/crypto_${sym}_usd?limit=120`).then(r => r.ok ? r.json() : [])
      setDetailTimeseries({ brl, usd })
      setDetailLoading(false)
    } else if ((inv.type === 'stock' || inv.type === 'reit') && sym) {
      setDetailLoading(true)
      const ts = await fetch(`/api/market-data/timeseries/stock_${sym}?limit=120`).then(r => r.ok ? r.json() : [])
      setDetailTimeseries({ brl: ts })
      setDetailLoading(false)
    }
  }, [])

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadInvestments = useCallback(async () => {
    setLoading(true)
    const [invRes, accRes] = await Promise.all([
      fetch("/api/investments").then(r => r.ok ? r.json() : []),
      fetch("/api/accounts").then(r => r.ok ? r.json() : []),
    ])
    setInvestments(Array.isArray(invRes) ? invRes : [])
    setAccounts(Array.isArray(accRes) ? accRes : [])
    setLoading(false)
  }, [])

  const loadInsights = useCallback(async () => {
    const res = await fetch("/api/investments/insights").then(r => r.ok ? r.json() : [])
    setInsights(Array.isArray(res) ? res : [])
  }, [])

  const loadForecast = useCallback(async () => {
    const res = await fetch("/api/investments/income-forecast").then(r => r.ok ? r.json() : [])
    setForecast(Array.isArray(res) ? res : [])
  }, [])

  const loadMarket = useCallback(async () => {
    setMarketLoading(true)
    const res = await fetch("/api/investments/market-data").then(r => r.ok ? r.json() : null)
    setMarketData(res)
    setMarketLoading(false)
  }, [])

  useEffect(() => {
    const load = async () => {
      await loadInvestments()
      loadInsights()
      loadForecast()
      loadMarket()
    }
    load()
  }, [loadInvestments, loadInsights, loadForecast, loadMarket])

  // ── Enriched investments ───────────────────────────────────────────────────
  const enriched = useMemo(() => investments.map(inv => {
    // principal = original investment (valor aplicado)
    const principal = inv.applied || (inv.purchase_price * (inv.quantity || 1))

    // For crypto: calculate USD value × quantity, convert to BRL via usd_brl rate
    let currentNet = inv.net_value || inv.current_price * (inv.quantity || 1) || principal
    let cryptoUsdValue = null
    let cryptoUsdPrice = null
    if (inv.type === 'crypto') {
      const sym = (inv.ticker || inv.name || '').toUpperCase()
      const cryptoInfo = marketData?.crypto?.[sym]
      if (cryptoInfo?.price_usd != null && inv.quantity) {
        cryptoUsdPrice = cryptoInfo.price_usd
        cryptoUsdValue = cryptoInfo.price_usd * inv.quantity
        const usdBrl = marketData?.usd || 5.0
        currentNet = Math.round(cryptoUsdValue * usdBrl * 100) // centavos
      } else if (cryptoInfo?.price_brl != null && inv.quantity) {
        currentNet = Math.round(cryptoInfo.price_brl * inv.quantity * 100)
      }
    }

    const gain    = currentNet - principal
    const gainPct = principal > 0 ? (gain / principal) * 100 : 0
    const days = daysLeft(inv.maturity_date)
    const insight = insights.find(i => i.id === inv.id)
    return {
      ...inv, principal, currentVal: currentNet, investedVal: principal,
      gain, gainPct, daysLeft: days, insight,
      cryptoUsdValue, cryptoUsdPrice,
    }
  }), [investments, insights, marketData])

  // ── Filtered list ──────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    let list = enriched.filter(inv => {
      if (filterType !== "all" && inv.type !== filterType) return false
      if (search && !inv.name.toLowerCase().includes(search.toLowerCase()) &&
          !(inv.ticker || "").toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    switch (sortKey) {
      case "name":     list.sort((a, b) => a.name.localeCompare(b.name)); break
      case "gain_d":   list.sort((a, b) => b.gainPct - a.gainPct); break
      case "gain_a":   list.sort((a, b) => a.gainPct - b.gainPct); break
      case "net_desc": list.sort((a, b) => b.currentVal - a.currentVal); break
      case "mat":      list.sort((a, b) => (a.maturity_date || "z").localeCompare(b.maturity_date || "z")); break
    }
    return list
  }, [enriched, filterType, search, sortKey])

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalInvested  = enriched.reduce((s, i) => s + i.investedVal, 0)
  const totalCurrent   = enriched.reduce((s, i) => s + i.currentVal, 0)
  const totalGain      = totalCurrent - totalInvested
  const totalGainPct   = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0

  // ── Allocation by type ─────────────────────────────────────────────────────
  const byType = useMemo(() => {
    const map = {}
    for (const inv of enriched) {
      if (!map[inv.type]) map[inv.type] = 0
      map[inv.type] += inv.currentVal
    }
    return TYPES.filter(t => map[t.key] > 0).map(t => ({
      label: t.label, value: map[t.key], color: t.color,
      pct: totalCurrent > 0 ? (map[t.key] / totalCurrent) * 100 : 0,
    }))
  }, [enriched, totalCurrent])

  const forecastTotals = useMemo(() => {
    const periods = ["1", "3", "6", "12", "24"]
    const totals = {}
    for (const p of periods) {
      totals[p] = forecast.reduce((s, f) => s + (f.projections?.[p]?.gain || 0), 0)
    }
    return totals
  }, [forecast])

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const openCreate = () => {
    setForm({ ...emptyForm, account_id: accounts[0]?.id || "" })
    setEditing(null); setOpen(true)
  }
  const openEdit = (inv) => {
    // All monetary fields are in centavos in the DB — pass directly to MoneyInput
    setForm({
      ...emptyForm, ...inv,
      applied:        inv.applied        || 0,
      purchase_price: inv.purchase_price || 0,
      current_price:  inv.current_price  || 0,
      gross_value:    inv.gross_value    || 0,
      net_value:      inv.net_value      || 0,
      tax:            inv.tax            || 0,
      quota_value:    inv.quota_value    || 0,
      quantity:       String(inv.quantity || ""),
      rate:           String(inv.rate || ""),
    })
    setEditing(inv.id); setOpen(true)
  }

  // ── Auto-fetch crypto price from CoinGecko ──────────────────────────────
  const fetchCryptoPrice = useCallback(async (ticker) => {
    const id = CG_MAP[ticker?.toUpperCase()] || ticker?.toLowerCase()
    if (!id) return 0
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=brl`)
      const data = await r.json()
      return Math.round((data[id]?.brl || 0) * 100) // centavos
    } catch { return 0 }
  }, [])

  const save = async (e) => {
    e.preventDefault()
    // form monetary fields are already in centavos (MoneyInput handles this)
    // quantity and rate are plain floats
    let current_price_cents = form.current_price || 0

    // Auto-fetch current price for crypto
    if (form.type === 'crypto' && form.ticker) {
      const fetched = await fetchCryptoPrice(form.ticker)
      if (fetched > 0) current_price_cents = fetched
    }

    const body = {
      ...form,
      // MoneyInput stores centavos; convert to reais for the API (backend multiplies * 100)
      applied:        (form.applied        || 0) / 100,
      purchase_price: (form.purchase_price || 0) / 100,
      current_price:  current_price_cents        / 100,
      gross_value:    (form.gross_value    || 0) / 100,
      net_value:      (form.net_value      || 0) / 100,
      tax:            (form.tax            || 0) / 100,
      quota_value:    (form.quota_value    || 0) / 100,
      quantity:       parseFloat(form.quantity)  || 0,
      rate:           parseFloat(form.rate)      || 0,
      account_id:     form.account_id ? parseInt(form.account_id) : null,
    }
    const url = editing ? `/api/investments/${editing}` : "/api/investments"
    const method = editing ? "PUT" : "POST"
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    setOpen(false)
    await loadInvestments(); await loadInsights(); await loadForecast()
  }

  const remove = async (id) => {
    await fetch(`/api/investments/${id}`, { method: "DELETE" })
    setDeleting(null)
    await loadInvestments(); await loadInsights(); await loadForecast()
  }

  // ── Render tabs ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Investimentos</h1>
          <p className="text-muted-foreground text-sm mt-1">{enriched.length} ativos · {TYPES.filter(t => byType.find(b => b.label === t.label)).length} categorias</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadMarket(); loadInsights(); loadForecast() }} disabled={marketLoading}>
            <RefreshCw size={14} className={marketLoading ? "animate-spin" : ""} /> Atualizar
          </Button>
          <Button onClick={openCreate}><Plus size={16} /> Novo Ativo</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap bg-accent/20 p-1 rounded-xl w-fit">
        {[
          { key: "overview",  label: "Visão Geral",       icon: PieChart },
          { key: "portfolio", label: "Carteira",          icon: Briefcase },
          { key: "forecast",  label: "Previsão de Renda", icon: BarChart2 },
          { key: "market",    label: "Mercado",           icon: LineChart },
        ].map(({ key, label, icon }) => {
          const TabIcon = icon
          return (
            <TabBtn key={key} active={tab === key} onClick={() => setTab(key)}>
              <span className="flex items-center gap-1.5"><TabIcon size={13} />{label}</span>
            </TabBtn>
          )
        })}
      </div>

      {/* ── TAB: Overview ───────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IndicatorCard label="Total Investido" value={formatCurrency(totalInvested)} sub="valor aplicado" />
            <IndicatorCard label="Valor Atual" value={formatCurrency(totalCurrent)} sub="líquido" />
            <IndicatorCard
              label="Ganho / Perda"
              value={`${totalGain >= 0 ? "+" : ""}${formatCurrency(totalGain)}`}
              color={totalGain >= 0 ? "text-emerald-500" : "text-red-500"}
            />
            <IndicatorCard
              label="Rentabilidade"
              value={fmtPct(totalGainPct)}
              color={totalGainPct >= 0 ? "text-emerald-500" : "text-red-500"}
              sub="total acumulado"
            />
          </div>

          {/* Allocation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-semibold mb-4">Alocação por Tipo</p>
                <div className="flex items-center gap-6">
                  <DonutChart data={byType} size={130} />
                  <div className="space-y-2 flex-1">
                    {byType.map(t => (
                      <div key={t.label} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                          <span className="text-xs text-muted-foreground">{t.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold amount-value">{formatCurrency(t.value)}</span>
                          <span className="text-xs text-muted-foreground ml-1">({t.pct.toFixed(1)}%)</span>
                        </div>
                      </div>
                    ))}
                    {byType.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* By type cards */}
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-semibold mb-4">Resumo por Categoria</p>
                <div className="space-y-2">
                  {TYPES.map(t => {
                    const items = enriched.filter(i => i.type === t.key)
                    if (!items.length) return null
                    const total = items.reduce((s, i) => s + i.currentVal, 0)
                    const gain  = items.reduce((s,i) => s + i.gain, 0)
                    const Icon = t.icon
                    return (
                      <div key={t.key} className="flex items-center gap-3 rounded-lg hover:bg-accent/30 transition-colors p-2">
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.color + "22" }}>
                          <Icon size={15} style={{ color: t.color }} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{t.label}</p>
                          <p className="text-[10px] text-muted-foreground">{items.length} ativo{items.length !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold tabular-nums amount-value">{formatCurrency(total)}</p>
                          <p className={`text-[10px] tabular-nums ${gain >= 0 ? "text-emerald-500" : "text-red-500"}`}>{gain >= 0 ? "+" : ""}{formatCurrency(gain)}</p>
                        </div>
                      </div>
                    )
                  })}
                  {enriched.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum investimento cadastrado</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerts: vencendo em breve */}
          {enriched.filter(i => i.daysLeft !== null && i.daysLeft <= 90 && i.daysLeft >= 0).length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm font-semibold text-amber-600 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} /> Vencimentos próximos
                </p>
                <div className="space-y-2">
                  {enriched.filter(i => i.daysLeft !== null && i.daysLeft <= 90 && i.daysLeft >= 0).map(inv => (
                    <div key={inv.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{inv.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${inv.daysLeft <= 30 ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-600"}`}>
                        {inv.daysLeft === 0 ? "Vence hoje" : `${inv.daysLeft} dias`}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: Portfolio ──────────────────────────────────────────────────── */}
      {tab === "portfolio" && (
        <div className="space-y-4">
          {/* Filters */}
          <Card><CardContent className="pt-3 pb-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-44">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-7 h-8 text-sm" placeholder="Buscar ativo ou ticker..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-8 text-sm w-44">
                <option value="all">Todos os tipos</option>
                {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </Select>
              <Select value={sortKey} onChange={e => setSortKey(e.target.value)} className="h-8 text-sm w-44">
                <option value="net_desc">Maior valor</option>
                <option value="gain_d">Maior ganho %</option>
                <option value="gain_a">Menor ganho %</option>
                <option value="name">Nome A→Z</option>
                <option value="mat">Vencimento</option>
              </Select>
            </div>
          </CardContent></Card>

          {/* Investment cards */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3].map(i => <Card key={i}><CardContent className="pt-6"><div className="h-32 bg-accent/30 rounded animate-pulse" /></CardContent></Card>)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visible.map(inv => {
                const typeInfo = TYPE_MAP[inv.type] || TYPE_MAP.fixed
                const CardIcon = typeInfo.icon
                const isGain = inv.gain >= 0
                const days = inv.daysLeft
                return (
                  <Card
                    key={inv.id}
                    className="hover:-translate-y-0.5 transition-transform duration-200 group cursor-pointer"
                    onClick={() => openDetail(inv)}
                  >
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <TypeIcon type={inv.type} />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm leading-tight truncate">{inv.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{typeInfo.label}</Badge>
                              {inv.ticker && <span className="text-[10px] font-mono text-muted-foreground">{inv.ticker}</span>}
                              {inv.indexer && <span className="text-[10px] text-muted-foreground">{inv.indexer}{inv.rate ? ` ${inv.rate}%` : ""}</span>}
                            </div>
                          </div>
                        </div>
                        <div className={`flex items-center gap-0.5 text-xs font-bold shrink-0 ${isGain ? "text-emerald-500" : "text-red-500"}`}>
                          {isGain ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                          {fmtPct(inv.gainPct)}
                        </div>
                      </div>

                      <div className="space-y-1.5 mb-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Aplicado</span>
                          <span className="tabular-nums amount-value">{formatCurrency(inv.investedVal)}</span>
                        </div>
                        {inv.type === 'crypto' && inv.cryptoUsdValue != null && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1"><Globe size={9} /> Valor USD</span>
                            <span className="tabular-nums font-mono text-blue-400">${inv.cryptoUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {inv.gross_value > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Bruto atual</span>
                            <span className="tabular-nums amount-value">{formatCurrency(inv.gross_value)}</span>
                          </div>
                        )}
                        {inv.tax > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">IR/IOF</span>
                            <span className="tabular-nums amount-value text-red-500">-{formatCurrency(inv.tax)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-semibold border-t border-border/40 pt-1.5 mt-1">
                          <span className="text-muted-foreground">Líquido atual</span>
                          <span className="tabular-nums amount-value">{formatCurrency(inv.currentVal)}</span>
                        </div>
                        <div className={`flex justify-between text-xs font-medium ${isGain ? "text-emerald-500" : "text-red-500"}`}>
                          <span>Ganho/Perda</span>
                          <span className="tabular-nums amount-value">{isGain ? "+" : ""}{formatCurrency(inv.gain)}</span>
                        </div>
                      </div>


                      {inv.maturity_date && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
                          <Calendar size={10} />
                          Venc. {formatDateShort(inv.maturity_date)}
                          {days !== null && days <= 90 && days >= 0 && (
                            <span className={`ml-1 px-1.5 py-0.5 rounded ${days <= 30 ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-600"}`}>
                              {days === 0 ? "Hoje" : `${days}d`}
                            </span>
                          )}
                        </div>
                      )}

                      {(inv.redemption_term || inv.quota_date) && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
                          <Clock size={10} />
                          {inv.redemption_term && <>Liquidez: {inv.redemption_term}</>}
                          {inv.quota_date && <> · Cota: {formatDateShort(inv.quota_date)}</>}
                        </div>
                      )}

                      {/* Insight */}
                      {inv.insight && (
                        <div className="mt-2">
                          <button
                            className="flex items-center gap-1.5 w-full text-left"
                            onClick={() => setExpandedInsight(expandedInsight === inv.id ? null : inv.id)}
                          >
                            <InsightBadge rec={inv.insight.recommendation} />
                            <span className="ml-auto">
                              {expandedInsight === inv.id ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                            </span>
                          </button>
                          {expandedInsight === inv.id && inv.insight.tips.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {inv.insight.tips.map((tip, i) => {
                                const tipColors = {
                                  success: "text-emerald-500", warning: "text-amber-500",
                                  danger: "text-red-500", info: "text-blue-500"
                                }
                                return (
                                  <p key={i} className={`text-[10px] flex gap-1 ${tipColors[tip.type] || "text-muted-foreground"}`}>
                                    <Info size={9} className="mt-0.5 shrink-0" /> {tip.msg}
                                  </p>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => openEdit(inv)}>
                          <Pencil size={11} /> Editar
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleting(inv)}>
                          <Trash2 size={11} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {visible.length === 0 && (
                <div className="col-span-3 text-center py-16 text-muted-foreground">
                  <Briefcase size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum ativo cadastrado </p>
                  <Button className="mt-4" onClick={openCreate}><Plus size={14} /> Adicionar primeiro ativo</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Forecast ───────────────────────────────────────────────────── */}
      {tab === "forecast" && (
        <div className="space-y-4">
          {/* Total projected */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {[["1", "1 mês"], ["3", "3 meses"], ["6", "6 meses"], ["12", "12 meses"], ["24", "24 meses"]].map(([p, label]) => (
              <Card key={p}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-base font-bold text-emerald-500 tabular-nums amount-value">+{formatCurrency(forecastTotals[p] || 0)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Forecast bars per investment */}
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm font-semibold mb-4">Rendimento Projetado por Ativo</p>
              <div className="space-y-6">
                {forecast.filter(f => f.annual_rate > 0).map(f => {
                  const maxGain = Math.max(...Object.values(f.projections).map(p => p.gain))
                  return (
                    <div key={f.id} className="space-y-1.5">
                      <div className="flex items-center gap-2 mb-2">
                        <TypeIcon type={f.type} size={13} />
                        <div>
                          <span className="text-sm font-medium">{f.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {f.indexer ? `${f.indexer} ` : ""}{f.annual_rate.toFixed(2)}% a.a.
                          </span>
                        </div>
                      </div>
                      {[["1", "1m"], ["3", "3m"], ["6", "6m"], ["12", "12m"], ["24", "24m"]].map(([p, label]) => (
                        <ForecastBar key={p} gain={f.projections[p]?.gain || 0} maxGain={maxGain} period={label.replace("m", "")} />
                      ))}
                    </div>
                  )
                })}
                {forecast.filter(f => f.annual_rate > 0).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Cadastre investimentos com indexador e taxa para ver previsões
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Table of projections */}
          {forecast.length > 0 && (
            <Card>
              <CardContent className="pt-5 overflow-x-auto">
                <p className="text-sm font-semibold mb-4">Tabela Detalhada</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {["Ativo", "Taxa a.a.", "Principal", "1 mês", "3 meses", "6 meses", "12 meses", "24 meses"].map(h => (
                        <th key={h} className="text-left pb-2 text-muted-foreground font-medium pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.map(f => (
                      <tr key={f.id} className="border-b border-border/40 hover:bg-accent/20">
                        <td className="py-2 font-medium pr-4">{f.name}</td>
                        <td className="py-2 tabular-nums pr-4">{f.annual_rate.toFixed(2)}%</td>
                        <td className="py-2 tabular-nums amount-value pr-4">{formatCurrency(f.applied)}</td>
                        {["1", "3", "6", "12", "24"].map(p => (
                          <td key={p} className="py-2 tabular-nums text-emerald-500 amount-value pr-4">
                            +{formatCurrency(f.projections[p]?.gain || 0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: Market ─────────────────────────────────────────────────────── */}
      {tab === "market" && (
        <div className="space-y-4">
          {/* Indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IndicatorCard label="CDI (a.m.)" value={marketData?.cdi != null ? `${marketData.cdi.toFixed(4)}%` : "—"} sub="Banco Central" loading={marketLoading} />
            <IndicatorCard label="SELIC (a.a.)" value={marketData?.selic != null ? `${marketData.selic.toFixed(2)}%` : "—"} sub="Taxa básica" loading={marketLoading} />
            <IndicatorCard label="IPCA (a.m.)" value={marketData?.ipca != null ? `${marketData.ipca.toFixed(4)}%` : "—"} sub="Inflação oficial" loading={marketLoading} />
            <IndicatorCard label="Dólar (BRL)" value={marketData?.usd != null ? `R$ ${marketData.usd.toFixed(2)}` : "—"} sub="Último bid" loading={marketLoading} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stocks from portfolio */}
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <LineChart size={14} /> Ações / FIIs na Carteira
                </p>
                {marketLoading ? (
                  <div className="space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-8 bg-accent/30 rounded animate-pulse" />)}
                  </div>
                ) : Object.keys(marketData?.stocks || {}).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(marketData.stocks).map(([ticker, info]) => (
                      <div key={ticker} className="flex items-center justify-between rounded-lg hover:bg-accent/30 p-2 transition-colors">
                        <div>
                          <span className="font-mono font-bold text-sm">{ticker}</span>
                          {info.name && <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{info.name}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">R$ {(info.price || 0).toFixed(2)}</p>
                          <p className={`text-[10px] ${(info.change_pct || 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {(info.change_pct || 0) >= 0 ? "+" : ""}{(info.change_pct || 0).toFixed(2)}% hoje
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Cadastre ações ou FIIs com ticker para ver cotações ao vivo
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Crypto from portfolio */}
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Rocket size={14} /> Crypto na Carteira
                </p>
                {marketLoading ? (
                  <div className="space-y-2">
                    {[1,2].map(i => <div key={i} className="h-8 bg-accent/30 rounded animate-pulse" />)}
                  </div>
                ) : Object.keys(marketData?.crypto || {}).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(marketData.crypto).map(([sym, info]) => (
                      <div key={sym} className="flex items-center justify-between rounded-lg hover:bg-accent/30 p-2 transition-colors">
                        <span className="font-mono font-bold text-sm">{sym}</span>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">R$ {(info.price_brl || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className={`text-[10px] ${(info.change_24h || 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {(info.change_24h || 0) >= 0 ? "+" : ""}{(info.change_24h || 0).toFixed(2)}% 24h
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Cadastre ativos crypto com o ticker (BTC, ETH...) para ver cotações
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Benchmark comparison */}
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm font-semibold mb-4 flex items-center gap-2">
                <BarChart2 size={14} /> Carteira vs CDI 100%
              </p>
              <div className="space-y-3">
                {enriched.filter(i => i.investedVal > 0).map(inv => {
                  const CDI_ANNUAL = marketData?.cdi ? marketData.cdi * 12 : 10.65
                  const myReturn = inv.gainPct
                  const diff = myReturn - CDI_ANNUAL
                  return (
                    <div key={inv.id} className="flex items-center gap-3 text-xs">
                      <TypeIcon type={inv.type} size={12} />
                      <span className="flex-1 truncate font-medium">{inv.name}</span>
                      <span className={`tabular-nums ${myReturn >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmtPct(myReturn)}</span>
                      <span className="text-muted-foreground">vs</span>
                      <span className="text-muted-foreground">{fmtPct(CDI_ANNUAL)} CDI</span>
                      <span className={`min-w-[60px] text-right tabular-nums font-semibold ${diff >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {diff >= 0 ? "+" : ""}{diff.toFixed(2)}pp
                      </span>
                    </div>
                  )
                })}
                {enriched.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum ativo para comparar</p>}
              </div>
            </CardContent>
          </Card>

          {/* Opportunities */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-5">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
                <Zap size={14} /> Referências do Mercado
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: "CDB 100% CDI", desc: "Liquidez diária, baixo risco", badge: "Conservador" },
                  { label: "Tesouro IPCA+", desc: "Proteção inflação longo prazo", badge: "Moderado" },
                  { label: "FII diversificado", desc: "Renda passiva mensal ~8-10%", badge: "Moderado" },
                ].map(opp => (
                  <div key={opp.label} className="rounded-xl border border-border bg-background p-3">
                    <p className="text-sm font-semibold">{opp.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{opp.desc}</p>
                    <span className="mt-2 inline-block text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{opp.badge}</span>
                  </div>
                ))}
              </div>
              {marketData?.errors?.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-3">
                  ⚠ Alguns dados de mercado indisponíveis: {marketData.errors.slice(0, 3).join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══ Dialog: Create / Edit ══════════════════════════════════════════════ */}
      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Editar Investimento" : "Novo Investimento"}>
        <form onSubmit={save} className="space-y-4">
          {/* Row 1: Name + Type */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nome do Ativo">
              <Input required value={form.name} onChange={e => f("name", e.target.value)} placeholder="CDB Inter, PETR4, BTC..." />
            </FormField>
            <FormField label="Tipo">
              <Select value={form.type} onChange={e => f("type", e.target.value)}>
                {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </Select>
            </FormField>
          </div>

          {/* Row 2: Conta + Instituição */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Conta / Corretora">
              <Select value={form.account_id} onChange={e => f("account_id", e.target.value)}>
                <option value="">Selecione</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Instituição">
              <Input value={form.institution} onChange={e => f("institution", e.target.value)} placeholder="Banco Inter, XP..." />
            </FormField>
          </div>

          {/* Ticker (stock / reit / crypto) */}
          {hasField(form.type, "ticker") && (
            <FormField label={form.type === "crypto" ? "Símbolo da moeda (ex: BTC, ETH, SOL)" : "Ticker (ex: PETR4, KNRI11)"}>
              <Input
                value={form.ticker}
                onChange={e => f("ticker", e.target.value.toUpperCase())}
                placeholder={form.type === "crypto" ? "BTC" : "PETR4"}
                aria-label="Código do ativo"
              />
            </FormField>
          )}

          {/* Indexer + Rate (fixed income types) */}
          {hasField(form.type, "indexer") && (
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Indexador">
                <Select value={form.indexer} onChange={e => f("indexer", e.target.value)}>
                  {INDEXERS.map(idx => <option key={idx} value={idx}>{idx}</option>)}
                </Select>
              </FormField>
              <FormField label={form.indexer?.includes("CDI") || form.indexer?.includes("SELIC") ? "% do indexador" : "Taxa % a.a."}>
                <NumericFormat
                  className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-all"
                  decimalSeparator=","
                  decimalScale={2}
                  allowNegative={false}
                  suffix="%"
                  value={form.rate}
                  onValueChange={vals => f("rate", vals.value)}
                  placeholder={form.indexer?.includes("CDI") ? "100%" : "8,00%"}
                  aria-label="Taxa"
                />
              </FormField>
            </div>
          )}

          {/* Quantity (funds, stocks, crypto) */}
          {hasField(form.type, "quantity") && (
            <div className="grid grid-cols-2 gap-4">
              <FormField label={form.type === "crypto" ? "Quantidade" : "Quantidade / Cotas"}>
                <NumericFormat
                  className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-all"
                  thousandSeparator="."
                  decimalSeparator=","
                  decimalScale={form.type === "crypto" ? 8 : 4}
                  allowNegative={false}
                  value={form.quantity}
                  onValueChange={vals => f("quantity", vals.value)}
                  placeholder={form.type === "crypto" ? "0,00000000" : "100"}
                  aria-label="Quantidade"
                />
              </FormField>
              {hasField(form.type, "quota_value") ? (
                <FormField label="Valor da Cota (R$)">
                  <MoneyInput
                    value={form.quota_value}
                    onValueChange={v => f("quota_value", v)}
                    placeholder="2,85"
                    aria-label="Valor da cota"
                  />
                </FormField>
              ) : form.type === "crypto" ? (
                <FormField label="Preço de Compra (R$)">
                  <MoneyInput
                    value={form.purchase_price}
                    onValueChange={v => f("purchase_price", v)}
                    placeholder="0,00"
                    aria-label="Preço de compra"
                  />
                </FormField>
              ) : (
                <FormField label="Preço de Compra (R$)">
                  <MoneyInput
                    value={form.purchase_price}
                    onValueChange={v => f("purchase_price", v)}
                    placeholder="0,00"
                    aria-label="Preço de compra"
                  />
                </FormField>
              )}
            </div>
          )}

          {/* Info banner for crypto: current price fetched automatically */}
          {form.type === "crypto" && form.ticker && (
            <div className="flex items-center gap-2 text-xs text-blue-500 bg-blue-500/8 border border-blue-500/20 rounded-lg px-3 py-2">
              <RefreshCw size={11} />
              <span>O preço atual de <strong>{form.ticker}</strong> será buscado automaticamente via CoinGecko ao salvar.</span>
            </div>
          )}

          {/* Applied (principal invested) */}
          {hasField(form.type, "applied") && (
            <FormField label="Valor Aplicado / Principal (R$)">
              <MoneyInput
                value={form.applied}
                onValueChange={v => f("applied", v)}
                placeholder="0,00"
                aria-label="Valor aplicado"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Valor que você investiu originalmente</p>
            </FormField>
          )}

          {/* Gross / Net / Tax — current values */}
          {hasField(form.type, "gross_value") && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valores Atuais</p>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Bruto (R$)">
                  <MoneyInput
                    value={form.gross_value}
                    onValueChange={v => f("gross_value", v)}
                    placeholder="0,00"
                    aria-label="Valor bruto atual"
                  />
                </FormField>
                <FormField label="IR / IOF (R$)">
                  <MoneyInput
                    value={form.tax}
                    onValueChange={v => f("tax", v)}
                    placeholder="0,00"
                    aria-label="IR e IOF"
                  />
                </FormField>
                <FormField label="Líquido (R$)">
                  <MoneyInput
                    value={form.net_value}
                    onValueChange={v => f("net_value", v)}
                    placeholder="0,00"
                    aria-label="Valor líquido atual"
                  />
                </FormField>
              </div>
            </div>
          )}


          {/* Stock / FII: purchase + current price */}
          {(form.type === "stock" || form.type === "reit") && (
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Preço de Compra (R$)">
                <MoneyInput
                  value={form.purchase_price}
                  onValueChange={v => f("purchase_price", v)}
                  placeholder="0,00"
                  aria-label="Preço de compra"
                />
              </FormField>
              <FormField label="Preço Atual (R$)">
                <MoneyInput
                  value={form.current_price}
                  onValueChange={v => f("current_price", v)}
                  placeholder="0,00"
                  aria-label="Preço atual"
                />
              </FormField>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            {hasField(form.type, "application_date") ? (
              <FormField label="Data de Aplicação">
                <Input type="date" value={form.application_date} onChange={e => f("application_date", e.target.value)} />
              </FormField>
            ) : (
              <FormField label="Data da Compra">
                <Input type="date" required value={form.date} onChange={e => f("date", e.target.value)} />
              </FormField>
            )}
            {hasField(form.type, "maturity_date") && (
              <FormField label="Data de Vencimento">
                <Input type="date" value={form.maturity_date} onChange={e => f("maturity_date", e.target.value)} />
              </FormField>
            )}
            {hasField(form.type, "quota_date") && (
              <FormField label="Data da Cota">
                <Input type="date" value={form.quota_date} onChange={e => f("quota_date", e.target.value)} />
              </FormField>
            )}
          </div>

          {/* Redemption term */}
          {hasField(form.type, "redemption_term") && (
            <FormField label="Prazo de Resgate">
              <Select value={form.redemption_term} onChange={e => f("redemption_term", e.target.value)}>
                {REDEMPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </FormField>
          )}

          {/* Notes */}
          <FormField label="Observações (opcional)">
            <Input value={form.notes} onChange={e => f("notes", e.target.value)} placeholder="Notas..." />
          </FormField>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editing ? "Salvar" : "Adicionar"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Dialog>

      {/* ══ Dialog: Delete ════════════════════════════════════════════════════ */}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Excluir Investimento">
        <p className="text-muted-foreground mb-4">Excluir <strong>{deleting?.name}</strong>? Esta ação não pode ser desfeita.</p>
        <div className="flex gap-3">
          <Button variant="destructive" className="flex-1" onClick={() => remove(deleting.id)}>Excluir</Button>
          <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
        </div>
      </Dialog>

      {/* ══ Detail Modal ══════════════════════════════════════════════════════ */}
      {detailInv && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setDetailInv(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <TypeIcon type={detailInv.type} size={20} />
                <div>
                  <h2 className="text-lg font-bold">{detailInv.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{TYPE_MAP[detailInv.type]?.label}</span>
                    {detailInv.ticker && <span className="text-xs font-mono text-muted-foreground">· {detailInv.ticker}</span>}
                    {detailInv.institution && <span className="text-xs text-muted-foreground">· {detailInv.institution}</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => setDetailInv(null)} className="p-1.5 hover:bg-accent rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Aplicado", value: formatCurrency(detailInv.investedVal), color: "" },
                  { label: "Valor Atual", value: formatCurrency(detailInv.currentVal), color: "" },
                  {
                    label: "Ganho/Perda",
                    value: `${detailInv.gain >= 0 ? "+" : ""}${formatCurrency(detailInv.gain)}`,
                    color: detailInv.gain >= 0 ? "text-emerald-500" : "text-red-500"
                  },
                  {
                    label: "Rentabilidade",
                    value: fmtPct(detailInv.gainPct),
                    color: detailInv.gainPct >= 0 ? "text-emerald-500" : "text-red-500"
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl bg-accent/30 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                    <p className={`text-base font-bold tabular-nums amount-value ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Crypto specific: USD breakdown */}
              {detailInv.type === 'crypto' && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
                  <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5 mb-3">
                    <Globe size={12} /> Exposição em Dólar
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Preço atual (USD)", value: detailInv.cryptoUsdPrice != null ? `$${detailInv.cryptoUsdPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : "—" },
                      { label: "Qtd × preço (USD)", value: detailInv.cryptoUsdValue != null ? `$${detailInv.cryptoUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—" },
                      { label: "USD/BRL (last bid)", value: marketData?.usd ? `R$ ${marketData.usd.toFixed(4)}` : "—" },
                      { label: "Saldo líquido (BRL)", value: formatCurrency(detailInv.currentVal), color: "text-emerald-500" },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className={`text-sm font-semibold tabular-nums ${color || ""}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {detailInv.quantity > 0 && <div><span className="text-muted-foreground">Quantidade: </span><span className="font-medium">{detailInv.quantity}</span></div>}
                {detailInv.indexer && <div><span className="text-muted-foreground">Indexador: </span><span className="font-medium">{detailInv.indexer}{detailInv.rate > 0 ? ` ${detailInv.rate}%` : ""}</span></div>}
                {detailInv.application_date && <div><span className="text-muted-foreground">Aplicado em: </span><span className="font-medium">{formatDateShort(detailInv.application_date)}</span></div>}
                {detailInv.maturity_date && <div><span className="text-muted-foreground">Vencimento: </span><span className="font-medium">{formatDateShort(detailInv.maturity_date)}{detailInv.daysLeft !== null ? ` (${detailInv.daysLeft}d)` : ""}</span></div>}
                {detailInv.redemption_term && <div><span className="text-muted-foreground">Liquidez: </span><span className="font-medium">{detailInv.redemption_term}</span></div>}
              </div>

              {/* Chart section */}
              {(detailInv.type === 'crypto' || detailInv.type === 'stock' || detailInv.type === 'reit') && (
                <div>
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Activity size={14} /> Histórico de Preço (consultas registradas)
                  </p>
                  {detailLoading ? (
                    <div className="h-32 bg-accent/30 rounded-xl animate-pulse" />
                  ) : detailTimeseries?.brl?.length >= 2 ? (
                    <InlineChart data={detailTimeseries.brl} label="BRL" color="#10b981" />
                  ) : (
                    <div className="rounded-xl border border-border p-6 text-center text-muted-foreground text-sm">
                      <Activity size={24} className="mx-auto mb-2 opacity-30" />
                      Sem histórico local. Clique em "Atualizar" na página de Investimentos para começar a registrar.
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {detailInv.notes && (
                <div className="rounded-lg bg-accent/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm">{detailInv.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={() => { setDetailInv(null); openEdit(detailInv) }}>
                  <Pencil size={14} /> Editar
                </Button>
                <Button variant="outline" onClick={() => setDetailInv(null)}>Fechar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inline mini chart for detail modal ───────────────────────────────────────
function InlineChart({ data, label, color = "#10b981" }) {
  if (!data || data.length < 2) return null
  const W = 600, H = 120, PAD = { t: 8, r: 8, b: 24, l: 52 }
  const vals = data.map(d => d.value).filter(v => v != null)
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const rangeV = maxV - minV || 1
  const pts = data.map((d, i) => ({
    x: PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r),
    y: PAD.t + (1 - (d.value - minV) / rangeV) * (H - PAD.t - PAD.b),
    ...d,
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
  const areaD = `${pathD} L ${pts[pts.length-1].x.toFixed(1)} ${H - PAD.b} L ${pts[0].x.toFixed(1)} ${H - PAD.b} Z`
  const ySteps = 3
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => ({
    val: minV + (i / ySteps) * rangeV,
    y: H - PAD.b - (i / ySteps) * (H - PAD.t - PAD.b)
  }))
  return (
    <div className="rounded-xl border border-border p-3 bg-background overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{data.length} pontos</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }}>
        <defs>
          <linearGradient id={`cg_${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yLabels.map(({ y }, i) => <line key={i} x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="var(--border)" strokeWidth="0.5" />)}
        <path d={areaD} fill={`url(#cg_${label})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        {pts.filter(p => p.changed).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} opacity="0.8" />)}
        {yLabels.map(({ val, y }, i) => (
          <text key={i} x={PAD.l - 4} y={y + 3} fontSize="8" fill="var(--muted-foreground)" textAnchor="end">{val.toFixed(2)}</text>
        ))}
      </svg>
    </div>
  )
}

