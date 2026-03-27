import { useState, useEffect, useMemo } from "react"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Badge, MoneyInput } from "@/components/ui"
import { Dialog, FormField } from "@/components/Dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Pencil, Trash2, Home, Car, Landmark, TrendingDown, Package } from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts"

const COLORS    = ["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899"]

const CAT_LABEL = {
  real_estate:"Imóvel", vehicle:"Veículo", savings:"Poupança/Aplicação",
  investment:"Investimento", debt:"Dívida", credit:"Crédito", other:"Outro",
}
const CAT_ICON = { real_estate: Home, vehicle: Car, investment: Landmark, debt: TrendingDown }

const emptyForm = { name:"", type:"asset", category:"real_estate", value:"", acquisition_date:"", notes:"" }

function KPICard({ label, value, color, sub }) {
  return (
    <Card><CardContent className="pt-5 pb-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums amount-value ${color||"text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 amount-value">{sub}</p>}
    </CardContent></Card>
  )
}

export default function Patrimonio() {
  const [items, setItems]   = useState([])
  const [open, setOpen]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [form, setForm]     = useState(emptyForm)

  const load = () => fetch("/api/patrimony").then(r => r.ok ? r.json() : []).then(d => setItems(Array.isArray(d) ? d : []))
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(emptyForm); setEditing(null); setOpen(true) }
  const openEdit   = (item) => { setForm({ ...item, value: String(item.value) }); setEditing(item.id); setOpen(true) }

  const save = async (e) => {
    e.preventDefault()
    const body = { ...form, value: parseFloat(form.value) }
    if (editing) {
      await fetch(`/api/patrimony/${editing}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) })
    } else {
      await fetch("/api/patrimony", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) })
    }
    setOpen(false); load()
  }
  const remove = async (id) => {
    await fetch(`/api/patrimony/${id}`, { method:"DELETE" }); setDeleting(null); load()
  }

  const assets      = items.filter(i => i.type === "asset")
  const liabilities = items.filter(i => i.type === "liability")
  const totalAssets = assets.reduce((s,i) => s + i.value, 0)
  const totalDebt   = liabilities.reduce((s,i) => s + i.value, 0)
  const netWorth    = totalAssets - totalDebt

  // Pie data by category
  const pieData = useMemo(() => {
    const map = {}
    items.forEach(i => { map[i.category||"other"] = (map[i.category||"other"]||0) + i.value })
    return Object.entries(map).map(([k,v], i) => ({ name: CAT_LABEL[k]||k, value: v, fill: COLORS[i%COLORS.length] }))
  }, [items])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Patrimônio</h1>
          <p className="text-muted-foreground text-sm mt-1">{items.length} itens · ativos e passivos</p>
        </div>
        <Button onClick={openCreate}><Plus size={16}/> Novo Item</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Total Ativos"   value={formatCurrency(totalAssets)} color="text-success"/>
        <KPICard label="Total Passivos" value={formatCurrency(totalDebt)}   color="text-destructive"/>
        <KPICard label="Patrimônio Líquido" value={formatCurrency(netWorth)} color={netWorth >= 0 ? "text-primary" : "text-destructive"}/>
      </div>

      {/* Pie + list */}
      <div className="grid md:grid-cols-5 gap-6">
        <div className="md:col-span-2">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={90}>
                    {pieData.map((d,i) => <Cell key={i} fill={d.fill}/>)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map((d,i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.fill }}/>
                      {d.name}
                    </span>
                    <span className="font-semibold tabular-nums amount-value">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-3 space-y-2">
          {["asset","liability"].map(typ => (
            <div key={typ}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {typ === "asset" ? "✅ Ativos" : "🔴 Passivos"}
              </p>
              {items.filter(i => i.type === typ).map(item => {
                const Icon = CAT_ICON[item.category] || Package
                return (
                  <Card key={item.id} className="mb-2">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon size={16} className="text-primary"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {CAT_LABEL[item.category]||item.category}
                          {item.acquisition_date && ` · ${formatDate(item.acquisition_date)}`}
                        </p>
                      </div>
                      <p className={`font-bold tabular-nums amount-value ${typ==="asset"?"text-success":"text-destructive"}`}>
                        {typ==="asset"?"+":"-"}{formatCurrency(item.value)}
                      </p>
                      <div className="flex gap-1 ml-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil size={13}/></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleting(item)}><Trash2 size={13}/></Button>
                      </div>
                    </div>
                    {item.notes && <p className="px-4 pb-3 text-xs text-muted-foreground italic">{item.notes}</p>}
                  </Card>
                )
              })}
              {items.filter(i => i.type === typ).length === 0 && (
                <p className="text-sm text-muted-foreground px-1 mb-3">Nenhum item cadastrado.</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Editar Item" : "Novo Item"}>
        <form onSubmit={save} className="space-y-4">
          <FormField label="Nome"><Input required value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} placeholder="Apartamento, Carro..."/></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo">
              <Select value={form.type} onChange={e => setForm(f => ({...f, type:e.target.value}))}>
                <option value="asset">Ativo</option>
                <option value="liability">Passivo</option>
              </Select>
            </FormField>
            <FormField label="Categoria">
              <Select value={form.category} onChange={e => setForm(f => ({...f, category:e.target.value}))}>
                {Object.entries(CAT_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Valor (R$)"><MoneyInput required value={form.value} onValueChange={val => setForm(f => ({...f, value:val}))}/></FormField>
            <FormField label="Data de aquisição"><Input type="date" value={form.acquisition_date} onChange={e => setForm(f => ({...f, acquisition_date:e.target.value}))}/></FormField>
          </div>
          <FormField label="Observações"><Input value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} placeholder="Opcional..."/></FormField>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editing ? "Salvar" : "Criar"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Excluir Item">
        <p className="text-muted-foreground mb-4">Excluir <strong>{deleting?.name}</strong>?</p>
        <div className="flex gap-3">
          <Button variant="destructive" className="flex-1" onClick={() => remove(deleting.id)}>Excluir</Button>
          <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
        </div>
      </Dialog>
    </div>
  )
}
