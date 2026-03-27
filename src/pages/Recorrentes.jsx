import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Badge, MoneyInput } from "@/components/ui"
import { Dialog, FormField } from "@/components/Dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Pencil, Trash2, RefreshCw, CalendarClock, CheckCircle2, Link2, ExternalLink } from "lucide-react"
import SearchableSelect from "@/components/SearchableSelect"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Legend, ComposedChart, Line
} from "recharts"

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]
const fmtK = (v) => `R$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + "k" : Number(v).toFixed(0)}`

const FREQ_LABEL = { monthly: "Mensal", weekly: "Semanal", annual: "Anual", bimonthly: "Bimestral", biweekly: "Quinzenal", daily: "Diário" }
const DEFAULT_CATS = ["Alimentação", "Transporte", "Moradia", "Saúde", "Educação", "Lazer", "Assinaturas", "Salário", "Investimento", "Consórcios", "Boleto", "Outros"]
const emptyForm = { name: "", category: "Assinaturas", amount: "", type: "expense", frequency: "monthly", account_id: "", entity_id: "", next_date: "", active: 1, notes: "" }

const PERIOD_OPTIONS = [
  { days: 30, label: "30 dias" },
  { days: 60, label: "60 dias" },
  { days: 90, label: "90 dias" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 ano" },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-bold amount-value">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Recorrentes() {
  const [recurrents, setRecurrents] = useState([])
  const [forecast, setForecast] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [entities, setEntities] = useState([])
  const [categories, setCategories] = useState(DEFAULT_CATS)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [days, setDays] = useState(90)
  // Pre-transactions modal per recurring
  const [preTxnModal, setPreTxnModal] = useState(null)  // { recurring, items }
  const navigate = useNavigate()

  const loadForecast = (d = days) => fetch(`/api/forecast?days=${d}`).then(r => r.ok ? r.json() : null).then(setForecast)

  const load = () => {
    fetch("/api/recurring").then(r => r.ok ? r.json() : []).then(d => setRecurrents(Array.isArray(d) ? d : []))
    fetch("/api/accounts").then(r => r.ok ? r.json() : []).then(d => setAccounts(Array.isArray(d) ? d : []))
    fetch("/api/entities").then(r => r.ok ? r.json() : []).then(d => setEntities(Array.isArray(d) ? d : []))
    fetch("/api/categories").then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setCategories(d.map(c => c.name)) }).catch(() => { })
    loadForecast()
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  const changePeriod = (d) => { setDays(d); loadForecast(d) }

  const openCreate = () => { setForm(emptyForm); setEditing(null); setOpen(true) }
  const openEdit = (r) => { setForm({ ...r, amount: String(r.amount) }); setEditing(r.id); setOpen(true) }

  const openPreTxns = async (r) => {
    const items = await fetch(`/api/recurring/${r.id}/pre-transactions`).then(res => res.json()).catch(() => [])
    setPreTxnModal({ recurring: r, items })
  }

  const save = async (e) => {
    e.preventDefault()
    const body = { ...form, amount: parseFloat(form.amount), active: Number(form.active) || 1 }
    if (editing) {
      await fetch(`/api/recurring/${editing}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    } else {
      await fetch("/api/recurring", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    }
    setOpen(false); load()
  }
  const remove = async (id) => {
    await fetch(`/api/recurring/${id}`, { method: "DELETE" }); setDeleting(null); load()
  }

  // Merge forecast monthly + actual for combo chart
  const comboData = useMemo(() => {
    if (!forecast) return []
    const map = {}
      ; (forecast.monthly || []).forEach(m => { map[m.month] = { ...m, actual_income: 0, actual_expense: 0 } })
      ; (forecast.actual_cashflow || []).forEach(a => {
        if (map[a.month]) { map[a.month].actual_income = a.actual_income; map[a.month].actual_expense = a.actual_expense }
        else map[a.month] = { month: a.month, inflow: 0, outflow: 0, balance: 0, net: 0, actual_income: a.actual_income, actual_expense: a.actual_expense }
      })
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
  }, [forecast])

  const monthlyOut = recurrents.filter(r => r.type === "expense" && r.active).reduce((s, r) => {
    const freq = { monthly: 1, bimonthly: 0.5, annual: 1 / 12, weekly: 4.33, biweekly: 2.16, daily: 30 }
    return s + r.amount * (freq[r.frequency] || 1)
  }, 0)
  const monthlyIn = recurrents.filter(r => r.type === "income" && r.active).reduce((s, r) => {
    const freq = { monthly: 1, bimonthly: 0.5, annual: 1 / 12, weekly: 4.33, biweekly: 2.16, daily: 30 }
    return s + r.amount * (freq[r.frequency] || 1)
  }, 0)

  // Positive/negative summary chart data
  const summaryBars = [
    { name: "Entradas Previstas", value: forecast?.total_inflow || 0, fill: "#22c55e" },
    { name: "Saídas Previstas", value: -(forecast?.total_outflow || 0), fill: "#ef4444" },
    { name: "Saldo Final", value: (forecast?.current_balance || 0) + (forecast?.total_inflow || 0) - (forecast?.total_outflow || 0), fill: "#6366f1" },
  ]

  const accountOptions = [{ value: "", label: "— nenhuma —" }, ...accounts.map(a => ({ value: String(a.id), label: a.name }))]
  const entityOptions = [{ value: "", label: "— nenhum —" }, ...entities.map(e => ({ value: String(e.id), label: e.display_name || e.name }))]
  const catOptions = categories.map(c => ({ value: c, label: c }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gastos Recorrentes</h1>
          <p className="text-muted-foreground text-sm mt-1">{recurrents.filter(r => r.active).length} ativos · previsão de {days} dias</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
            {PERIOD_OPTIONS.map(o => (
              <button key={o.days} onClick={() => changePeriod(o.days)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${days === o.days ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                {o.label}
              </button>
            ))}
          </div>
          <Button onClick={openCreate}><Plus size={16} /> Novo</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Saída Mensal Estimada", value: formatCurrency(monthlyOut), color: "text-destructive" },
          { label: "Entrada Mensal Estimada", value: formatCurrency(monthlyIn), color: "text-success" },
          { label: "Saldo Atual Contas", value: formatCurrency(forecast?.current_balance || 0), color: "text-primary" },
          { label: "Média Renda (3 meses)", value: formatCurrency(forecast?.avg_monthly_income || 0), color: "text-amber-400" },
        ].map(k => (
          <Card key={k.label}><CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold amount-value ${k.color}`}>{k.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Chart 1 — Forecast + actual comparison combo chart */}
      {comboData.length > 0 && (
        <Card><CardHeader className="pb-2">
          <CardTitle className="text-sm">Fluxo de Caixa: Previsto × Real — {days} dias</CardTitle>
        </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={comboData}>
                <defs>
                  <linearGradient id="gBal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                {/* Avg income reference line */}
                {forecast?.avg_monthly_income > 0 && (
                  <ReferenceLine y={forecast.avg_monthly_income} stroke="#f59e0b" strokeDasharray="6 3"
                    label={{ value: "Média renda", position: "insideTopRight", fill: "#f59e0b", fontSize: 10 }} />
                )}
                <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2.5} fill="url(#gBal)" name="Saldo Previsto" />
                <Line type="monotone" dataKey="inflow" stroke="#22c55e" strokeWidth={1.5} dot={false} name="Entrada Prevista" strokeDasharray="5 2" />
                <Line type="monotone" dataKey="outflow" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Saída Prevista" strokeDasharray="5 2" />
                <Line type="monotone" dataKey="actual_income" stroke="#86efac" strokeWidth={2} dot={{ r: 3 }} name="Renda Real" />
                <Line type="monotone" dataKey="actual_expense" stroke="#fca5a5" strokeWidth={2} dot={{ r: 3 }} name="Gasto Real" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Chart 2 — Positive/Negative summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Resumo do Período ({days} dias)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={summaryBars} barSize={48}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={(v) => formatCurrency(Math.abs(v))} content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar dataKey="value" name="Valor">
                  {summaryBars.map((b, i) => (
                    <rect key={i} fill={b.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly net chart */}
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Saldo Líquido por Mês (previsto)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={forecast?.monthly || []} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={(v) => formatCurrency(v)} content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                <Bar dataKey="inflow" name="Entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="outflow" name="Saídas" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recurring list */}
      <div className="grid md:grid-cols-2 gap-3">
        {["expense", "income"].map(typ => (
          <div key={typ}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {typ === "expense" ? "🔴 Saídas" : "🟢 Entradas"}
            </p>
            {recurrents.filter(r => r.type === typ).map((r) => (
              <Card key={r.id} className={`mb-2 ${!r.active ? "opacity-40" : ""}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <RefreshCw size={15} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{r.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary">{FREQ_LABEL[r.frequency]}</Badge>
                      {r.category && <Badge variant="outline">{r.category}</Badge>}
                      {r.entity_name && <Badge variant="outline">{r.entity_name}</Badge>}
                      {r.next_date && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><CalendarClock size={10} /> {formatDate(r.next_date)}</span>}
                    </div>
                  </div>
                  <p className={`font-bold tabular-nums shrink-0 amount-value ${typ === "expense" ? "text-destructive" : "text-success"}`}>
                    {typ === "expense" ? "-" : "+"}{formatCurrency(r.amount)}
                  </p>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" title="Ver pré-transações" onClick={() => openPreTxns(r)}><RefreshCw size={13} /></Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil size={13} /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleting(r)}><Trash2 size={13} /></Button>
                  </div>
                </div>
              </Card>
            ))}
            {recurrents.filter(r => r.type === typ).length === 0 && (
              <p className="text-sm text-muted-foreground px-1 mb-3">Nenhum item.</p>
            )}
          </div>
        ))}
      </div>

      {/* Upcoming events */}
      {forecast?.events && forecast.events.length > 0 && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Próximos Eventos ({days} dias)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  {["Data", "Nome", "Categoria", "Valor"].map(h => <th key={h} className="text-left pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide pr-3">{h}</th>)}
                </tr></thead>
                <tbody>
                  {forecast.events.slice(0, 30).map((e, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-accent/20">
                      <td className="py-2 text-muted-foreground text-xs pr-3">{formatDate(e.date)}</td>
                      <td className="py-2 font-medium pr-3">{e.name}</td>
                      <td className="py-2 pr-3"><Badge variant="secondary">{e.category || "—"}</Badge></td>
                      <td className={`py-2 font-bold tabular-nums amount-value ${e.type === "expense" ? "text-destructive" : "text-success"}`}>
                        {e.type === "expense" ? "-" : "+"}{formatCurrency(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Form */}
      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Editar Recorrente" : "Novo Gasto Recorrente"}>
        <form onSubmit={save} className="space-y-4">
          <FormField label="Nome"><Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Netflix, Aluguel..." /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo">
              <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </Select>
            </FormField>
            <FormField label="Frequência">
              <Select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Valor (R$)"><MoneyInput required value={form.amount} onValueChange={val => setForm(f => ({ ...f, amount: val }))} /></FormField>
            <FormField label="Próxima data"><Input type="date" value={form.next_date} onChange={e => setForm(f => ({ ...f, next_date: e.target.value }))} /></FormField>
          </div>
          <FormField label="Categoria">
            <SearchableSelect value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} options={catOptions} placeholder="Categoria..." />
          </FormField>
          <FormField label="Conta">
            <SearchableSelect value={String(form.account_id)} onChange={v => setForm(f => ({ ...f, account_id: v }))} options={accountOptions} placeholder="Conta..." />
          </FormField>
          <FormField label="Vínculo / Entidade">
            <SearchableSelect value={String(form.entity_id)} onChange={v => setForm(f => ({ ...f, entity_id: v }))} options={entityOptions} placeholder="Entidade..." />
          </FormField>
          <FormField label="Observações"><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional..." /></FormField>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="rounded" checked={!!form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked ? 1 : 0 }))} />
            Ativo
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editing ? "Salvar" : "Criar"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Excluir Recorrente">
        <p className="text-muted-foreground mb-4">Excluir <strong>{deleting?.name}</strong>?</p>
        <div className="flex gap-3">
          <Button variant="destructive" className="flex-1" onClick={() => remove(deleting.id)}>Excluir</Button>
          <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
        </div>
      </Dialog>

      {/* Pre-transactions modal for a recurring */}
      <Dialog
        open={!!preTxnModal}
        onClose={() => setPreTxnModal(null)}
        title={`Pré-Transações — ${preTxnModal?.recurring?.name}`}
      >
        {preTxnModal && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">
                {preTxnModal.items.length === 0
                  ? "Nenhuma pré-transação. Edite a recorrência e certifique que tem uma próxima data."
                  : `${preTxnModal.items.length} pré-transações encontrada(s)`
                }
              </p>
              <Button size="sm" variant="outline" onClick={() => { setPreTxnModal(null); navigate("/pre-transacoes") }}>
                <ExternalLink size={12} /> Ver tudo
              </Button>
            </div>
            {preTxnModal.items.map((pt) => {
              const STATUS_COLOR = {
                pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                confirmed: "bg-success/10 text-success border-success/20",
                cancelled: "bg-muted/30 text-muted-foreground border-border",
              }
              const STATUS_LABEL = { pending: "Pendente", confirmed: "Confirmada", cancelled: "Cancelada" }
              return (
                <div key={pt.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/60 hover:bg-accent/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pt.description}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{formatDate(pt.date)}</span>
                      {pt.linked_txn_description && (
                        <span className="text-xs text-success flex items-center gap-0.5"><Link2 size={9} />#{pt.transaction_id}</span>
                      )}
                    </div>
                  </div>
                  <p className={`font-bold tabular-nums text-sm shrink-0 amount-value ${pt.type === "expense" ? "text-destructive" : "text-success"}`}>
                    {pt.type === "expense" ? "-" : "+"}{formatCurrency(pt.amount)}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLOR[pt.status]}`}>
                    {STATUS_LABEL[pt.status]}
                  </span>
                </div>
              )
            })}
            <div className="pt-2">
              <Button className="w-full" onClick={() => { setPreTxnModal(null); navigate("/pre-transacoes") }}>
                Gerenciar Pré-Transações <ExternalLink size={14} />
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
