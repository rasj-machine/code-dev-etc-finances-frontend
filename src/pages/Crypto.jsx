import { useState, useEffect } from "react"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Badge } from "@/components/ui"
import { Dialog, FormField } from "@/components/Dialog"
import { formatCurrency, formatPercent, calcProfitPercent } from "@/lib/utils"
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Bitcoin } from "lucide-react"

const COINS = ["BTC", "ETH", "SOL", "BNB", "ADA", "DOT", "MATIC", "LINK", "AVAX", "Outro"]
const emptyForm = { name: "BTC", amount: "", purchase_price: "", current_price: "", date: new Date().toISOString().slice(0, 10), account_id: "" }

export default function Crypto() {
  const [holdings, setHoldings] = useState([])
  const [accounts, setAccounts] = useState([])
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const load = () => {
    fetch("/api/investments?type=crypto").then(r => r.ok ? r.json() : []).then(data => setHoldings(Array.isArray(data) ? data.filter(d => d.type === "crypto") : []))
    fetch("/api/accounts").then(r => r.ok ? r.json() : []).then(d => setAccounts(Array.isArray(d) ? d : []))
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm({ ...emptyForm, account_id: accounts[0]?.id || "" }); setEditing(null); setOpen(true) }
  const openEdit = (h) => { setForm({ ...h, amount: String(h.amount), purchase_price: String(h.purchase_price), current_price: String(h.current_price) }); setEditing(h.id); setOpen(true) }

  const save = async (e) => {
    e.preventDefault()
    const body = { ...form, type: "crypto", amount: parseFloat(form.amount), purchase_price: parseFloat(form.purchase_price), current_price: parseFloat(form.current_price), account_id: parseInt(form.account_id) }
    if (editing) {
      await fetch(`/api/investments/${editing}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    } else {
      await fetch("/api/investments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    }
    setOpen(false)
    load()
  }

  const remove = async (id) => {
    await fetch(`/api/investments/${id}`, { method: "DELETE" })
    setDeleting(null)
    load()
  }

  const totalInvested = holdings.reduce((s, h) => s + h.amount * h.purchase_price, 0)
  const totalCurrent = holdings.reduce((s, h) => s + h.amount * (h.current_price || h.purchase_price), 0)
  const totalProfit = totalCurrent - totalInvested

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Carteiras Crypto</h1>
          <p className="text-muted-foreground text-sm mt-1">{holdings.length} ativos cripto</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Novo Ativo</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Aportado", value: formatCurrency(totalInvested) },
          { label: "Valor Atual", value: formatCurrency(totalCurrent) },
          { label: "P&L Total", value: `${totalProfit >= 0 ? "+" : ""}${formatCurrency(totalProfit)}`, color: totalProfit >= 0 ? "text-success" : "text-destructive" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-xl font-bold amount-value ${color || "text-foreground"}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {holdings.map(h => {
          const profit = calcProfitPercent(h.purchase_price, h.current_price || h.purchase_price)
          const currentValue = h.amount * (h.current_price || h.purchase_price)
          const isProfit = profit >= 0
          return (
            <Card key={h.id} className="hover:-translate-y-1 transition-transform duration-300">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
                      <Bitcoin size={18} className="text-warning" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{h.name}</p>
                      <p className="text-xs text-muted-foreground">{h.amount} unidades</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-semibold ${isProfit ? "text-success" : "text-destructive"}`}>
                    {isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {formatPercent(profit)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Preço médio</span><span className="amount-value">{formatCurrency(h.purchase_price)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Preço atual</span><span className="amount-value">{formatCurrency(h.current_price)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold mt-2">
                    <span className="text-muted-foreground">Valor total</span>
                    <span className="text-foreground amount-value">{formatCurrency(currentValue)}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(h)}><Pencil size={13} /> Editar</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(h)}><Trash2 size={13} /></Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {holdings.length === 0 && (
          <div className="col-span-3 text-center py-20 text-muted-foreground">Nenhum ativo cripto cadastrado.</div>
        )}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Editar Ativo Cripto" : "Novo Ativo Cripto"} className="max-w-xl">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Moeda / Coin">
              <Select value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}>
                {COINS.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </FormField>
            <FormField label="Quantidade">
              <Input type="number" step="0.00000001" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.5" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Preço Médio (R$)">
              <Input type="number" step="0.01" required value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} />
            </FormField>
            <FormField label="Preço Atual (R$)">
              <Input type="number" step="0.01" value={form.current_price} onChange={e => setForm(f => ({ ...f, current_price: e.target.value }))} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Data da Compra">
              <Input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
            <FormField label="Carteira / Conta">
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
