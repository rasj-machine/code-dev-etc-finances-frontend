import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from "recharts"

// ── Colour palette per category ───────────────────────────────────────────
const CAT_COLORS = {
  "Alimentação":   "#f59e0b",
  "Transporte":    "#06b6d4",
  "Moradia":       "#8b5cf6",
  "Saúde":         "#22c55e",
  "Educação":      "#3b82f6",
  "Lazer":         "#ec4899",
  "Assinaturas":   "#6366f1",
  "Salário":       "#10b981",
  "Investimento":  "#0ea5e9",
  "Consórcios":    "#f97316",
  "Boleto":        "#ef4444",
  "Outros":        "#a1a1aa",
}
const DEFAULT_COLOR = "#6366f1"
const catColor = (c) => CAT_COLORS[c] || DEFAULT_COLOR

const TABS = ["Gráficos", "Últimas", "Maiores"]

function lastNMonths(n = 12) {
  const result = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return result
}

const fmtK = (v) => `R$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + "k" : Number(v).toFixed(0)}`

const MiniTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
      ))}
    </div>
  )
}

// ── Single category card ──────────────────────────────────────────────────
function CategoryCard({ cat, txns, type }) {
  const [tab, setTab] = useState("Gráficos")
  const color = catColor(cat)

  // Last transaction
  const sorted = [...txns].sort((a, b) => b.date.localeCompare(a.date))
  const last = sorted[0]

  // Top 5 biggest
  const biggest = [...txns].sort((a, b) => b.amount - a.amount).slice(0, 5)

  // Monthly chart data
  const months = lastNMonths(12)
  const monthlyData = useMemo(() => {
    const map = {}
    for (const m of months) map[m] = { month: m, total: 0, count: 0 }
    for (const t of txns) {
      const m = t.date?.slice(0, 7)
      if (map[m]) { map[m].total += t.amount; map[m].count++ }
    }
    return months.map(m => map[m])
  }, [txns]) // eslint-disable-line

  const total = txns.reduce((s, t) => s + t.amount, 0)
  const isIncome = type === "income"

  return (
    <Card className="flex flex-col overflow-hidden border-t-2 transition-shadow hover:shadow-lg hover:shadow-black/20"
      style={{ borderTopColor: color }}>
      <CardContent className="pt-4 pb-3 flex-1 flex flex-col gap-3">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }}/>
              <p className="font-bold text-base">{cat}</p>
            </div>
            {/* Last transaction */}
            {last && (
              <div className="mt-1 text-xs text-muted-foreground leading-tight">
                <span className="font-medium">{formatDate(last.date)}</span>
                {" · "}
                <span className="truncate">{last.description}</span>
                {" · "}
                <span className={`font-bold ${isIncome ? "text-success" : "text-destructive"}`}>
                  {isIncome ? "+" : "-"}{formatCurrency(last.amount)}
                </span>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={`text-lg font-bold amount-value ${isIncome ? "text-success" : "text-destructive"}`}>
              {isIncome ? "+" : "-"}{formatCurrency(total)}
            </p>
            <p className="text-xs text-muted-foreground">{txns.length} lançamentos</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 text-xs font-medium py-1 rounded-md transition-all ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "Gráficos" && (
          <div>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id={`g-${cat}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.35}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}/>
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={42}/>
                <Tooltip content={<MiniTooltip/>}/>
                <Area type="monotone" dataKey="total" stroke={color} strokeWidth={2}
                  fill={`url(#g-${cat})`} name="Total" dot={{ r: 2, fill: color }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === "Últimas" && (
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {sorted.slice(0, 10).map((t, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{t.description}</p>
                  <p className="text-muted-foreground">{formatDate(t.date)}</p>
                </div>
                <p className={`font-bold tabular-nums ml-3 shrink-0 amount-value ${isIncome ? "text-success" : "text-destructive"}`}>
                  {isIncome ? "+" : "-"}{formatCurrency(t.amount)}
                </p>
              </div>
            ))}
            {sorted.length === 0 && <p className="text-muted-foreground text-xs py-2">Sem transações</p>}
          </div>
        )}

        {tab === "Maiores" && (
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {biggest.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/40 last:border-0">
                <span className="font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{t.description}</p>
                  <p className="text-muted-foreground">{formatDate(t.date)}</p>
                </div>
                <p className={`font-bold tabular-nums shrink-0 amount-value ${isIncome ? "text-success" : "text-destructive"}`}>
                  {isIncome ? "+" : "-"}{formatCurrency(t.amount)}
                </p>
              </div>
            ))}
            {biggest.length === 0 && <p className="text-muted-foreground text-xs py-2">Sem transações</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function GastosReceitas() {
  const [transactions, setTransactions] = useState([])
  const [view, setView] = useState("expense") // expense | income | all
  const [period, setPeriod] = useState("all")  // all | 30 | 90 | 365

  useEffect(() => { fetch("/api/transactions").then(r => r.ok ? r.json() : []).then(d => setTransactions(Array.isArray(d) ? d : [])) }, [])

  // Filter by period
  const filtered = useMemo(() => {
    let txns = transactions
    if (period !== "all") {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - parseInt(period))
      const since = cutoff.toISOString().slice(0, 10)
      txns = txns.filter(t => t.date >= since)
    }
    return txns
  }, [transactions, period])

  // Group by category
  const byCat = useMemo(() => {
    const map = {}
    for (const t of filtered) {
      const cat = t.category || "Outros"
      if (!map[cat]) map[cat] = { expense: [], income: [] }
      if (t.type === "expense") map[cat].expense.push(t)
      else map[cat].income.push(t)
    }
    return map
  }, [filtered])

  // Global totals
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
  const totalIncome  = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
  const netResult    = totalIncome - totalExpense

  // Sorted categories
  const cats = Object.keys(byCat).sort((a, b) => {
    const sumA = [...(byCat[a].expense || []), ...(byCat[a].income || [])].reduce((s, t) => s + t.amount, 0)
    const sumB = [...(byCat[b].expense || []), ...(byCat[b].income || [])].reduce((s, t) => s + t.amount, 0)
    return sumB - sumA
  })

  // Top categories bar chart
  const barData = cats.slice(0, 8).map(c => ({
    cat: c,
    despesa:  (byCat[c]?.expense || []).reduce((s, t) => s + t.amount, 0),
    receita:  (byCat[c]?.income  || []).reduce((s, t) => s + t.amount, 0),
  })).filter(d => (view === "expense" ? d.despesa : view === "income" ? d.receita : d.despesa + d.receita) > 0)

  const PERIOD_OPTS = [["all","Todo período"],["30","30 dias"],["90","90 dias"],["365","1 ano"]]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gastos &amp; Receitas</h1>
          <p className="text-muted-foreground text-sm mt-1">{cats.length} categorias · {filtered.length} transações</p>
        </div>
        {/* Period picker */}
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
          {PERIOD_OPTS.map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${period === v ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Receitas</p>
          <p className="text-2xl font-bold text-success amount-value">+{formatCurrency(totalIncome)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Despesas</p>
          <p className="text-2xl font-bold text-destructive amount-value">-{formatCurrency(totalExpense)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Resultado Líquido</p>
          <p className={`text-2xl font-bold amount-value ${netResult >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(netResult)}</p>
        </CardContent></Card>
      </div>

      {/* Overview bar chart */}
      {barData.length > 0 && (
        <Card><CardContent className="pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Top categorias</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
              <XAxis dataKey="cat" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}/>
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}/>
              <Tooltip content={<MiniTooltip/>}/>
              {(view === "expense" || view === "all") && <Bar dataKey="despesa" fill="#ef4444" name="Despesa" radius={[3, 3, 0, 0]}/>}
              {(view === "income"  || view === "all") && <Bar dataKey="receita" fill="#22c55e" name="Receita" radius={[3, 3, 0, 0]}/>}
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      )}

      {/* Type filter */}
      <div className="flex items-center gap-2">
        {[["expense","🔴 Despesas"],["income","🟢 Receitas"],["all","Todos"]].map(([v,l]) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-all ${view===v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
            {l}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{cats.length} categorias</span>
      </div>

      {/* Category cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cats.map(cat => {
          const expTxns = byCat[cat]?.expense || []
          const incTxns = byCat[cat]?.income  || []

          const cards = []
          if ((view === "expense" || view === "all") && expTxns.length > 0) {
            cards.push(
              <CategoryCard key={`${cat}-exp`} cat={cat} txns={expTxns} type="expense"/>
            )
          }
          if ((view === "income" || view === "all") && incTxns.length > 0) {
            cards.push(
              <CategoryCard key={`${cat}-inc`} cat={cat} txns={incTxns} type="income"/>
            )
          }
          return cards
        })}
      </div>

      {cats.length === 0 && (
        <div className="py-20 text-center text-muted-foreground">
          <p className="text-4xl mb-3">📊</p>
          <p>Nenhuma transação encontrada para o período selecionado.</p>
        </div>
      )}
    </div>
  )
}
