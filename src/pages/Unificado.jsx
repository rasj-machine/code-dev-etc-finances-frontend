import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { formatCurrency, formatDate } from "@/lib/utils"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

export default function Unificado() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/reports/unified-flow").then(r => r.ok ? r.json() : []).then(d => {
      setData(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      timestamp: new Date(d.date).getTime()
    }))
  }, [data])

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <span className="ml-3 text-muted-foreground animate-pulse">Calculando fluxo unificado...</span>
    </div>
  )

  return (
     <div className="space-y-6 animate-fade-in pb-12">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold">Fluxo Transacional Unificado</h1>
            <p className="text-muted-foreground text-sm">Visualização consolidada de Transações, Pré-Lançamentos e Faturas (Projeção de 12 meses)</p>
          </div>
          <div className="hidden md:flex gap-4 text-[10px] uppercase font-bold tracking-widest text-muted-foreground bg-accent/30 px-4 py-2 rounded-full border border-border/40">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-success"></div> Ganhos</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-destructive"></div> Gastos</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary"></div> Saldo Previsto</div>
          </div>
        </div>

        <Card className="h-[550px] overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-accent/5 py-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
              Linha de Evolução do Patrimônio Líquido (Cash Flow)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-full pt-8 pb-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                   <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                     <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                   </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis 
                   dataKey="date" 
                   tickFormatter={(str) => {
                      const d = new Date(str + 'T12:00:00') // avoid timezone shifts
                      return d.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
                   }}
                   tick={{fontSize: 10, fill: 'hsl(var(--muted-foreground))'}}
                   minTickGap={40}
                   axisLine={false}
                   tickLine={false}
                />
                <YAxis 
                   tickFormatter={(val) => `R$ ${val/1000}k`}
                   tick={{fontSize: 10, fill: 'hsl(var(--muted-foreground))'}}
                   axisLine={false}
                   tickLine={false}
                   width={60}
                />
                <Tooltip 
                   content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload
                        const isFuture = d.date > todayStr
                        return (
                          <div className="bg-background/95 backdrop-blur-md border border-border p-4 rounded-xl shadow-2xl text-[11px] min-w-[180px] space-y-2">
                            <div className="flex justify-between items-center border-b border-border pb-2 mb-2">
                              <span className="font-bold text-xs">{formatDate(label)}</span>
                              {isFuture && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[8px] uppercase tracking-tighter">Projeção</span>}
                            </div>
                            <div className="space-y-1.5">
                              <div className="text-success flex justify-between gap-4"><span>Ganhos:</span> <span className="amount-value">{formatCurrency(d.income)}</span></div>
                              <div className="text-destructive flex justify-between gap-4"><span>Gastos:</span> <span className="amount-value">{formatCurrency(d.expense)}</span></div>
                              {d.credit > 0 && <div className="text-primary/70 flex justify-between gap-4"><span>Uso Crédito:</span> <span className="amount-value">{formatCurrency(d.credit)}</span></div>}
                              <div className="font-bold pt-2 border-t border-border mt-2 flex justify-between items-center text-sm">
                                <span>Saldo:</span> 
                                <span className={`${d.balance >= 0 ? "text-success" : "text-destructive"} amount-value`}>
                                  {formatCurrency(d.balance)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                   }}
                />
                <ReferenceLine x={todayStr} stroke="red" strokeDasharray="5 5" strokeWidth={1} label={{ position: 'top', value: 'HOJE', fill: 'red', fontSize: 10, fontWeight: 'bold', letterSpacing: '1px' }} />
                <Area 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorBalance)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <Card className="bg-success/5 border-success/10 shadow-none">
             <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-success">Total Previsto (6 meses)</h3>
                  <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center text-success">↑</div>
                </div>
                <div className="text-2xl font-black tabular-nums text-success amount-value">
                  {formatCurrency(data.filter(d => d.date > todayStr).reduce((s, d) => s + d.income, 0))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 italic px-1">Considerando pré-transações pendentes e recorrências no período.</p>
             </CardContent>
           </Card>

           <Card className="bg-destructive/5 border-destructive/10 shadow-none">
             <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-destructive">Saídas Previstas (6 meses)</h3>
                  <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">↓</div>
                </div>
                <div className="text-2xl font-black tabular-nums text-destructive amount-value">
                  {formatCurrency(data.filter(d => d.date > todayStr).reduce((s, d) => s + d.expense, 0))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 italic px-1">Inclui liquidações de faturas programadas e contas a pagar.</p>
             </CardContent>
           </Card>

           <Card className="bg-primary/5 border-primary/10 shadow-none md:col-span-2 lg:col-span-1">
             <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Saldo Final Estimado</h3>
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">Σ</div>
                </div>
                <div className="text-2xl font-black tabular-nums text-primary amount-value">
                  {formatCurrency(data[data.length - 1]?.balance || 0)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 italic px-1">Projeção estimada para {formatDate(data[data.length - 1]?.date || "")}.</p>
             </CardContent>
           </Card>
        </div>
     </div>
  )
}
