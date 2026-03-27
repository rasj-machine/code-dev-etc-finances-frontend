import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { Button, Card, CardContent, Input, Select, Badge, Switch } from "@/components/ui"
import { Dialog, FormField } from "@/components/Dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Pencil, Trash2, Search, Users, Building2, MapPin, ArrowRightLeft, ChevronDown, ChevronRight, X, GitMerge, CheckCircle2, Circle } from "lucide-react"

const TYPES = ["company", "person", "place", "other"]
const TYPE_LABELS = { company: "Empresa", person: "Pessoa", place: "Local", other: "Outro" }
const TYPE_ICONS = { company: Building2, person: Users, place: MapPin, other: ArrowRightLeft }
const TYPE_BADGE = { company: "default", person: "success", place: "warning", other: "secondary" }
const emptyForm = { legal_name: "", name: "", type: "company", document: "", bank: "", notes: "", display_name: "", exclude_from_reports: 0 }

const SORT_OPTS = [
  { val: "name", label: "Nome A→Z" },
  { val: "name_desc", label: "Nome Z→A" },
  { val: "total_spent", label: "Maior gasto" },
  { val: "total_received", label: "Maior recebido" },
  { val: "transaction_count", label: "Mais transações" },
  { val: "last_activity", label: "Atividade recente" },
]

