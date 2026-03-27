import { useState, useEffect, useMemo } from "react"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Badge, MoneyInput } from "@/components/ui"
import { Dialog, FormField } from "@/components/Dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Pencil, Trash2, CheckCircle2, AlertCircle, Link2, RefreshCw } from "lucide-react"
import SearchableSelect from "@/components/SearchableSelect"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
  ComposedChart, Bar, LineChart, Line
} from "recharts"

const DEFAULT_CATS = ["Alimentação","Transporte","Moradia","Saúde","Educação","Lazer","Assinaturas","Salário","Investimento","Consórcios","Boleto","Outros"]
const STATUS_LABEL = { pending:"Pendente", confirmed:"Confirmada", cancelled:"Cancelada" }
const STATUS_COLOR = {
  pending:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  confirmed: "bg-success/10 text-success border-success/20",
  cancelled: "bg-muted/30 text-muted-foreground border-border",
}

const emptyForm = {
  date: new Date().toISOString().slice(0,10),
  description:"", category:"Outros", amount:"", type:"expense",
  account_id:"", entity_id:"", notes:"", status:"pending",
  recurring_id:"", transaction_id:""
}

const fmtK = (v) => `R$${Math.abs(v) >= 1000 ? (v/1000).toFixed(1)+"k" : Number(v).toFixed(0)}`

