import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Legend, ReferenceLine,
} from "recharts"

const COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#14b8a6","#84cc16","#a3a3a3","#3b82f6"]
const fmtK = (v) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl shadow-xl p-3 text-sm min-w-32">
      {label && <p className="text-muted-foreground text-xs mb-2 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }}/>
            {p.name}
          </span>
          <span className="font-semibold tabular-nums amount-value" style={{ color: p.color }}>{typeof p.value === "number" ? fmtK(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function KPI({ label, value, sub, color }) {
  return (
    <Card><CardContent className="pt-5 pb-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums amount-value ${color || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 amount-value">{sub}</p>}
    </CardContent></Card>
  )
}

function Section({ title, children }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default function Relatorios() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/reports")
      .then(r => r.ok ? r.json() : Promise.reject("Unauthorized or error"))
      .then(d => { setData(d); setLoading(false) })
      .catch(err => {
        console.error("Erro ao carregar relatórios:", err)
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse">
      Carregando relatórios…
    </div>
  )

  if (!data || !data.kpis) return (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4">
      <p>Dados indisponíveis ou acesso restrito.</p>
    </div>
  )

  const { monthly_cashflow = [], categories = [], top_entities_spending = [], top_entities_receiving = [],
          biggest_transactions = [], investments = [], kpis = {}, accounts = [],
          weekday_spending = [], yearly_comparison = [], category_trend = [], category_trend_keys = [],
          savings_rate = [], net_worth = {} } = data

  const totalIncome  = kpis.total_income  || 0
  const totalExpense = kpis.total_expense || 0
  const avgMonthExp  = monthly_cashflow.length > 0 ? monthly_cashflow.reduce((s,m) => s + m.expense, 0) / monthly_cashflow.length : 0
  const savingsRate  = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100) : 0

  // Investment totals by type
  const invTotal = investments.reduce((s,i) => ({ invested: s.invested + (i.total_invested||0), current: s.current + (i.total_current||0) }), { invested:0, current:0 })
  const invProfit   = invTotal.current - invTotal.invested
  const invProfitPct = invTotal.invested > 0 ? (invProfit / invTotal.invested * 100) : 0

  // Category pie data
  const pieData = categories.slice(0, 8).map((c, i) => ({ name: c.category || "Outros", value: c.total, fill: COLORS[i] }))

  // Top entities bar
  const entBarData = top_entities_spending.map(e => ({ name: e.name.split(" ").slice(0,2).join(" "), total: e.total }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {kpis.first_date ? `${formatDate(kpis.first_date)} → ${formatDate(kpis.last_date)}` : "Sem dados ainda"}
          {kpis.total_transactions ? ` · ${kpis.total_transactions} transações` : ""}
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPI label="Total Receitas"    value={formatCurrency(totalIncome)}  color="text-success"/>
        <KPI label="Total Gastos"      value={formatCurrency(totalExpense)} color="text-destructive"/>
        <KPI label="Média Mensal Gasto" value={formatCurrency(avgMonthExp)} sub={`${monthly_cashflow.length} meses`}/>
        <KPI label="Taxa de Poupança"  value={`${savingsRate.toFixed(1)}%`} color={savingsRate >= 0 ? "text-success" : "text-destructive"} sub="(receita - gasto) / receita"/>
        <KPI label="Patrimônio Total"  value={formatCurrency((net_worth?.total)||0)} sub={`Contas: ${formatCurrency(net_worth?.accounts||0)} + Inv: ${formatCurrency(net_worth?.investments||0)}`} color="text-primary"/>
      </div>

      {/* Cashflow + Category side by side */}
      <div className="grid md:grid-cols-5 gap-6">
        <div className="md:col-span-3">
          <Section title="Fluxo de Caixa — últimos 12 meses">
            {monthly_cashflow.length === 0
              ? <p className="text-center text-muted-foreground py-8 text-sm">Sem dados suficientes</p>
              : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthly_cashflow} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                    <XAxis dataKey="month" tick={{ fontSize:11, fill:"hsl(var(--muted-foreground))" }}/>
                    <YAxis tickFormatter={fmtK} tick={{ fontSize:11, fill:"hsl(var(--muted-foreground))" }}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Legend/>
                    <Bar dataKey="income"  fill="#22c55e" name="Receitas" radius={[3,3,0,0]}/>
                    <Bar dataKey="expense" fill="#ef4444" name="Gastos"   radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
          </Section>
        </div>
        <div className="md:col-span-2">
          <Section title="Gastos por Categoria">
            {pieData.length === 0
              ? <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>
              : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {pieData.map((d, i) => <Cell key={i} fill={d.fill}/>)}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v)}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {pieData.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.fill }}/>
                          <span className="text-muted-foreground truncate">{d.name}</span>
                        </div>
                        <span className="font-semibold tabular-nums text-destructive text-xs">{formatCurrency(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
          </Section>
        </div>
      </div>

      {/* Monthly net line */}
      {monthly_cashflow.length > 1 && (
        <Section title="Saldo Mensal (Receita − Gasto)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthly_cashflow.map(m => ({ ...m, net: m.income - m.expense }))}>
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
              <XAxis dataKey="month" tick={{ fontSize:11, fill:"hsl(var(--muted-foreground))" }}/>
              <YAxis tickFormatter={fmtK} tick={{ fontSize:11, fill:"hsl(var(--muted-foreground))" }}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2} fill="url(#netGrad)" name="Saldo"/>
            </AreaChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Top Entities + Accounts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Section title="Top 10 Entidades — Gastos">
          {entBarData.length === 0
            ? <p className="text-sm text-muted-foreground py-4">Sem vínculos registrados</p>
            : (
              <div className="space-y-2">
                {top_entities_spending.map((e, i) => {
                  const pct = top_entities_spending[0].total > 0 ? (e.total / top_entities_spending[0].total * 100) : 0
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="truncate text-foreground font-medium max-w-52">{e.name}</span>
                        <span className="text-destructive tabular-nums font-semibold shrink-0 ml-2 amount-value">{formatCurrency(e.total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-destructive transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
        </Section>

        <Section title="Saldo por Conta">
          <div className="space-y-2">
            {accounts.map((a, i) => {
              const max = accounts[0]?.balance || 1
              const pct = Math.max(0, (a.balance / max) * 100)
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{a.name} <span className="text-muted-foreground text-xs capitalize">({a.type})</span></span>
                    <span className={`tabular-nums font-semibold amount-value ${a.balance >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(a.balance)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}/>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      </div>

      {/* Investments performance */}
      {investments.length > 0 && (
        <Section title="Performance de Investimentos por Tipo">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              {investments.map((inv, i) => {
                const pct = inv.total_invested > 0 ? ((inv.total_current - inv.total_invested) / inv.total_invested * 100) : 0
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: COLORS[i % COLORS.length] + "20" }}>
                      <span className="text-xs font-bold" style={{ color: COLORS[i % COLORS.length] }}>{inv.type.slice(0,2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium capitalize">{inv.type} <span className="text-muted-foreground text-xs">({inv.count} ativos)</span></span>
                        <span className={`tabular-nums font-semibold text-xs ${pct >= 0 ? "text-success" : "text-destructive"}`}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Investido: {formatCurrency(inv.total_invested)}</span>
                        <span>Atual: {formatCurrency(inv.total_current)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div>
              <div className="flex gap-4 mb-4 text-center">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Total Investido</p>
                  <p className="text-lg font-bold tabular-nums amount-value">{formatCurrency(invTotal.invested)}</p>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Valor Atual</p>
                  <p className="text-lg font-bold tabular-nums amount-value">{formatCurrency(invTotal.current)}</p>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Resultado</p>
                  <p className={`text-lg font-bold tabular-nums amount-value ${invProfit >= 0 ? "text-success" : "text-destructive"}`}>
                    {invProfit >= 0 ? "+" : ""}{invProfitPct.toFixed(1)}%
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={investments.map(i => ({ name: i.type, invested: i.total_invested, atual: i.total_current }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:"hsl(var(--muted-foreground))" }}/>
                  <YAxis tickFormatter={fmtK} tick={{ fontSize:11, fill:"hsl(var(--muted-foreground))" }} width={50}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="invested" fill="#6366f1" name="Investido" radius={[3,3,0,0]}/>
                  <Bar dataKey="atual"    fill="#22c55e" name="Atual"     radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Section>
      )}

      {/* Biggest transactions */}
      <Section title="Maiores Transações">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Data","Descrição","Categoria","Conta","Vínculo","Valor"].map(h => (
                  <th key={h} className="text-left pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {biggest_transactions.map((t, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
                  <td className="py-2.5 text-muted-foreground text-xs">{formatDate(t.date)}</td>
                  <td className="py-2.5 truncate max-w-40 font-medium">{t.description}</td>
                  <td className="py-2.5"><span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">{t.category||"—"}</span></td>
                  <td className="py-2.5 text-muted-foreground text-xs">{t.account_name}</td>
                  <td className="py-2.5 text-muted-foreground text-xs truncate max-w-32">{t.entity_name||"—"}</td>
                  <td className={`py-2.5 font-bold tabular-nums amount-value ${t.type==="expense"?"text-destructive":"text-success"}`}>
                    {t.type==="expense"?"-":"+"}{formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
              {biggest_transactions.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Sem transações</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Top senders */}
      {top_entities_receiving.length > 0 && (
        <Section title="Principais Origens de Receita">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {top_entities_receiving.map((e, i) => (
              <div key={i} className="rounded-xl border border-border p-3 text-center">
                <div className="h-10 w-10 rounded-full mx-auto mb-2 flex items-center justify-center text-xs font-bold" style={{ background: COLORS[i%COLORS.length]+"20", color: COLORS[i%COLORS.length] }}>
                  {e.name.slice(0,2).toUpperCase()}
                </div>
                <p className="text-xs font-medium truncate">{e.name}</p>
                <p className="text-success text-sm font-bold mt-0.5">{formatCurrency(e.total)}</p>
                <p className="text-muted-foreground text-xs">{e.count} vez{e.count > 1 ? "es" : ""}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── NEW REPORTS ─────────────────────────────────────────────────────── */}

      {/* Savings rate over time */}
      {savings_rate?.length > 1 && (
        <Section title="Taxa de Poupança Mensal">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={savings_rate}>
              <defs>
                <linearGradient id="srGradPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="srGradNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
              <XAxis dataKey="month" tick={{ fontSize:11, fill:"hsl(var(--muted-foreground))" }}/>
              <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize:11, fill:"hsl(var(--muted-foreground))" }}/>
              <Tooltip formatter={(v) => [`${v}%`, "Taxa de Poupança"]} labelClassName="text-muted-foreground"/>
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4"/>
              <Area type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} fill="url(#srGradPos)" name="Taxa %"/>
            </AreaChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Year-over-year */}
      {yearly_comparison?.length > 0 && (
        <Section title="Comparação Ano a Ano">
          <div className="flex gap-4 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#6366f1]"/> Gastos Ano Atual</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#a78bfa]"/> Gastos Ano Anterior</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#22c55e]"/> Receitas Ano Atual</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={yearly_comparison} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
              <XAxis dataKey="month" tick={{ fontSize:11, fill:"hsl(var(--muted-foreground))" }}/>
              <YAxis tickFormatter={fmtK} tick={{ fontSize:11, fill:"hsl(var(--muted-foreground))" }} width={52}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="curr_expense" name="Gastos Atual"    fill="#6366f1" radius={[3,3,0,0]}/>
              <Bar dataKey="prev_expense" name="Gastos Anterior" fill="#a78bfa" radius={[3,3,0,0]}/>
              <Bar dataKey="curr_income"  name="Receitas Atual"  fill="#22c55e" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Category trend stacked area */}
      {category_trend?.length > 1 && category_trend_keys?.length > 0 && (
        <Section title="Tendência por Categoria — últimos 6 meses">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={category_trend}>
              <defs>
                {category_trend_keys.map((k, i) => (
                  <linearGradient key={k} id={`ctGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[i]} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={COLORS[i]} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
              <XAxis dataKey="month" tick={{ fontSize:11, fill:"hsl(var(--muted-foreground))" }}/>
              <YAxis tickFormatter={fmtK} tick={{ fontSize:11, fill:"hsl(var(--muted-foreground))" }} width={52}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend/>
              {category_trend_keys.map((k, i) => (
                <Area key={k} type="monotone" dataKey={k} name={k}
                  stroke={COLORS[i]} strokeWidth={2} fill={`url(#ctGrad${i})`} stackId="1"/>
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Spending by weekday */}
      {weekday_spending?.length > 0 && (
        <Section title="Gastos por Dia da Semana">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekday_spending} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
                <XAxis dataKey="weekday" tick={{ fontSize:12, fill:"hsl(var(--muted-foreground))" }}/>
                <YAxis tickFormatter={fmtK} tick={{ fontSize:11, fill:"hsl(var(--muted-foreground))" }} width={48}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="total" name="Gasto" radius={[4,4,0,0]}>
                  {weekday_spending.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {[...weekday_spending].sort((a,b) => b.total - a.total).map((w, i) => {
                const max = weekday_spending[0]?.total || 1
                const pct = (w.total / max) * 100
                return (
                  <div key={w.weekday}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{w.weekday}</span>
                      <span className="text-muted-foreground tabular-nums text-xs">{w.count} txn · {formatCurrency(w.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background: COLORS[i % COLORS.length] }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Section>
      )}

    </div>
  )
}
