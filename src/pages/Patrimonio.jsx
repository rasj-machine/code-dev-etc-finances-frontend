import { useState, useEffect, useMemo } from "react"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, MoneyInput } from "@/components/ui"
import { Dialog, FormField } from "@/components/Dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Pencil, Trash2, Home, Car, Landmark, TrendingDown, Package, TrendingUp, AlertTriangle, Calculator, RefreshCw } from "lucide-react"
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts"

const COLORS    = ["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899"]

const CAT_LABEL = {
  real_estate:"Imóvel", vehicle:"Veículo", savings:"Poupança/Aplicação",
  investment:"Investimento", debt:"Dívida", credit:"Crédito", other:"Outro",
}
const CAT_ICON = { real_estate: Home, vehicle: Car, investment: Landmark, debt: TrendingDown }

const emptyForm = {
  name:"", type:"asset", category:"real_estate",
  value:"", purchase_price:"", depreciation_rate:"",
  acquisition_date:"", notes:""
}

function KPICard({ label, value, color, sub, icon: Icon }) {
  return (
    <Card><CardContent className="pt-5 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
          <p className={`text-2xl font-bold tabular-nums amount-value ${color||"text-foreground"}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5 amount-value">{sub}</p>}
        </div>
        {Icon && <div className="p-2 rounded-lg bg-accent/50"><Icon size={16} className={color||"text-muted-foreground"}/></div>}
      </div>
    </CardContent></Card>
  )
}

// Appreciation / depreciation mini-bar
function ChangeBar({ purchase, change, realValue }) {
  if (!purchase || !change) return null
  const isUp  = change >= 0
  const pct   = Math.min(100, Math.round((Math.abs(change) / purchase) * 100))
  const color = isUp ? "bg-emerald-400" : "bg-amber-400"
  const label = isUp ? "Valorização acumulada" : "Depreciação acumulada"
  const sign  = isUp ? "+" : "-"
  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
        <span>{label}</span>
        <span>{sign}{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }}/>
      </div>
      <div className="flex justify-between text-[10px] mt-0.5">
        <span className={`amount-value ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>{sign}{formatCurrency(Math.abs(change))}</span>
        <span className="text-primary amount-value">Valor real: {formatCurrency(realValue)}</span>
      </div>
    </div>
  )
}

export default function Patrimonio() {
  const [items, setItems]     = useState([])
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [form, setForm]       = useState(emptyForm)
  // today snapshot — stable reference
  const [todayMs] = useState(() => Date.now())

  const load = () =>
    fetch("/api/patrimony").then(r => r.ok ? r.json() : []).then(d => setItems(Array.isArray(d) ? d : []))
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(emptyForm); setEditing(null); setOpen(true) }
  const openEdit   = (item) => {
    setForm({
      ...item,
      value:            String(item.value ?? ""),
      purchase_price:   item.purchase_price ? String(item.purchase_price) : "",
      depreciation_rate:item.depreciation_rate ? String(item.depreciation_rate) : "",
    })
    setEditing(item.id)
    setOpen(true)
  }

  const save = async (e) => {
    e.preventDefault()
    const body = {
      ...form,
      value:            parseFloat(form.value || 0),
      purchase_price:   parseFloat(form.purchase_price || 0),
      depreciation_rate:parseFloat(form.depreciation_rate || 0),
    }
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

  // ── KPI calculations ──────────────────────────────────────────────────────
  const assets      = items.filter(i => i.type === "asset")
  const liabilities = items.filter(i => i.type === "liability")
  const totalAssets    = assets.reduce((s,i) => s + (i.value || 0), 0)
  const totalDebt      = liabilities.reduce((s,i) => s + (i.value || 0), 0)
  const totalPurchase  = assets.reduce((s,i) => s + (i.purchase_price || 0), 0)
  const totalChange    = assets.reduce((s,i) => s + (i.change_amount || 0), 0)
  const totalRealValue = assets.reduce((s,i) => s + (i.real_value || 0), 0)
  const netWorth       = totalAssets - totalDebt
  const realNetWorth   = totalRealValue - totalDebt
  const isNetAppreciating = totalChange >= 0

  // Pie data
  const pieData = useMemo(() => {
    const map = {}
    items.forEach(i => { map[i.category||"other"] = (map[i.category||"other"]||0) + i.value })
    return Object.entries(map).map(([k,v], i) => ({ name: CAT_LABEL[k]||k, value: v, fill: COLORS[i%COLORS.length] }))
  }, [items])

  const f = (k) => (v) => setForm(f => ({...f, [k]: v}))
  const fv = (k) => (e) => setForm(f => ({...f, [k]: e.target.value}))

  const hasDepr = form.purchase_price && parseFloat(form.purchase_price) > 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ativos e Passivos</h1>
          <p className="text-muted-foreground text-sm mt-1">{items.length} itens · resumo operacional</p>
        </div>
        <Button onClick={openCreate}><Plus size={16}/> Novo Item</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Ativos"       value={formatCurrency(totalAssets)}   color="text-success"     icon={TrendingUp}/>
        <KPICard label="Total Passivos"     value={formatCurrency(totalDebt)}     color="text-destructive" icon={TrendingDown}/>
        <KPICard label="Patrimônio Líquido" value={formatCurrency(netWorth)}
          color={netWorth >= 0 ? "text-primary" : "text-destructive"}/>
        <KPICard label="Patrimônio Real" value={formatCurrency(realNetWorth)}
          color={realNetWorth >= 0 ? "text-emerald-400" : "text-destructive"}
          sub={totalChange !== 0
            ? `${totalChange > 0 ? '+' : ''}${formatCurrency(totalChange)} variação sobre custo`
            : undefined}
          icon={totalChange >= 0 ? TrendingUp : AlertTriangle}/>
      </div>

      {/* Depreciation summary bar (only if any item has purchase_price) */}
      {totalPurchase > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isNetAppreciating ? '📈 Valorização' : '📉 Depreciação'} Total dos Ativos
              </p>
              <span className={`text-xs font-semibold amount-value ${isNetAppreciating ? 'text-emerald-400' : 'text-amber-400'}`}>
                {totalChange >= 0 ? '+' : ''}{formatCurrency(totalChange)} sobre custo de compra
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isNetAppreciating
                    ? 'bg-gradient-to-r from-emerald-400 to-green-400'
                    : 'bg-gradient-to-r from-amber-400 to-red-400'
                }`}
                style={{ width: `${Math.min(100, Math.abs(totalChange / totalPurchase) * 100).toFixed(1)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] mt-1.5 text-muted-foreground">
              <span>Custo total de compra: <strong className="amount-value">{formatCurrency(totalPurchase)}</strong></span>
              <span>Valor real atual: <strong className="text-emerald-400 amount-value">{formatCurrency(totalRealValue)}</strong></span>
            </div>
          </CardContent>
        </Card>
      )}

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
                const hasDeprData = item.purchase_price > 0 && item.depreciation_rate !== 0
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
                          {item.years_owned > 0 && ` · ${item.years_owned}a`}
                          {item.depreciation_rate > 0 && ` · ${item.depreciation_rate}%/ano`}
                        </p>
                        {hasDeprData && (
                          <ChangeBar
                            purchase={item.purchase_price}
                            change={item.change_amount}
                            realValue={item.real_value}
                          />
                        )}
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <p className={`font-bold tabular-nums amount-value ${typ==="asset"?"text-success":"text-destructive"}`}>
                          {typ==="asset"?"+":"-"}{formatCurrency(item.value)}
                        </p>
                        {hasDeprData && (
                          <p className={`text-[10px] amount-value ${
                            item.is_appreciating ? 'text-emerald-400' : 'text-muted-foreground'
                          }`}>
                            real: {formatCurrency(item.real_value)}
                          </p>
                        )}
                      </div>
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
          <FormField label="Nome"><Input required value={form.name} onChange={fv('name')} placeholder="Apartamento, Carro..."/></FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo">
              <Select value={form.type} onChange={fv('type')}>
                <option value="asset">Ativo</option>
                <option value="liability">Passivo</option>
              </Select>
            </FormField>
            <FormField label="Categoria">
              <Select value={form.category} onChange={fv('category')}>
                {Object.entries(CAT_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Valor atual (R$)">
              <MoneyInput required value={form.value} onValueChange={f('value')}/>
            </FormField>
            <FormField label="Data de aquisição">
              <Input type="date" value={form.acquisition_date} onChange={fv('acquisition_date')}/>
            </FormField>
          </div>

          {/* Appreciation / depreciation fields */}
          {(() => {
            const rate      = parseFloat(form.depreciation_rate || 0)
            const purchase  = parseFloat(form.purchase_price   || 0)
            const currVal   = parseFloat(form.value            || 0)
            const acqDate   = form.acquisition_date
            const isUp      = rate > 0
            const accent    = isUp ? 'text-emerald-400' : 'text-amber-400'
            const Icon      = isUp ? TrendingUp : TrendingDown

            // years from acquisition_date to today
            const yearsFromDate = (d) => {
              if (!d) return 0
              const diff = (todayMs - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
              return Math.max(0, diff)
            }

            // ── Calcular taxa anual a partir de: compra + valor atual + data
            const calcRate = () => {
              const years = yearsFromDate(acqDate)
              if (!purchase || !currVal || !years) {
                alert('Preencha: valor de compra, valor atual e data de aquisição.')
                return
              }
              const r = ((currVal - purchase) / purchase / years) * 100
              setForm(f => ({ ...f, depreciation_rate: parseFloat(r.toFixed(2)) }))
            }

            // ── Calcular valor atual a partir de: compra + taxa + data
            const calcValue = () => {
              const years = yearsFromDate(acqDate)
              if (!purchase || !rate || !years) {
                alert('Preencha: valor de compra, taxa anual e data de aquisição.')
                return
              }
              const v = Math.max(0, purchase + purchase * (rate / 100) * years)
              setForm(f => ({ ...f, value: String(Math.round(v)) }))
            }

            // preview line
            const showPreview = hasDepr && rate && acqDate
            const years       = yearsFromDate(acqDate)
            const projVal     = showPreview
              ? Math.max(0, purchase + purchase * (rate / 100) * years)
              : null

            return (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Icon size={11}/> Valorização / Depreciação (opcional)
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Valor de compra (R$)">
                    <MoneyInput value={form.purchase_price} onValueChange={f('purchase_price')} placeholder="0"/>
                  </FormField>
                  <FormField label="Taxa anual % (+ valoriza · - deprecia)">
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="-100" max="500" step="0.5"
                        value={form.depreciation_rate}
                        onChange={fv('depreciation_rate')}
                        placeholder="Ex: 10 ou -10"
                        disabled={!hasDepr}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={calcRate}
                        disabled={!hasDepr}
                        title="Calcular taxa a partir do valor atual e data"
                        className="px-2 py-1.5 rounded-lg border border-border bg-background hover:bg-accent disabled:opacity-30 transition-colors shrink-0"
                      >
                        <Calculator size={13} className="text-primary"/>
                      </button>
                    </div>
                  </FormField>
                </div>

                {/* Calc value button */}
                {hasDepr && rate && acqDate && (
                  <button
                    type="button"
                    onClick={calcValue}
                    className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border border-border/60 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw size={11}/>
                    Calcular valor atual pela taxa ({Math.abs(rate)}%/ano × {years.toFixed(1)}a)
                    {projVal !== null && (
                      <span className={`font-semibold ml-1 ${projVal >= purchase ? 'text-emerald-400' : 'text-amber-400'}`}>
                        → {formatCurrency(projVal)}
                      </span>
                    )}
                  </button>
                )}

                {showPreview && (
                  <p className={`text-[11px] ${accent}`}>
                    {isUp ? 'Valorização' : 'Depreciação'} linear de {Math.abs(rate)}%/ano
                    {' '}sobre {formatCurrency(purchase)} · {years.toFixed(1)} anos
                    {projVal !== null && <> → valor calculado: <strong>{formatCurrency(projVal)}</strong></>}
                  </p>
                )}
                {!hasDepr && (
                  <p className="text-[11px] text-muted-foreground">Preencha o valor de compra para habilitar o cálculo de variação.</p>
                )}
              </div>
            )
          })()}

          <FormField label="Observações">
            <Input value={form.notes} onChange={fv('notes')} placeholder="Opcional..."/>
          </FormField>

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