function lastNMonths(n = 12) {
  const result = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return result
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }}/>
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-bold amount-value">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function PreTransacoes() {
  const [items, setItems]         = useState([])
  const [accounts, setAccounts]   = useState([])
  const [entities, setEntities]   = useState([])
  const [transactions, setTxns]   = useState([])
  const [open, setOpen]           = useState(false)
  const [editing, setEditing]     = useState(null)
  const [deleting, setDeleting]   = useState(null)
  const [linking, setLinking]     = useState(null)   // pre-transaction being linked to a real txn
  const [linkTxnId, setLinkTxnId] = useState("")
  const [form, setForm]           = useState(emptyForm)
  const [statusFilter, setStatusFilter] = useState("pending")
  const [txnSearch, setTxnSearch] = useState("")
  const [categories, setCategories] = useState(DEFAULT_CATS)

  const load = () => {
    fetch("/api/pre-transactions").then(r => r.ok ? r.json() : []).then(d => setItems(Array.isArray(d) ? d : []))
    fetch("/api/accounts").then(r => r.ok ? r.json() : []).then(d => setAccounts(Array.isArray(d) ? d : []))
    fetch("/api/entities").then(r => r.ok ? r.json() : []).then(d => setEntities(Array.isArray(d) ? d : []))
    fetch("/api/transactions").then(r => r.ok ? r.json() : []).then(d => setTxns(Array.isArray(d) ? d : []))
    fetch("/api/categories").then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setCategories(d.map(c => c.name)) }).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(emptyForm); setEditing(null); setOpen(true) }
  const openEdit   = (i) => { setForm({ ...i, amount: String(i.amount), transaction_id: i.transaction_id||"", recurring_id: i.recurring_id||"" }); setEditing(i.id); setOpen(true) }

  const save = async (e) => {
    e.preventDefault()
    const body = { ...form, amount: parseFloat(form.amount) }
    if (editing) {
      await fetch(`/api/pre-transactions/${editing}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) })
    } else {
      await fetch("/api/pre-transactions", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) })
    }
    setOpen(false); load()
  }

  const remove = async (id) => {
    await fetch(`/api/pre-transactions/${id}`, { method:"DELETE" }); setDeleting(null); load()
  }

  // Confirm: creates real transaction from pre-transaction
  const confirm = async (id) => {
    await fetch(`/api/pre-transactions/${id}/confirm`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({}) })
    load()
  }

  // Link an existing transaction and auto-confirm
  const linkTransaction = async () => {
    if (!linking || !linkTxnId) return
    await fetch(`/api/pre-transactions/${linking.id}/confirm`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ transaction_id: parseInt(linkTxnId) })
    })
    setLinking(null); setLinkTxnId(""); load()
  }

  const visible = useMemo(() =>
    statusFilter === "all" ? items : items.filter(i => i.status === statusFilter)
  , [items, statusFilter])

  const totalPending  = items.filter(i => i.status === "pending" && i.type==="expense").reduce((s,i) => s + i.amount, 0)
  const totalIncoming = items.filter(i => i.status === "pending" && i.type==="income").reduce((s,i) => s + i.amount, 0)

  // ── Monthly cashflow chart: real txns + pending pre-transactions ───────────
  const monthlyChart = useMemo(() => {
    const months = lastNMonths(12)
    const map = {}
    for (const m of months) map[m] = { month: m, income: 0, expense: 0, pending_income: 0, pending_expense: 0 }
    for (const pt of items) {
      const m = pt.date?.slice(0, 7)
      if (!map[m]) continue
      if (pt.status === "confirmed") {
        if (pt.type === "income") map[m].income += pt.amount
        else map[m].expense += pt.amount
      } else if (pt.status === "pending") {
        if (pt.type === "income") map[m].pending_income += pt.amount
        else map[m].pending_expense += pt.amount
      }
    }
    return months.map(m => map[m])
  }, [items])

  // ── Previsao de Caixa: 6 months back (real) + 6 months forward (pending) ──
  const cashflowData = useMemo(() => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    // Build 13-month window: -6 to +6
    const months = []
    for (let i = -6; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }

    const map = {}
    for (const m of months) map[m] = { month: m, income: 0, expense: 0, proj_income: 0, proj_expense: 0, isFuture: m > currentMonth }

    // Past/current: real transactions
    for (const t of transactions) {
      const m = t.date?.slice(0, 7)
      if (!map[m]) continue
      if (t.type === "income") map[m].income += t.amount
      else map[m].expense += t.amount
    }

    // All months with pending pre-transactions (past, current, future)
    for (const pt of items) {
      if (pt.status !== "pending") continue
      const m = pt.date?.slice(0, 7)
      if (!map[m]) continue
      if (pt.type === "income") map[m].proj_income += pt.amount
      else map[m].proj_expense += pt.amount
    }

    // Compute TWO running balances:
    // balance_real: accumulated from real transactions only (null after current month → line stops)
    // balance_projected: real past + (real + pending) present/future → continuous projection
    let runningReal = 0
    let runningProj = 0
    return months.map(m => {
      const row = map[m]
      const realNet  = row.income - row.expense
      const pendNet  = row.proj_income - row.proj_expense

      runningReal = parseFloat((runningReal + realNet).toFixed(2))
      runningProj = parseFloat((runningProj + realNet + pendNet).toFixed(2))

      return {
        ...row,
        balance_real:      row.isFuture ? null : runningReal,        // solid line — only past
        balance_projected: runningProj,                               // dashed line — real + pendente
      }
    })
  }, [transactions, items])

  const accountOptions = [{ value:"", label:"— nenhuma —" }, ...accounts.map(a => ({ value: String(a.id), label: a.name }))]
  const entityOptions  = [{ value:"", label:"— nenhum —" },  ...entities.map(e => ({ value: String(e.id), label: e.display_name || e.name }))]

  // Filtered transactions for linking
  const filteredTxns = useMemo(() => {
    if (!txnSearch) return transactions.slice(0, 50)
    const q = txnSearch.toLowerCase()
    return transactions.filter(t =>
      t.description?.toLowerCase().includes(q) ||
      t.date?.includes(q) ||
      String(t.id) === q
    ).slice(0, 50)
  }, [transactions, txnSearch])

  const txnOptions = filteredTxns.map(t => ({
    value: String(t.id),
    label: `#${t.id} · ${formatDate(t.date)} · ${t.description} (${formatCurrency(t.amount)})`
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pré-Transações</h1>
          <p className="text-muted-foreground text-sm mt-1">Lançamentos planejados · confirme ou vincule a uma transação real</p>
        </div>
        <Button onClick={openCreate}><Plus size={16}/> Novo Planejamento</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Saídas Pendentes</p>
          <p className="text-2xl font-bold text-destructive amount-value">{formatCurrency(totalPending)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Entradas Pendentes</p>
          <p className="text-2xl font-bold text-success amount-value">{formatCurrency(totalIncoming)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Saldo Esperado</p>
          <p className={`text-2xl font-bold amount-value ${totalIncoming - totalPending >= 0 ? "text-primary" : "text-destructive"}`}>
            {formatCurrency(totalIncoming - totalPending)}
          </p>
        </CardContent></Card>
      </div>

      {/* ── Saldo Real vs Saldo Previsto — gráfico de linhas limpo ── */}
      {cashflowData.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Saldo Real × Saldo Previsto</CardTitle>
            <p className="text-xs text-muted-foreground">
              Sólido = acumulado de transações reais · Tracejado = real + pré-transações pendentes
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={cashflowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}/>
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{ fontSize: 11 }}/>
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3"/>
                <ReferenceLine
                  x={`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`}
                  stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: "Hoje", position: "insideTopRight", fill: "#f59e0b", fontSize: 10 }}
                />
                <Line type="monotone" dataKey="balance_real" stroke="#6366f1" strokeWidth={2.5}
                  name="Saldo Real" dot={{ r: 3, fill: "#6366f1" }} connectNulls={false}/>
                <Line type="monotone" dataKey="balance_projected" stroke="#a78bfa" strokeWidth={2}
                  strokeDasharray="6 3" name="Saldo Previsto (real + pendente)"
                  dot={{ r: 2, fill: "#a78bfa" }}/>
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Previsão de Caixa: 6 meses reais + 6 meses previstos ── */}
      {cashflowData.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Previsão de Caixa — 6 meses retrô + 6 meses à frente</CardTitle>
            <p className="text-xs text-muted-foreground">
              Barras sólidas = transações reais · barras claras = pré-transações pendentes · linha = saldo acumulado
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={cashflowData} barGap={2}>
                <defs>
                  <linearGradient id="gCashBal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}/>
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{ fontSize: 11 }}/>
                {/* Current month divider */}
                <ReferenceLine
                  x={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
                  stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={1.5}
                  label={{ value: "Hoje", position: "insideTopRight", fill: "#f59e0b", fontSize: 10 }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3"/>
                {/* Real transactions: past */}
                <Bar dataKey="income"      name="Receita Real"     fill="#22c55e" radius={[3,3,0,0]} barSize={12}/>
                <Bar dataKey="expense"     name="Despesa Real"     fill="#ef4444" radius={[3,3,0,0]} barSize={12}/>
                {/* Pending pre-transactions: future */}
                <Bar dataKey="proj_income"  name="Receita Prevista" fill="#86efac" radius={[3,3,0,0]} barSize={12} opacity={0.7}/>
                <Bar dataKey="proj_expense" name="Despesa Prevista" fill="#fca5a5" radius={[3,3,0,0]} barSize={12} opacity={0.7}/>
                {/* Saldo real (passado) — linha sólida */}
                <Area type="monotone" dataKey="balance_real" stroke="#6366f1" strokeWidth={2.5}
                  fill="url(#gCashBal)" name="Saldo Real" dot={{ r: 3, fill: "#6366f1" }} connectNulls={false}/>
                {/* Saldo acumulado previsto (real + pendente) — linha tracejada */}
                <Area type="monotone" dataKey="balance_projected" stroke="#a78bfa" strokeWidth={2}
                  fill="none" strokeDasharray="6 3" name="Saldo Previsto (real + pendente)" dot={{ r: 2, fill: "#a78bfa" }}/>
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Cashflow chart: confirmed + pending pre-transactions */}
      {monthlyChart.some(m => m.income || m.expense || m.pending_income || m.pending_expense) && (
        <Card><CardHeader className="pb-2">
          <CardTitle className="text-sm">Fluxo Mensal de Pré-Transações — últimos 12 meses</CardTitle>
          <p className="text-xs text-muted-foreground">Sólido = confirmado · Tracejado = pendente</p>
        </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyChart}>
                <defs>
                  <linearGradient id="giPT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gePT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                <XAxis dataKey="month" tick={{ fontSize:10, fill:"hsl(var(--muted-foreground))" }}/>
                <YAxis tickFormatter={fmtK} tick={{ fontSize:10, fill:"hsl(var(--muted-foreground))" }}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{ fontSize:11 }}/>
                <ReferenceLine y={0} stroke="hsl(var(--border))"/>
                <Area type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} fill="url(#giPT)" name="Entrada Confirmada" dot={{ r:3 }}/>
                <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#gePT)" name="Saída Confirmada" dot={{ r:3 }}/>
                <Area type="monotone" dataKey="pending_income" stroke="#86efac" strokeWidth={1.5} fill="none" strokeDasharray="5 3" name="Entrada Pendente" dot={false}/>
                <Area type="monotone" dataKey="pending_expense" stroke="#fca5a5" strokeWidth={1.5} fill="none" strokeDasharray="5 3" name="Saída Pendente" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {[["all","Todos"],["pending","Pendentes"],["confirmed","Confirmados"],["cancelled","Cancelados"]].map(([v,l]) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${statusFilter===v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
            {l} <span className="ml-1 opacity-60">({v === "all" ? items.length : items.filter(i=>i.status===v).length})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["","Data","Descrição","Categoria","Tipo","Valor","Status","Ações"].map(h => (
                <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {visible.map(item => (
                <tr key={item.id} className={`border-b border-border/40 hover:bg-accent/20 group transition-opacity ${item.status === "confirmed" ? "opacity-50" : ""}`}>
                  {/* Origin badge */}
                  <td className="px-2 py-3">
                    {item.recurring_id ? (
                      <span title={`Recorrente: ${item.recurring_name||""}`} className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary">
                        <RefreshCw size={9}/>
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted/30 text-muted-foreground">
                        <Plus size={9}/>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatDate(item.date)}</td>
                  <td className="px-3 py-3 max-w-xs">
                    <p className="font-medium truncate">{item.description}</p>
                    {item.recurring_name && <p className="text-xs text-primary flex items-center gap-1"><RefreshCw size={9}/>{item.recurring_name}</p>}
                    {item.linked_txn_description && <p className="text-xs text-success flex items-center gap-1"><Link2 size={9}/>#{item.transaction_id}: {item.linked_txn_description}</p>}
                    {item.entity_name && <p className="text-xs text-muted-foreground">{item.entity_name}</p>}
                    {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                  </td>
                  <td className="px-3 py-3"><Badge variant="secondary">{item.category||"—"}</Badge></td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-medium ${item.type==="expense"?"text-destructive":"text-success"}`}>
                      {item.type==="expense"?"Saída":"Entrada"}
                    </span>
                  </td>
                  <td className={`px-3 py-3 font-bold tabular-nums amount-value ${item.type==="expense"?"text-destructive":"text-success"}`}>
                    {item.type==="expense"?"-":"+"}{formatCurrency(item.amount)}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.status === "pending" && (<>
                        <Button size="icon" variant="ghost" className="text-success" title="Confirmar — cria transação real" onClick={() => confirm(item.id)}>
                          <CheckCircle2 size={14}/>
                        </Button>
                        <Button size="icon" variant="ghost" className="text-primary" title="Vincular transação existente" onClick={() => { setLinking(item); setLinkTxnId("") }}>
                          <Link2 size={14}/>
                        </Button>
                      </>)}
                      <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil size={13}/></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleting(item)}><Trash2 size={13}/></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <AlertCircle size={32} className="opacity-30"/>
              <p>Nenhuma pré-transação {statusFilter !== "all" ? STATUS_LABEL[statusFilter]?.toLowerCase() : ""}</p>
            </div>
          )}
        </div>
      </CardContent></Card>

      {/* Create/Edit Form */}
      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Editar Pré-Transação" : "Nova Pré-Transação"}>
        <form onSubmit={save} className="space-y-4">
          <FormField label="Descrição"><Input required value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Ex: Conta de Luz..."/></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Valor (R$)"><MoneyInput required value={form.amount} onValueChange={val => setForm(f=>({...f,amount:val}))}/></FormField>
            <FormField label="Data Prevista"><Input type="date" required value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))}/></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo">
              <Select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
                <option value="expense">Saída</option>
                <option value="income">Entrada</option>
              </Select>
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
                <option value="pending">Pendente</option>
                <option value="cancelled">Cancelada</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Categoria">
            <SearchableSelect value={form.category} onChange={v => setForm(f=>({...f,category:v}))} options={categories.map(c=>({value:c,label:c}))} placeholder="Categoria..."/>
          </FormField>
          <FormField label="Conta">
            <SearchableSelect value={String(form.account_id||"")} onChange={v => setForm(f=>({...f,account_id:v}))} options={accountOptions} placeholder="Conta..."/>
          </FormField>
          <FormField label="Vínculo">
            <SearchableSelect value={String(form.entity_id||"")} onChange={v => setForm(f=>({...f,entity_id:v}))} options={entityOptions} placeholder="Entidade..."/>
          </FormField>
          <FormField label="Observações"><Input value={form.notes||""} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Opcional..."/></FormField>

          {/* Link to existing transaction (optional) */}
          <FormField label="Vincular a transação existente (opcional)">
            <div className="space-y-2">
              <input value={txnSearch} onChange={e => setTxnSearch(e.target.value)} placeholder="Buscar transação..." className="w-full h-8 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:border-primary"/>
              <SearchableSelect value={String(form.transaction_id||"")} onChange={v => setForm(f=>({...f,transaction_id:v, status: v ? "confirmed" : f.status}))} options={[{value:"",label:"— nenhuma —"},...txnOptions]} placeholder="Selecionar transação..."/>
              {form.transaction_id && <p className="text-xs text-success flex items-center gap-1"><CheckCircle2 size={11}/> Ao salvar, será marcada como confirmada automaticamente</p>}
            </div>
          </FormField>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editing?"Salvar":"Criar"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Dialog>

      {/* Link to existing transaction modal */}
      <Dialog open={!!linking} onClose={() => setLinking(null)} title={`Vincular transação — ${linking?.description}`}>
        <p className="text-sm text-muted-foreground mb-4">
          Selecione uma transação já existente para confirmar este planejamento sem criar uma nova transação.
        </p>
        <div className="space-y-3">
          <input value={txnSearch} onChange={e => setTxnSearch(e.target.value)} placeholder="Buscar transação..." className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:border-primary"/>
          <SearchableSelect value={linkTxnId} onChange={setLinkTxnId} options={[{value:"",label:"— selecionar —"},...txnOptions]} placeholder="Selecionar transação..."/>
          {linkTxnId && (
            <p className="text-xs text-success flex items-center gap-1"><CheckCircle2 size={11}/> Transação selecionada · será vinculada e marcada como confirmada</p>
          )}
        </div>
        <div className="flex gap-3 mt-4">
          <Button className="flex-1" disabled={!linkTxnId} onClick={linkTransaction}><Link2 size={14}/> Vincular e Confirmar</Button>
          <Button variant="outline" onClick={() => setLinking(null)}>Cancelar</Button>
        </div>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Excluir Pré-Transação">
        <p className="text-muted-foreground mb-4">Excluir <strong>{deleting?.description}</strong>?</p>
        <div className="flex gap-3">
          <Button variant="destructive" className="flex-1" onClick={() => remove(deleting.id)}>Excluir</Button>
          <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
        </div>
      </Dialog>
    </div>
  )
}
