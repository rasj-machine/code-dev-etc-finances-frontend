import { useState, useEffect, useMemo } from "react"
import { Button, Card, CardContent, Input, Select, Badge, MoneyInput } from "@/components/ui"
import { Dialog, FormField } from "@/components/Dialog"
import { formatCurrency, formatPercent, calcProfitPercent } from "@/lib/utils"
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Search, ChevronDown, ChevronUp } from "lucide-react"

const TYPES = ["stock", "fixed", "fund", "reit", "crypto"]
const TYPE_LABELS = { stock: "Ação", fixed: "Renda Fixa", fund: "Fundo", reit: "FII", crypto: "Crypto" }
const emptyForm = { name: "", type: "stock", amount: "", purchase_price: "", current_price: "", date: new Date().toISOString().slice(0, 10), account_id: "" }

const SORT_OPTS = [
  { val: "name", label: "Nome A→Z" },
  { val: "profit_desc", label: "Maior rentabilidade" },
  { val: "profit_asc", label: "Menor rentabilidade" },
  { val: "value_desc", label: "Maior valor atual" },
  { val: "invested_desc", label: "Maior investido" },
]

export default function Investimentos() {
  const [investments, setInvestments] = useState([])
  const [accounts, setAccounts] = useState([])
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [sortKey, setSortKey] = useState("value_desc")

  const load = () => {
    fetch("/api/investments").then(r => r.ok ? r.json() : []).then(d => setInvestments(Array.isArray(d) ? d : []))
    fetch("/api/accounts").then(r => r.ok ? r.json() : []).then(d => setAccounts(Array.isArray(d) ? d : []))
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm({ ...emptyForm, account_id: accounts[0]?.id || "" }); setEditing(null); setOpen(true) }
  const openEdit = (inv) => { setForm({ ...inv, amount: String(inv.amount * 100), purchase_price: String(inv.purchase_price), current_price: String(inv.current_price) }); setEditing(inv.id); setOpen(true) }

  const save = async (e) => {
    e.preventDefault()
    const body = { ...form, amount: parseFloat(form.amount), purchase_price: parseFloat(form.purchase_price), current_price: parseFloat(form.current_price), account_id: parseInt(form.account_id) }
    if (editing) {
      await fetch(`/api/investments/${editing}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    } else {
      await fetch("/api/investments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    }
    setOpen(false); load()
  }

  const remove = async (id) => {
    await fetch(`/api/investments/${id}`, { method: "DELETE" })
    setDeleting(null); load()
  }

  const enriched = useMemo(() => investments.map(inv => ({
    ...inv,
    currentVal: (inv.amount * 100) * (inv.current_price || inv.purchase_price),
    invested: (inv.amount * 100) * inv.purchase_price,
    profit: calcProfitPercent(inv.purchase_price, inv.current_price || inv.purchase_price),
  })), [investments])

  const visible = useMemo(() => {
    let list = enriched.filter(inv => {
      if (filterType !== "all" && inv.type !== filterType) return false
      if (search && !inv.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    switch (sortKey) {
      case "name": list.sort((a, b) => a.name.localeCompare(b.name)); break
      case "profit_desc": list.sort((a, b) => b.profit - a.profit); break
      case "profit_asc": list.sort((a, b) => a.profit - b.profit); break
      case "value_desc": list.sort((a, b) => b.currentVal - a.currentVal); break
      case "invested_desc": list.sort((a, b) => b.invested - a.invested); break
    }
    return list
  }, [enriched, filterType, search, sortKey])

  const totalInvested = visible.reduce((s, i) => s + i.invested, 0)
  const totalCurrent = visible.reduce((s, i) => s + i.currentVal, 0)
  const totalProfit = totalCurrent - totalInvested
  const profitPct = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Investimentos</h1>
          <p className="text-muted-foreground text-sm mt-1">{visible.length} de {investments.length} ativos</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Novo Ativo</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Investido", val: formatCurrency(totalInvested), col: "text-foreground" },
          { label: "Valor Atual", val: formatCurrency(totalCurrent), col: "text-foreground" },
          { label: "Lucro / Prejuízo", val: `${totalProfit >= 0 ? "+" : ""}${formatCurrency(totalProfit)}`, col: totalProfit >= 0 ? "text-success" : "text-destructive" },
          { label: "Rentabilidade", val: `${profitPct >= 0 ? "+" : ""}${formatPercent(profitPct)}`, col: profitPct >= 0 ? "text-success" : "text-destructive" },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-6 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-xl font-bold amount-value ${s.col}`}>{s.val}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <Card><CardContent className="pt-4 pb-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-44">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-7 text-sm h-8" placeholder="Buscar ativo..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm h-8 w-36">
            <option value="all">Todos os tipos</option>
            {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </Select>
          <Select value={sortKey} onChange={e => setSortKey(e.target.value)} className="text-sm h-8 w-44">
            {SORT_OPTS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </Select>
        </div>
      </CardContent></Card>

      {/* Table */}
      <Card><CardContent className="pt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Ativo", "Tipo", "Qtd.", "Preço Compra", "Preço Atual", "Total Atual", "Rentabilidade", "Ações"].map(h => (
                  <th key={h} className="text-left pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(inv => (
                <tr key={inv.id} className="border-b border-border/40 hover:bg-accent/20 transition-colors group">
                  <td className="py-3 font-semibold">{inv.name}</td>
                  <td className="py-3"><Badge variant="secondary">{TYPE_LABELS[inv.type] || inv.type}</Badge></td>
                  <td className="py-3 text-muted-foreground tabular-nums">{inv.amount * 100}</td>
                  <td className="py-3 tabular-nums amount-value">{formatCurrency(inv.purchase_price)}</td>
                  <td className="py-3 tabular-nums amount-value">{formatCurrency(inv.current_price)}</td>
                  <td className="py-3 font-medium tabular-nums amount-value">{formatCurrency(inv.currentVal)}</td>
                  <td className={`py-3 font-semibold ${inv.profit >= 0 ? "text-success" : "text-destructive"}`}>
                    <div className="flex items-center gap-1 amount-value">
                      {inv.profit >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {formatPercent(inv.profit)}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(inv)}><Pencil size={13} /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleting(inv)}><Trash2 size={13} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">Nenhum investimento cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent></Card>

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Editar Ativo" : "Novo Ativo"}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nome do Ativo">
              <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="PETR4, Tesouro Selic..." />
            </FormField>
            <FormField label="Tipo">
              <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Quantidade">
              <Input type="number" step="0.0001" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </FormField>
            <FormField label="Preço Compra">
              <MoneyInput required value={form.purchase_price} onValueChange={val => setForm(f => ({ ...f, purchase_price: val }))} />
            </FormField>
            <FormField label="Preço Atual">
              <MoneyInput value={form.current_price} onValueChange={val => setForm(f => ({ ...f, current_price: val }))} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Data da Compra">
              <Input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
            <FormField label="Conta / Corretora">
              <Select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
                <option value="">Selecione</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editing ? "Salvar" : "Adicionar"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Excluir Ativo">
        <p className="text-muted-foreground mb-4">Excluir <strong>{deleting?.name}</strong>?</p>
        <div className="flex gap-3">
          <Button variant="destructive" className="flex-1" onClick={() => remove(deleting.id)}>Excluir</Button>
          <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
        </div>
      </Dialog>
    </div>
  )
}
