import { useState, useEffect, useMemo } from "react"
import { Link } from "react-router-dom"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge, Select } from "@/components/ui"
import { Dialog, FormField } from "@/components/Dialog"
import { Plus, Pencil, Trash2, Tag, FolderOpen, Hash, Search, ExternalLink, TrendingUp, TrendingDown, LayoutGrid, List } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#f59e0b", "#22c55e", "#10b981", "#06b6d4", "#3b82f6",
  "#a1a1aa", "#64748b"
]

const emptyCategory = { name: "", color: "#6366f1", icon: "tag" }

// ── Color picker ──────────────────────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {PRESET_COLORS.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${value === c ? "border-foreground scale-110" : "border-transparent"}`}
          style={{ background: c }}
        />
      ))}
      <div className="flex items-center gap-2 ml-1">
        <span className="text-xs text-muted-foreground">Personalizada:</span>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5" />
      </div>
    </div>
  )
}

// ── Category form dialog ──────────────────────────────────────────────────────
function CategoryDialog({ open, onClose, initial, onSave }) {
  const [form, setForm] = useState(initial || emptyCategory)
  // Reset when dialog opens with a different initial value
  useEffect(() => { setForm(initial || emptyCategory) }, [initial]) // eslint-disable-line

  const submit = (e) => { e.preventDefault(); onSave(form) }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Editar Categoria" : "Nova Categoria"}>
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Nome">
          <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Alimentação" />
        </FormField>
        <FormField label="Cor">
          <ColorPicker value={form.color || "#6366f1"} onChange={c => setForm(f => ({ ...f, color: c }))} />
        </FormField>
        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1">Salvar</Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CategoriasTags() {
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])
  const [tab, setTab] = useState("categories")
  const [catOpen, setCatOpen] = useState(false)
  const [catEdit, setCatEdit] = useState(null)
  const [catDel, setCatDel] = useState(null)
  const [tagInput, setTagInput] = useState("")
  const [tagEdit, setTagEdit] = useState(null)   // { id, name }
  const [tagEditVal, setTagEditVal] = useState("")
  const [tagDel, setTagDel] = useState(null)
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("name") // name, spent, received, net
  const [viewMode, setViewMode] = useState("grid") // grid | list

  const load = () => {
    fetch("/api/categories").then(r => r.ok ? r.json() : []).then(d => setCategories(Array.isArray(d) ? d : []))
    fetch("/api/tags").then(r => r.ok ? r.json() : []).then(d => setTags(Array.isArray(d) ? d : []))
  }
  useEffect(() => { load() }, [])

  // ── Categories ─────────────────────────────────────────────────────────────
  const saveCategory = async (form) => {
    if (catEdit) {
      await fetch(`/api/categories/${catEdit.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    } else {
      await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    }
    setCatOpen(false); setCatEdit(null); load()
  }

  const deleteCategory = async (id) => {
    await fetch(`/api/categories/${id}`, { method: "DELETE" }); setCatDel(null); load()
  }

  // ── Tags ───────────────────────────────────────────────────────────────────
  const createTag = async () => {
    const name = tagInput.trim().toLowerCase()
    if (!name) return
    await fetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
    setTagInput(""); load()
  }

  const saveTagEdit = async () => {
    if (!tagEdit) return
    await fetch(`/api/tags/${tagEdit.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: tagEditVal.trim().toLowerCase() }) })
    setTagEdit(null); load()
  }

  const deleteTag = async (id) => {
    await fetch(`/api/tags/${id}`, { method: "DELETE" }); setTagDel(null); load()
  }

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const q = search.toLowerCase()
  const filteredCats = useMemo(() => {
    const list = categories.filter(c => c.name.toLowerCase().includes(q))
    return [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name)
      if (sortBy === "spent") return (b.total_spent || 0) - (a.total_spent || 0)
      if (sortBy === "received") return (b.total_received || 0) - (a.total_received || 0)
      if (sortBy === "net") {
        const netA = (a.total_received || 0) - (a.total_spent || 0)
        const netB = (b.total_received || 0) - (b.total_spent || 0)
        return netB - netA
      }
      return 0
    })
  }, [categories, q, sortBy])

  const filteredTags = useMemo(() => {
    const list = tags.filter(t => t.name.toLowerCase().includes(q))
    return [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name)
      if (sortBy === "spent") return (b.total_spent || 0) - (a.total_spent || 0)
      if (sortBy === "received") return (b.total_received || 0) - (a.total_received || 0)
      if (sortBy === "net") {
        const netA = (a.total_received || 0) - (a.total_spent || 0)
        const netB = (b.total_received || 0) - (b.total_spent || 0)
        return netB - netA
      }
      return 0
    })
  }, [tags, q, sortBy])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Categorias &amp; Tags</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {categories.length} categorias · {tags.length} tags
          </p>
        </div>
        {tab === "categories" && (
          <Button onClick={() => { setCatEdit(null); setCatOpen(true) }}>
            <Plus size={16} /> Nova Categoria
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 w-fit bg-card border border-border rounded-xl p-1">
        {[['categories', 'Categorias', FolderOpen], ['tags', 'Tags', Tag]].map(([v, l, Icon]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === v ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
            {Icon && <Icon size={14} />}
            {l}
          </button>
        ))}
      </div>

      {/* Search & Sort */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tab === "categories" ? "Buscar categoria..." : "Buscar tag..."}
            className="pl-8" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Ordenar por:</span>
          <Select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-40">
            <option value="name">Nome (A-Z)</option>
            <option value="spent">Saídas (Maior)</option>
            <option value="received">Entradas (Maior)</option>
            <option value="net">Net (Melhor)</option>
          </Select>
          {/* View toggle */}
          <div className="flex gap-0.5 bg-card border border-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              title="Visualização em grade"
              className={`p-1.5 rounded transition-colors ${
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="Visualização em lista"
              className={`p-1.5 rounded transition-colors ${
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── CATEGORIES TAB ── */}
      {tab === "categories" && (
        viewMode === "list" ? (
          // ─── LIST / TABLE VIEW ───────────────────────────────────────────
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-accent/30">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-6"></th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Categoria</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Transações</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-success">Entradas</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-amber-400">Saídas</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-purple-400">Net</th>
                    <th className="px-4 py-2.5 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredCats.map(cat => {
                    const net = (cat.total_received || 0) - (cat.total_spent || 0)
                    return (
                      <tr key={cat.id} className="group hover:bg-accent/20 transition-colors">
                        <td className="pl-4 pr-2 py-2.5">
                          <span className="h-3.5 w-3.5 rounded-full inline-block" style={{ background: cat.color || "#6366f1" }} />
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-medium">{cat.name}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                          {cat.usage_count || 0}
                        </td>
                        <td className="px-4 py-2.5 text-right text-success font-semibold tabular-nums amount-value">
                          {formatCurrency(cat.total_received || 0)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-amber-400 font-semibold tabular-nums amount-value">
                          {formatCurrency(cat.total_spent || 0)}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold tabular-nums amount-value ${
                          net >= 0 ? "text-purple-500" : "text-red-500"
                        }`}>
                          {formatCurrency(net)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link to={`/transacoes?category=${encodeURIComponent(cat.name)}`}
                              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors" title="Ver transações">
                              <ExternalLink size={12} />
                            </Link>
                            <button onClick={() => { setCatEdit(cat); setCatOpen(true) }}
                              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => setCatDel(cat)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredCats.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-muted-foreground py-10 text-sm">Nenhuma categoria encontrada.</td></tr>
                  )}
                </tbody>
                {filteredCats.length > 0 && (() => {
                  const totRec = filteredCats.reduce((s, c) => s + (c.total_received || 0), 0)
                  const totSpt = filteredCats.reduce((s, c) => s + (c.total_spent || 0), 0)
                  return (
                    <tfoot>
                      <tr className="border-t-2 border-border bg-accent/20 font-bold">
                        <td colSpan={2} className="px-4 py-2.5 text-xs text-muted-foreground">Total ({filteredCats.length})</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums text-xs">
                          {filteredCats.reduce((s, c) => s + (c.usage_count || 0), 0)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-success tabular-nums text-xs amount-value">{formatCurrency(totRec)}</td>
                        <td className="px-4 py-2.5 text-right text-amber-400 tabular-nums text-xs amount-value">{formatCurrency(totSpt)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums text-xs amount-value ${
                          (totRec - totSpt) >= 0 ? "text-purple-500" : "text-red-500"
                        }`}>{formatCurrency(totRec - totSpt)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )
                })()}
              </table>
            </div>
          </Card>
        ) : (
          // ─── GRID VIEW (original) ─────────────────────────────────────
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredCats.map(cat => {
              const net = (cat.total_received || 0) - (cat.total_spent || 0)
              return (
                <Card key={cat.id} className="group relative hover:-translate-y-0.5 transition-transform duration-200"
                  style={{ borderTopWidth: 3, borderTopColor: cat.color || "#6366f1" }}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start gap-3">
                      {/* Color dot + name */}
                      <span className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center"
                        style={{ background: `${cat.color || "#6366f1"}22` }}>
                        <span className="h-3 w-3 rounded-full" style={{ background: cat.color || "#6366f1" }} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate">{cat.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cat.usage_count || 0} transações
                        </p>
                      </div>
                      <Link to={`/transacoes?category=${encodeURIComponent(cat.name)}`} 
                        className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
                        title="Ver transações">
                        <ExternalLink size={14} />
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="bg-accent/30 rounded-lg p-2">
                        <p className="text-[10px] uppercase text-muted-foreground font-medium flex items-center gap-1">
                          <TrendingUp size={10} className="text-success" /> Entradas
                        </p>
                        <p className="text-xs font-bold tabular-nums text-success mt-1 amount-value">
                          {formatCurrency(cat.total_received || 0)}
                        </p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-2">
                        <p className="text-[10px] uppercase text-muted-foreground font-medium flex items-center gap-1">
                          <TrendingDown size={10} className="text-amber-400" /> Saídas
                        </p>
                        <p className="text-xs font-bold tabular-nums text-amber-400 mt-1 amount-value">
                          {formatCurrency(cat.total_spent || 0)}
                        </p>
                      </div>
                    </div>

                    {/* Net row */}
                    <div className="mt-2 px-2 py-1.5 bg-accent/20 rounded-lg flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Net</span>
                      <span className={`text-xs font-black tabular-nums amount-value ${net >= 0 ? "text-purple-500" : "text-red-500"}`}>
                        {formatCurrency(net)}
                      </span>
                    </div>

                    <div className="flex gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="outline" className="flex-1 text-xs h-7"
                        onClick={() => { setCatEdit(cat); setCatOpen(true) }}>
                        <Pencil size={11} /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive h-7 px-2"
                        onClick={() => setCatDel(cat)}>
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            {/* Quick create card */}
            <button onClick={() => { setCatEdit(null); setCatOpen(true) }}
              className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[96px]">
              <Plus size={20} />
              <span className="text-xs font-medium">Nova categoria</span>
            </button>
            {filteredCats.length === 0 && search && (
              <p className="col-span-full text-sm text-muted-foreground text-center py-8">Nenhuma categoria encontrada.</p>
            )}
          </div>
        )
      )}

      {/* ── TAGS TAB ── */}
      {tab === "tags" && (
        <div className="space-y-4">
          {/* Create tag input */}
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Nova Tag</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createTag()}
                  placeholder="nome-da-tag" className="pl-7 lowercase" />
              </div>
              <Button onClick={createTag} disabled={!tagInput.trim()}><Plus size={14} /> Criar</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Tags são salvas em minúsculas. Pressione Enter para criar.</p>
          </CardContent></Card>

          {/* Tags list */}
          {viewMode === "list" ? (
            // ─── TABLE VIEW ──────────────────────────────────────────────
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-accent/30">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tag</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Transações</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Vínculos</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-success">Entradas</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-amber-400">Saídas</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-purple-400">Net</th>
                      <th className="px-4 py-2.5 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredTags.map(tag => {
                      const net = (tag.total_received || 0) - (tag.total_spent || 0)
                      return (
                        <tr key={tag.id} className="group hover:bg-accent/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Hash size={11} className="text-muted-foreground shrink-0" />
                              {tag.name}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{tag.txn_count || 0}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{tag.entity_count || 0}</td>
                          <td className="px-4 py-2.5 text-right text-success font-semibold tabular-nums amount-value">{formatCurrency(tag.total_received || 0)}</td>
                          <td className="px-4 py-2.5 text-right text-amber-400 font-semibold tabular-nums amount-value">{formatCurrency(tag.total_spent || 0)}</td>
                          <td className={`px-4 py-2.5 text-right font-bold tabular-nums amount-value ${net >= 0 ? "text-purple-500" : "text-red-500"}`}>{formatCurrency(net)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <Link to={`/transacoes?tag=${encodeURIComponent(tag.name)}`}
                                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors" title="Ver transações">
                                <ExternalLink size={12} />
                              </Link>
                              <button onClick={() => { setTagEdit(tag); setTagEditVal(tag.name) }}
                                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => setTagDel(tag)}
                                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredTags.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                        {search ? "Nenhuma tag encontrada." : "Nenhuma tag criada ainda."}
                      </td></tr>
                    )}
                  </tbody>
                  {filteredTags.length > 0 && (() => {
                    const totRec = filteredTags.reduce((s, t) => s + (t.total_received || 0), 0)
                    const totSpt = filteredTags.reduce((s, t) => s + (t.total_spent || 0), 0)
                    return (
                      <tfoot>
                        <tr className="border-t-2 border-border bg-accent/20 font-bold">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">Total ({filteredTags.length})</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums text-xs">{filteredTags.reduce((s, t) => s + (t.txn_count || 0), 0)}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums text-xs">{filteredTags.reduce((s, t) => s + (t.entity_count || 0), 0)}</td>
                          <td className="px-4 py-2.5 text-right text-success tabular-nums text-xs amount-value">{formatCurrency(totRec)}</td>
                          <td className="px-4 py-2.5 text-right text-amber-400 tabular-nums text-xs amount-value">{formatCurrency(totSpt)}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums text-xs amount-value ${
                            (totRec - totSpt) >= 0 ? "text-purple-500" : "text-red-500"
                          }`}>{formatCurrency(totRec - totSpt)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )
                  })()}
                </table>
              </div>
            </Card>
          ) : (
            // ─── CHIP / GRID VIEW (original) ───────────────────────────────────────
            <div className="flex flex-wrap gap-2">
              {filteredTags.map(tag => (
                tagEdit?.id === tag.id ? (
                  /* Inline edit */
                  <div key={tag.id} className="flex items-center gap-1 bg-card border border-primary rounded-full px-2 py-1">
                    <Hash size={11} className="text-primary shrink-0" />
                    <input value={tagEditVal} onChange={e => setTagEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveTagEdit(); if (e.key === "Escape") setTagEdit(null) }}
                      className="text-xs bg-transparent outline-none w-28 lowercase text-foreground"
                      autoFocus />
                    <button onClick={saveTagEdit} className="text-success text-xs font-bold ml-1">✓</button>
                    <button onClick={() => setTagEdit(null)} className="text-muted-foreground text-xs ml-0.5">✕</button>
                  </div>
                ) : (
                  <div key={tag.id}
                    className="group flex items-center gap-1.5 bg-card border border-border rounded-full pl-3 pr-2 py-1.5 hover:border-primary transition-colors">
                    <Hash size={11} className="text-muted-foreground" />
                    <span className="text-sm font-medium">{tag.name}</span>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-accent/30 px-2 py-0.5 rounded-full ml-1 font-bold">
                      <span className="text-success amount-value" title="Entradas">{formatCurrency(tag.total_received || 0)}</span>
                      <span className="text-amber-400 amount-value" title="Saídas">{formatCurrency(tag.total_spent || 0)}</span>
                      <span className={`border-l border-border/50 pl-1.5 ml-0.5 amount-value ${(tag.total_received - tag.total_spent) >= 0 ? "text-purple-500" : "text-red-500"}`} title="Net">
                        {formatCurrency(tag.total_received - tag.total_spent)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-0.5 border-l border-border pl-1.5 ml-0.5">
                      <Link to={`/transacoes?tag=${encodeURIComponent(tag.name)}`}
                        className="p-1 hover:text-primary transition-colors" title="Ver transações">
                        <ExternalLink size={10} />
                      </Link>
                      <button onClick={() => { setTagEdit(tag); setTagEditVal(tag.name) }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity">
                        <Pencil size={10} />
                      </button>
                      <button onClick={() => setTagDel(tag)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-destructive hover:text-destructive/80 transition-opacity">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                )
              ))}
              {filteredTags.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">
                  {search ? "Nenhuma tag encontrada." : "Nenhuma tag criada ainda."}
                </p>
              )}
            </div>
          )}

          {/* Tag stats quick view (only in grid mode) */}
          {viewMode === "grid" && tags.length > 0 && (
            <Card><CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Mais usadas</CardTitle>
            </CardHeader><CardContent>
                <div className="space-y-1">
                  {[...tags].sort((a, b) => (b.txn_count + b.entity_count) - (a.txn_count + a.entity_count)).slice(0, 8).map(tag => (
                    <div key={tag.id} className="flex items-center gap-2">
                      <Hash size={11} className="text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1">{tag.name}</span>
                      <div className="flex gap-4 text-xs">
                        <span className="text-muted-foreground">{tag.txn_count} transações</span>
                        <div className="flex gap-2 font-black">
                          <span className="text-success">{formatCurrency(tag.total_received || 0)}</span>
                          <span className="text-amber-400">{formatCurrency(tag.total_spent || 0)}</span>
                          <span className={`${(tag.total_received - tag.total_spent) >= 0 ? "text-purple-500" : "text-red-500"}`}>
                            ({formatCurrency(tag.total_received - tag.total_spent)})
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
          )}
        </div>
      )}

      {/* ── Dialogs ── */}
      <CategoryDialog
        open={catOpen}
        onClose={() => { setCatOpen(false); setCatEdit(null) }}
        initial={catEdit}
        onSave={saveCategory}
      />

      <Dialog open={!!catDel} onClose={() => setCatDel(null)} title="Excluir Categoria">
        <p className="text-muted-foreground mb-1">Excluir <strong>{catDel?.name}</strong>?</p>
        {catDel?.usage_count > 0 && (
          <p className="text-xs text-amber-400 mb-3">⚠️ Esta categoria está em uso em {catDel.usage_count} transações. As transações não serão afetadas.</p>
        )}
        <div className="flex gap-3 mt-4">
          <Button variant="destructive" className="flex-1" onClick={() => deleteCategory(catDel.id)}>Excluir</Button>
          <Button variant="outline" onClick={() => setCatDel(null)}>Cancelar</Button>
        </div>
      </Dialog>

      <Dialog open={!!tagDel} onClose={() => setTagDel(null)} title="Excluir Tag">
        <p className="text-muted-foreground mb-1">Excluir tag <strong>#{tagDel?.name}</strong>?</p>
        {(tagDel?.txn_count > 0 || tagDel?.entity_count > 0) && (
          <p className="text-xs text-amber-400 mb-3">⚠️ Esta tag está associada a {tagDel.txn_count} transações e {tagDel.entity_count} vínculo(s).</p>
        )}
        <div className="flex gap-3 mt-4">
          <Button variant="destructive" className="flex-1" onClick={() => deleteTag(tagDel.id)}>Excluir</Button>
          <Button variant="outline" onClick={() => setTagDel(null)}>Cancelar</Button>
        </div>
      </Dialog>
    </div>
  )
}