export default function Vinculos() {
  const [entities, setEntities] = useState([])
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [editing, setEditing] = useState(null)
  const [merging, setMerging] = useState(null)     // entity being merged
  const [mergeTarget, setMergeTarget] = useState("") // target entity id
  const [mergeSearch, setMergeSearch] = useState("")
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [sortKey, setSortKey] = useState("total_spent")
  const [expanded, setExpanded] = useState(null)
  const [expandedTxns, setExpandedTxns] = useState([])

  const [searchParams, setSearchParams] = useSearchParams()
  const idParam = searchParams.get("id") ? parseInt(searchParams.get("id")) : null
  const clearIdFilter = () => setSearchParams(p => { p.delete("id"); return p })

  const load = () => fetch("/api/entities").then(r => r.ok ? r.json() : []).then(d => setEntities(Array.isArray(d) ? d : []))
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(emptyForm); setEditing(null); setOpen(true) }
  const openEdit = (e) => { setForm({ ...e, display_name: e.display_name || "" }); setEditing(e.id); setOpen(true) }

  const save = async (ev) => {
    ev.preventDefault()
    if (editing) {
      await fetch(`/api/entities/${editing}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    } else {
      await fetch("/api/entities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    }
    setOpen(false); load()
  }

  const remove = async (id) => {
    await fetch(`/api/entities/${id}`, { method: "DELETE" })
    setDeleting(null); load()
  }

  const doMerge = async () => {
    if (!mergeTarget) return
    await fetch(`/api/entities/${merging.id}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: parseInt(mergeTarget) }),
    })
    setMerging(null); setMergeTarget(""); setMergeSearch(""); load()
  }

  const toggleReconcileTxn = async (txn) => {
    setExpandedTxns(prev => prev.map(t => t.id === txn.id ? { ...t, conciliation_status: (t.conciliation_status || 0) ^ 1 } : t))
    await fetch(`/api/transactions/${txn.id}/reconcile`, { method: "PATCH" })
  }

  const toggleExpand = async (id) => {
    if (expanded === id) { setExpanded(null); setExpandedTxns([]); return }
    setExpanded(id)
    const txns = await fetch(`/api/entities/${id}/transactions`).then(r => r.json())
    setExpandedTxns(txns)
  }

  const visible = useMemo(() => {
    if (idParam) return entities.filter(e => e.id === idParam)
    let list = entities.filter(e => {
      if (filterType !== "all" && e.type !== filterType) return false
      if (search) {
        const s = search.toLowerCase()
        return e.name.toLowerCase().includes(s) || (e.document || "").includes(s) || (e.bank || "").toLowerCase().includes(s)
      }
      return true
    })
    const [key, dir] = sortKey.endsWith("_desc") ? [sortKey.replace("_desc", ""), -1] : [sortKey, 1]
    const realKey = key === "name_desc" ? "name" : key
    list = [...list].sort((a, b) => {
      let va = a[realKey] ?? 0, vb = b[realKey] ?? 0
      if (typeof va === "string") return dir * va.localeCompare(vb)
      return dir * (vb - va)
    })
    return list
  }, [entities, filterType, search, sortKey, idParam])

  const totalSpent = entities.reduce((s, e) => s + (e.total_spent || 0), 0)
  const totalReceived = entities.reduce((s, e) => s + (e.total_received || 0), 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {idParam && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-xl text-sm">
          <span className="font-mono text-primary font-bold">#{idParam}</span>
          <span className="text-foreground">Mostrando apenas este vínculo</span>
          <button className="ml-auto text-xs text-muted-foreground hover:text-foreground underline" onClick={clearIdFilter}>Limpar filtro</button>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vínculos</h1>
          <p className="text-muted-foreground text-sm mt-1">{visible.length} de {entities.length} entidades</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Novo Vínculo</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Entidades</p>
          <p className="text-2xl font-bold">{entities.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Gasto</p>
          <p className="text-2xl font-bold text-destructive">-{formatCurrency(totalSpent)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Recebido</p>
          <p className="text-2xl font-bold text-success">+{formatCurrency(totalReceived)}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card><CardContent className="pt-4 pb-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-44">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-7 text-sm h-8" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
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

      {/* Entity List */}
      <div className="space-y-2">
        {visible.map(entity => {
          const Icon = TYPE_ICONS[entity.type] || Building2
          const isExp = expanded === entity.id
          const net = (entity.total_received || 0) - (entity.total_spent || 0)
          const isMerged = !!entity.original_entity_id
          // Find the name of the parent entity for display
          const parentName = isMerged ? entities.find(e => e.id === entity.original_entity_id)?.name : null
          return (
            <Card key={entity.id} className={`overflow-hidden transition-all ${entity.id === idParam ? "ring-1 ring-primary/40" : ""} ${isMerged ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent/20 transition-colors" onClick={() => toggleExpand(entity.id)}>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums"># {entity.id}</span>
                    <span className="font-semibold">{entity.name}</span>
                    <Badge variant={TYPE_BADGE[entity.type]}>{TYPE_LABELS[entity.type]}</Badge>
                    {entity.bank && <Badge variant="secondary">{entity.bank}</Badge>}
                    {isMerged && (
                      <Badge variant="outline" className="text-muted-foreground text-[10px]">
                        Mesclado{parentName ? ` → ${parentName}` : ""}
                      </Badge>
                    )}
                  </div>
                  {entity.document && <p className="text-xs text-muted-foreground mt-0.5 truncate">{entity.document}</p>}
                </div>
                <div className="flex items-center gap-4 text-sm shrink-0">
                  {(entity.transaction_count || 0) > 0 && (
                    <div className="text-right hidden lg:block">
                      <p className="text-xs text-muted-foreground">Transações</p>
                      <p className="font-medium">{entity.transaction_count}</p>
                    </div>
                  )}
                  {(entity.total_spent || 0) > 0 && (
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-muted-foreground">Gasto</p>
                      <p className="font-semibold text-destructive">-{formatCurrency(entity.total_spent)}</p>
                    </div>
                  )}
                  {(entity.total_received || 0) > 0 && (
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-muted-foreground">Recebido</p>
                      <p className="font-semibold text-success">+{formatCurrency(entity.total_received)}</p>
                    </div>
                  )}
                  {net !== 0 && (
                    <div className={`text-right font-bold ${net >= 0 ? "text-success" : "text-destructive"}`}>
                      <p className="text-xs text-muted-foreground font-normal">Saldo</p>
                      <p>{net >= 0 ? "+" : ""}{formatCurrency(net)}</p>
                    </div>
                  )}
                  <div className="flex gap-1 ml-1">
                    <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); openEdit(entity) }}><Pencil size={13} /></Button>
                    <Button size="icon" variant="ghost" className="text-primary" title="Mesclar" onClick={e => { e.stopPropagation(); setMerging(entity); setMergeTarget(""); setMergeSearch("") }}><GitMerge size={13} /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={e => { e.stopPropagation(); setDeleting(entity) }}><Trash2 size={13} /></Button>
                    {isExp ? <ChevronDown size={15} className="text-muted-foreground" /> : <ChevronRight size={15} className="text-muted-foreground" />}
                  </div>
                </div>
              </div>
              {isExp && (
                <div className="border-t border-border/50 bg-background/50">
                  {entity.notes && <p className="px-4 pt-3 text-sm text-muted-foreground italic">{entity.notes}</p>}
                  <div className="overflow-x-auto p-4 pt-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {["Data", "Descrição", "Categoria", "Conta", "Valor", ""].map(h => (
                            <th key={h} className="text-left pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {expandedTxns.map(t => (
                          <tr key={t.id} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                            <td className="py-2 text-muted-foreground">{formatDate(t.date)}</td>
                            <td className="py-2 truncate max-w-xs">{t.description}</td>
                            <td className="py-2"><Badge variant="secondary">{t.category || "—"}</Badge></td>
                            <td className="py-2 text-muted-foreground text-xs">{t.account_name}</td>
                            <td className={`py-2 font-semibold ${t.type === "expense" ? "text-destructive" : "text-success"}`}>
                              {t.type === "expense" ? "-" : "+"}{formatCurrency(t.amount)}
                            </td>
                            <td className="py-2 text-right">
                              <Button size="icon" variant="ghost"
                                className={(t.conciliation_status & 1) === 1 ? "text-success" : "text-muted-foreground"}
                                title={(t.conciliation_status & 1) === 1 ? "Conciliada" : "Marcar conciliada"}
                                onClick={() => toggleReconcileTxn(t)}>
                                {(t.conciliation_status & 1) === 1 ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {expandedTxns.length === 0 && (
                          <tr><td colSpan={5} className="py-6 text-center text-muted-foreground text-xs">Nenhuma transação vinculada</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
        {visible.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            {entities.length === 0 ? "Nenhum vínculo encontrado. Importe um extrato para criar vínculos automaticamente." : "Nenhum resultado."}
          </div>
        )}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Editar Vínculo" : "Novo Vínculo"}>
        <form onSubmit={save} className="space-y-4">
          <FormField label="Nome">
            <Input required value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} placeholder="" />
          </FormField>
          <FormField label="Tipo">
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="CPF / CNPJ">
              <Input value={form.document} onChange={e => setForm(f => ({ ...f, document: e.target.value }))} placeholder="" />
            </FormField>
            <FormField label="Banco">
              <Input value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))} placeholder="" />
            </FormField>
          </div>
          <FormField label="Observações">
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="" />
          </FormField>
          <FormField label="Nome de Visualização (opcional)">
            <Input value={form.display_name || ""} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="" />
            <p className="text-xs text-muted-foreground mt-1">👁️ Apenas para exibição gráfica. Filtros e buscas continuam pelo nome real.
            </p>
          </FormField>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-accent/10">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Ignorar nas transações</p>
              <p className="text-xs text-muted-foreground">Oculta todos os valores deste vínculo nas buscas e relatórios.</p>
            </div>
            <Switch
              checked={form.exclude_from_reports === 1}
              onCheckedChange={checked => setForm(f => ({ ...f, exclude_from_reports: checked ? 1 : 0 }))}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editing ? "Salvar" : "Criar"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Dialog>

      {/* Merge Modal */}
      <Dialog open={!!merging} onClose={() => setMerging(null)} title={`Mesclar: ${merging?.name}`}>
        <p className="text-sm text-muted-foreground mb-4">
          Todas as transações de <strong>{merging?.name}</strong> serão movidas para a entidade selecionada.
          A entidade original será marcada como mesclada (não deletada).
        </p>
        <div className="relative mb-3">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-7 text-sm" placeholder="Buscar entidade destino..." value={mergeSearch} onChange={e => setMergeSearch(e.target.value)} />
        </div>
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border/50 mb-4">
          {entities
            .filter(e => e.id !== merging?.id && e.name.toLowerCase().includes(mergeSearch.toLowerCase()))
            .map(e => (
              <button key={e.id} onClick={() => setMergeTarget(String(e.id))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${mergeTarget === String(e.id) ? "bg-primary/10 text-primary" : "hover:bg-accent/50"
                  }`}>
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{e.name.slice(0, 1)}</span>
                </div>
                <span className="font-medium truncate">{e.name}</span>
                <Badge variant="secondary" className="ml-auto shrink-0">{TYPE_LABELS[e.type]}</Badge>
              </button>
            ))}
        </div>
        <div className="flex gap-3">
          <Button className="flex-1" disabled={!mergeTarget} onClick={doMerge}>
            <GitMerge size={14} /> Mesclar Entidades
          </Button>
          <Button variant="outline" onClick={() => setMerging(null)}>Cancelar</Button>
        </div>
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Excluir Vínculo">
        <p className="text-muted-foreground mb-4">Excluir <strong>{deleting?.name}</strong>? Transações vinculadas ficarão sem vínculo.</p>
        <div className="flex gap-3">
          <Button variant="destructive" className="flex-1" onClick={() => remove(deleting.id)}>Excluir</Button>
          <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
        </div>
      </Dialog>
    </div>
  )
}
