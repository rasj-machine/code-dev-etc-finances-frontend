import { useEffect, useState } from "react"
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Select } from "@/components/ui"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { TrendingUp, TrendingDown, Wallet, CreditCard, Bitcoin, AlertCircle, Building2, Landmark } from "lucide-react"

const COLORS = ["#38bdf8", "#818cf8", "#fb7185", "#34d399", "#fbbf24", "#a78bfa"]

function KpiCard({ title, value, change, icon: IconComponent }) {
  const isPositive = change >= 0
  return (
    <Card className="animate-fade-in hover:-translate-y-1 transition-transform duration-300">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1 text-foreground amount-value">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
                {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(change).toFixed(1)}% vs mês anterior
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            {IconComponent && <IconComponent size={18} className="text-primary" />}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 text-sm shadow-xl">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }} className="font-medium">
            {p.name}: <span className="amount-value">{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [investments, setInvestments] = useState([])
  const [realNetWorth, setRealNetWorth] = useState(0)

  // New date filters
  const [mode, setMode] = useState("month") // "month" or "day"
  const [refDate, setRefDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    fetch("/api/accounts").then(r => r.ok ? r.json() : []).then(d => setAccounts(Array.isArray(d) ? d : []))
    fetch("/api/transactions").then(r => r.ok ? r.json() : []).then(d => setTransactions(Array.isArray(d) ? d : []))
    fetch("/api/investments").then(r => r.ok ? r.json() : []).then(d => setInvestments(Array.isArray(d) ? d : []))
    fetch("/api/patrimony").then(r => r.ok ? r.json() : []).then(items => {
      const assets = items.filter(i => i.type === "asset")
      const liabilities = items.filter(i => i.type === "liability")
      const totalRealValue = assets.reduce((s, i) => s + (i.real_value || 0), 0)
      const totalDebt = liabilities.reduce((s, i) => s + (i.value || 0), 0)
      setRealNetWorth(totalRealValue - totalDebt)
    })
  }, [])

  const currentTotalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  // Calculate reference date boundaries
  const selectedDate = new Date(refDate + "T12:00:00") // avoid timezone issues
  const selectedYear = selectedDate.getFullYear()
  const selectedMonth = selectedDate.getMonth()
  const yyyyMm = refDate.slice(0, 7)

  // End of reference period (day or month)
  let endOfPeriod;
  if (mode === "month") {
    // Last day of chosen month
    endOfPeriod = new Date(selectedYear, selectedMonth + 1, 0).toISOString().slice(0, 10)
  } else {
    endOfPeriod = refDate
  }

  // Calculate balance AT the end of chosen period
  // We take current balance and subtract everything after the period
  const afterPeriodNet = transactions
    .filter(t => t.date > endOfPeriod)
    .reduce((s, t) => (t.type === "income" ? s + t.amount : s - t.amount), 0)
  const balanceAtPeriod = currentTotalBalance - afterPeriodNet

  // Target transactions for KPIs (the chosen day OR the chosen month)
  const targetTrans = transactions.filter(t =>
    mode === "month" ? t.date?.startsWith(yyyyMm) : t.date === refDate
  )

  const periodExp = targetTrans.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)

  // Comparison period (previous month or previous day)
  let prevPeriodEnd, prevYyyyMm
  if (mode === "month") {
    const d = new Date(selectedYear, selectedMonth - 1, 1)
    prevYyyyMm = d.toISOString().slice(0, 7)
    prevPeriodEnd = new Date(selectedYear, selectedMonth, 0).toISOString().slice(0, 10)
  } else {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    prevPeriodEnd = d.toISOString().slice(0, 10)
  }

  const prevTrans = transactions.filter(t =>
    mode === "month" ? t.date?.startsWith(prevYyyyMm) : t.date === prevPeriodEnd
  )
  const prevExp = prevTrans.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)

  // Trends
  const calcChange = (cur, prev) => {
    if (!prev || prev === 0) return undefined
    return ((cur - prev) / prev) * 100
  }

  const balanceChange = undefined // Harder to get historic balance trend without more math
  const expenseChange = calcChange(periodExp, prevExp)

  // Cashflow and other data (scoped to the period for chart but let's keep all history for chart context?)
  // Actually the chart usually shows the last 6 months leading TO the refDate
  const cashflowMap = {}
  transactions.filter(t => t.date <= endOfPeriod).forEach(t => {
    const m = t.date?.slice(0, 7)
    if (!m) return
    if (!cashflowMap[m]) cashflowMap[m] = { month: m, entradas: 0, saidas: 0 }
    if (t.type === "income") cashflowMap[m].entradas += t.amount
    else cashflowMap[m].saidas += t.amount
  })
  const cashflow = Object.values(cashflowMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-6)

  const catMap = {}
  targetTrans.filter(t => t.type === "expense").forEach(t => {
    const cat = t.category || "Outros"
    catMap[cat] = (catMap[cat] || 0) + t.amount
  })
  const categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value }))
  const months = []
  for (let i = 0; i < 12; i++) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    months.push(date.toISOString().slice(0, 7))
  }

  const totalCrypto = accounts.filter(a => a.type === "crypto").reduce((s, a) => s + a.balance, 0)
  const totalCurrentValue = investments.reduce((s, i) => s + i.amount * (i.current_price || i.purchase_price), 0)

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral das suas finanças</p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 bg-accent/20 p-1.5 rounded-xl border border-border/50">
          <div className="flex bg-background rounded-lg border border-border p-1">
            <button
              onClick={() => setMode("month")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === "month" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Mês
            </button>
            <button
              onClick={() => setMode("day")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === "day" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Dia
            </button>
          </div>
          <input
            type={mode === "month" ? "month" : "date"}
            value={mode === "month" ? yyyyMm : refDate}
            onChange={(e) => {
              const val = e.target.value
              setRefDate(mode === "month" ? val + "-01" : val)
            }}
            className={`bg-background border border-border rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none ${mode === "month" ? "hidden" : ""}`}
          />
          <Select
            className={`w-40 ${mode === "day" ? "hidden" : ""}`}
            value={refDate}
            onChange={(e) => {
              const val = e.target.value
              if (val) {
                setRefDate(val)
              } else {
                setRefDate(new Date().toISOString().slice(0, 10))
              }
            }}
          >
            {
              months.map(month => (
                <option key={month} value={month + "-01"}>
                  {new Date(month + "-01" + " 12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </option>
              ))
            }
          </Select>
        </div>
      </div>

      {/* Alerts */}
      {(accounts.some(a => {
        if (!a.last_recon_date) return true
        const diff = (new Date() - new Date(a.last_recon_date)) / (1000 * 60 * 60 * 24)
        return diff > 7
      }) || accounts.some(a => {
        if (a.type !== "bank") return false
        if (!a.last_import_date) return true
        const diff = (new Date() - new Date(a.last_import_date)) / (1000 * 60 * 60 * 24)
        return diff > 1
      })) && (
          <div className="space-y-3">
            {accounts.filter(a => {
              if (!a.last_recon_date) return true
              const diff = (new Date() - new Date(a.last_recon_date)) / (1000 * 60 * 60 * 24)
              return diff > 7
            }).map(a => (
              <div key={`recon-${a.id}`} className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 animate-in zoom-in-95 duration-300">
                <AlertCircle size={18} />
                <div className="flex-1">
                  <p className="text-sm font-bold">Conciliação Pendente: {a.name}</p>
                  <p className="text-[10px] opacity-80">Esta conta não recebe uma conferência manual há mais de 7 dias ({a.last_recon_date ? formatDate(a.last_recon_date) : "Nunca"}).</p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-amber-600 hover:bg-amber-500/10 text-[10px]" onClick={() => window.location.href = '/conciliacao'}>Conciliar Agora</Button>
              </div>
            ))}

            {accounts.filter(a => {
              if (a.type !== "bank") return false
              if (!a.last_import_date) return true
              const diff = (new Date() - new Date(a.last_import_date)) / (1000 * 60 * 60 * 24)
              return diff > 1
            }).map(a => (
              <div key={`sync-${a.id}`} className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive animate-in zoom-in-95 duration-300">
                <AlertCircle size={18} />
                <div className="flex-1">
                  <p className="text-sm font-bold">Sincronização Atrasada: {a.name}</p>
                  <p className="text-[10px] opacity-80">Nenhum extrato bancário foi importado para esta conta nas últimas 24 horas.</p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-destructive hover:bg-destructive/10 text-[10px]" onClick={() => window.location.href = '/transacoes'}>Importar Extrato</Button>
              </div>
            ))}
          </div>
        )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <KpiCard title={`Saldo Bancário (${mode === 'month' ? 'fim do mês' : 'o dia'})`} value={formatCurrency(balanceAtPeriod)} change={balanceChange} icon={Wallet} />
        </div>
        <div className="lg:col-span-1">
          <KpiCard title="Patrimônio Real" value={formatCurrency(realNetWorth)} change={undefined} icon={Building2} />
        </div>
        <div className="lg:col-span-1 border border-primary/40 bg-primary/5 rounded-xl scale-[1.02]">
          <KpiCard title="Total BRUTO (Saldos + Patrimônio)" value={formatCurrency(balanceAtPeriod + realNetWorth)} change={undefined} icon={Landmark} />
        </div>
        <div className="lg:col-span-1">
          <KpiCard title={`Gastos (${mode === 'month' ? 'no mês' : 'no dia'})`} value={formatCurrency(periodExp)} change={expenseChange} icon={CreditCard} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2">
          <KpiCard title="Investimentos (atual)" value={formatCurrency(totalCurrentValue)} change={undefined} icon={TrendingUp} />
        </div>
        <div className="lg:col-span-2">
          <KpiCard title="Crypto (atual)" value={formatCurrency(totalCrypto)} change={undefined} icon={Bitcoin} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Fluxo de Caixa (6 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={cashflow}>
                <defs>
                  <linearGradient id="entradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="saidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217.2 32.6% 17.5%)" />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="entradas" stroke="#34d399" fill="url(#entradas)" strokeWidth={2} />
                <Area type="monotone" dataKey="saidas" stroke="#fb7185" fill="url(#saidas)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Gastos por Categoria</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={90} innerRadius={50}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-60 text-muted-foreground text-sm gap-2">
                <AlertCircle size={32} />
                Sem dados de gastos
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{mode === "month" ? "Lançamentos do Mês" : "Lançamentos do Dia"}</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Data", "Descrição", "Categoria", "Conta", "Valor"].map(h => (
                  <th key={h} className="text-left pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {targetTrans.slice(0, 50).map(t => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                  <td className="py-3 text-muted-foreground">{formatDate(t.date)}</td>
                  <td className="py-3 font-medium max-w-[350px]">{t.description}</td>
                  <td className="py-3">
                    <Badge variant="secondary">{t.category || "—"}</Badge>
                  </td>
                  <td className="py-3 text-muted-foreground">{t.account_name}</td>
                  <td className={`py-3 font-semibold ${t.type === "expense" ? "text-destructive" : "text-success"}`}>
                    {t.type === "expense" ? "-" : "+"}{formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
              {targetTrans.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Nenhuma transação encontrada para este período</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
