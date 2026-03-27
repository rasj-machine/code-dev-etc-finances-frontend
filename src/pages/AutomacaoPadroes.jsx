import { useEffect, useState, useMemo, useCallback } from "react"
import { Button, Card, CardContent, Input, Select, Badge, Combobox } from "@/components/ui"
import { Dialog, FormField } from "@/components/Dialog"
import { useNotification } from "@/context/NotificationContext"
import {
  Zap, Plus, Pencil, Trash2, Search, Play, PlayCircle, Power, PowerOff,
  ChevronDown, ChevronUp, X, Tag, Eye, AlertTriangle, ShieldAlert,
  CheckCircle2, Circle, Filter, Hash, AlignLeft, ToggleLeft, ToggleRight,
  RefreshCw, ArrowUpDown, EyeOff, Cpu, Info
} from "lucide-react"

const MATCH_TYPES = [
  { value: "contains", label: "Contém" },
  { value: "exact", label: "Exato" },
  { value: "starts_with", label: "Começa com" },
  { value: "ends_with", label: "Termina com" },
  { value: "regex", label: "Regex" },
]

const FLAGS = [
  { bit: 1, label: "Ocultar", icon: EyeOff, color: "text-muted-foreground" },
  { bit: 2, label: "Risco", icon: AlertTriangle, color: "text-amber-500" },
  { bit: 4, label: "Fraude", icon: ShieldAlert, color: "text-destructive" },
]

const TRIGGER_MODES = [
  { value: "all", label: "Manual e Automático" },
  { value: "manual", label: "Somente Manual" },
  { value: "auto", label: "Somente Automático (CSV)" },
]

const emptyRule = {
  name: "",
  match_text: "",
  match_type: "contains",
  priority: 100,
  active: 1,
  trigger_mode: "all",
  apply_category: "",
  apply_tags: [],
  apply_entity_id: "",
  apply_flags: 0,
  apply_type: "",
  apply_notes: "",
  apply_account_ids: [],
  apply_source_account_id: "",
  apply_destination_account_id: "",
}

function RuleBadge({ rule }) {
  const matchIcon = {
    contains: "⊃", exact: "=", starts_with: "^", ends_with: "$", regex: ".*"
  }[rule.match_type] || "?"
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-accent/60 px-2 py-0.5 rounded-full text-muted-foreground">
      {matchIcon} {rule.match_text}
    </span>
  )
}

export default function AutomacaoPadroes() {
  const { alert } = useNotification()

  // Data
  const [rules, setRules] = useState([])
  const [patterns, setPatterns] = useState([])
  const [categories, setCategories] = useState([])
  const [entities, setEntities] = useState([])
  const [allTags, setAllTags] = useState([])
  const [accounts, setAccounts] = useState([])

  // UI state
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all") // all, with, without
  const [sortBy, setSortBy] = useState("count") // count, description
  const [sortDir, setSortDir] = useState("desc")
  const [open, setOpen] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [form, setForm] = useState(emptyRule)
  const [tagInput, setTagInput] = useState("")
  const [dryRunResult, setDryRunResult] = useState(null) // { rule_id, affected, transactions }
  const [dryRunLoading, setDryRunLoading] = useState(null)
  const [applyingRule, setApplyingRule] = useState(null)
  const [expandedPattern, setExpandedPattern] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rulesR, patternsR, catsR, entR, tagsR, accsR] = await Promise.all([
        fetch("/api/automation/rules").then(r => r.json()),
        fetch("/api/automation/patterns").then(r => r.json()),
        fetch("/api/categories").then(r => r.json()),
        fetch("/api/entities").then(r => r.json()),
        fetch("/api/tags").then(r => r.json()),
        fetch("/api/accounts").then(r => r.json()),
      ])
      setRules(Array.isArray(rulesR) ? rulesR : [])
      setPatterns(Array.isArray(patternsR) ? patternsR : [])
      setCategories(Array.isArray(catsR) ? catsR.map(c => c.name) : [])
      setEntities(Array.isArray(entR) ? entR : [])
      setAllTags(Array.isArray(tagsR) ? tagsR : [])
      setAccounts(Array.isArray(accsR) ? accsR : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Build enriched pattern list: add matched rules info
  const enrichedPatterns = useMemo(() => {
    return patterns.map(p => {
      const matched = rules.filter(r => {
        const desc = p.description.toLowerCase()
        const text = r.match_text.toLowerCase()
        switch (r.match_type) {
          case "exact": return desc === text
          case "starts_with": return desc.startsWith(text)
          case "ends_with": return desc.endsWith(text)
          case "contains": return desc.includes(text)
          case "regex": try { return new RegExp(r.match_text, "i").test(p.description) } catch { return false }
          default: return false
        }
      })
      return { ...p, matched_rules: matched }
    })
  }, [patterns, rules])

  const filtered = useMemo(() => {
    let list = enrichedPatterns.filter(p => {
      if (filterStatus === "with" && p.matched_rules.length === 0) return false
      if (filterStatus === "without" && p.matched_rules.length > 0) return false
      if (search && !p.description.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    list = [...list].sort((a, b) => {
      let va = sortBy === "count" ? a.count : a.description
      let vb = sortBy === "count" ? b.count : b.description
      if (typeof va === "string") va = va.toLowerCase(), vb = vb.toLowerCase()
      return sortDir === "desc" ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1)
    })
    return list
  }, [enrichedPatterns, filterStatus, search, sortBy, sortDir])

  const patternsWithout = patterns.filter(p => {
    return !rules.some(r => {
      const desc = p.description.toLowerCase()
      const text = r.match_text.toLowerCase()
      switch (r.match_type) {
        case "exact": return desc === text
        case "starts_with": return desc.startsWith(text)
        case "ends_with": return desc.endsWith(text)
        case "contains": return desc.includes(text)
        case "regex": try { return new RegExp(r.match_text, "i").test(p.description) } catch { return false }
        default: return false
      }
    })
  })

  const openCreate = (prefill = "") => {
    setForm({ ...emptyRule, match_text: prefill })
    setEditingRule(null)
    setTagInput("")
    setOpen(true)
  }

  const openEdit = (rule) => {
    const accIds = rule.apply_account_ids
      ? rule.apply_account_ids.split(',').filter(Boolean).map(Number)
      : []
    setForm({
      ...rule,
      apply_tags: Array.isArray(rule.apply_tags) ? rule.apply_tags : (rule.apply_tags ? rule.apply_tags.split(",").filter(Boolean) : []),
      apply_entity_id: rule.apply_entity_id || "",
      apply_type: rule.apply_type || "",
      apply_notes: rule.apply_notes || "",
      active: rule.active ?? 1,
      trigger_mode: rule.trigger_mode || "all",
      apply_account_ids: accIds,
      apply_source_account_id: rule.apply_source_account_id || "",
      apply_destination_account_id: rule.apply_destination_account_id || "",
    })
    setEditingRule(rule.id)
    setTagInput("")
    setOpen(true)
  }

  const addTag = (name) => {
    const n = name.trim().toLowerCase()
    if (n && !form.apply_tags.includes(n)) setForm(f => ({ ...f, apply_tags: [...f.apply_tags, n] }))
    setTagInput("")
  }
  const removeTag = (name) => setForm(f => ({ ...f, apply_tags: f.apply_tags.filter(t => t !== name) }))
  const toggleFlag = (bit) => setForm(f => ({ ...f, apply_flags: (f.apply_flags || 0) ^ bit }))

  const save = async (e) => {
    e.preventDefault()
    const body = {
      ...form,
      priority: parseInt(form.priority) || 100,
      apply_flags: form.apply_flags || 0,
      apply_tags: form.apply_tags,
      apply_account_ids: form.apply_account_ids || [],
      apply_source_account_id: form.apply_source_account_id || null,
      apply_destination_account_id: form.apply_destination_account_id || null,
    }
    if (editingRule) {
      await fetch(`/api/automation/rules/${editingRule}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
    } else {
      await fetch("/api/automation/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
    }
    setOpen(false)
    await load()
    alert("success", editingRule ? "Regra atualizada!" : "Regra criada!")
  }

  const deleteRule = async (id) => {
    if (!confirm("Excluir esta regra de automação?")) return
    await fetch(`/api/automation/rules/${id}`, { method: "DELETE" })
    await load()
    alert("success", "Regra excluída.")
  }

  const toggleActive = async (rule) => {
    await fetch(`/api/automation/rules/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rule, active: rule.active ? 0 : 1, apply_tags: Array.isArray(rule.apply_tags) ? rule.apply_tags : (rule.apply_tags || "").split(",").filter(Boolean) })
    })
    await load()
  }

  const dryRun = async (ruleId) => {
    setDryRunLoading(ruleId)
    setDryRunResult(null)
    try {
      const res = await fetch(`/api/automation/rules/${ruleId}/dryrun`)
      const data = await res.json()
      setDryRunResult({ rule_id: ruleId, ...data })
    } finally {
      setDryRunLoading(null)
    }
  }

  const applyRule = async (ruleId) => {
    setApplyingRule(ruleId)
    try {
      const res = await fetch(`/api/automation/rules/${ruleId}/apply`, { method: "POST" })
      const data = await res.json()
      alert("success", `Automação aplicada: ${data.updated} transações afetadas.`)
      await load()
      setDryRunResult(null)
    } finally {
      setApplyingRule(null)
    }
  }

  const applyAll = async () => {
    const activeRules = rules.filter(r => r.active)
    if (!activeRules.length) { alert("info", "Nenhuma regra ativa para aplicar."); return }
    if (!confirm(`Aplicar ${activeRules.length} regras ativas a todas as transações?`)) return
    const res = await fetch("/api/automation/apply-all", { method: "POST" })
    const data = await res.json()
    alert("success", `${data.updated} transações atualizadas no total.`)
    await load()
  }

  const onSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortBy(col); setSortDir("desc") }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu size={22} className="text-primary" /> Automação de Padrões</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {patternsWithout.length} padrões sem automação · {rules.length} regras cadastradas · {rules.filter(r => r.active).length} ativas
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={applyAll}>
            <PlayCircle size={16} /> Aplicar Todas Ativas
          </Button>
          <Button onClick={() => openCreate()}>
            <Plus size={16} /> Nova Regra
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Padrões Únicos", val: patterns.length, icon: Hash, color: "text-primary" },
          { label: "Sem Automação", val: patternsWithout.length, icon: AlertTriangle, color: "text-amber-500" },
          { label: "Regras Ativas", val: rules.filter(r => r.active).length, icon: Zap, color: "text-emerald-500" },
          { label: "Total Afetadas", val: rules.reduce((s, r) => s + (r.affected_count || 0), 0), icon: CheckCircle2, color: "text-primary" },
        ].map(s => (
          <Card key={s.label} className="border-none bg-accent/30 shadow-none">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-accent/60 ${s.color}`}>
                <s.icon size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</p>
                <p className="text-xl font-bold tabular-nums">{s.val.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rules Section */}
      {rules.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Zap size={14} className="text-primary" /> Regras Cadastradas
              <span className="text-xs text-muted-foreground font-normal">ordenadas por prioridade</span>
            </h2>
            <div className="space-y-2">
              {[...rules].sort((a, b) => a.priority - b.priority).map(rule => (
                <div key={rule.id} className={`rounded-xl border p-3 transition-all ${rule.active ? "border-border bg-card" : "border-border/40 bg-muted/20 opacity-60"}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Priority badge */}
                    <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                      #{rule.priority}
                    </span>

                    {/* Name + match */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{rule.name}</span>
                        <RuleBadge rule={rule} />
                        {rule.apply_category && (
                          <Badge variant="secondary">{rule.apply_category}</Badge>
                        )}
                        {rule.apply_type && (
                          <Badge variant="outline" className="text-[10px]">{rule.apply_type}</Badge>
                        )}
                        {rule.apply_account_ids && (
                          <span className="text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1.5 py-0.5 rounded-full">🏦 contas filtradas</span>
                        )}
                        {(rule.apply_tags_list || []).map(t => (
                          <span key={t} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">#{t}</span>
                        ))}
                        {rule.apply_flags > 0 && FLAGS.filter(f => (rule.apply_flags & f.bit) === f.bit).map(f => (
                          <span key={f.bit} className={`text-[10px] ${f.color}`}><f.icon size={11} className="inline" /> {f.label}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span>{TRIGGER_MODES.find(m => m.value === rule.trigger_mode)?.label || "Manual e Automático"}</span>
                        {rule.affected_count > 0 && (
                          <span className="text-emerald-600 font-semibold">{rule.affected_count} transações aplicadas</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm" variant="ghost"
                        className="text-xs h-7 gap-1"
                        disabled={dryRunLoading === rule.id}
                        onClick={() => dryRun(rule.id)}
                        title="Simular (dry run)"
                      >
                        {dryRunLoading === rule.id ? <RefreshCw size={12} className="animate-spin" /> : <Eye size={12} />}
                        Simular
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="text-xs h-7 gap-1 text-emerald-600"
                        disabled={applyingRule === rule.id}
                        onClick={() => applyRule(rule.id)}
                        title="Aplicar esta regra agora"
                      >
                        {applyingRule === rule.id ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                        Aplicar
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className={`h-7 w-7 ${rule.active ? "text-emerald-600" : "text-muted-foreground"}`}
                        onClick={() => toggleActive(rule)}
                        title={rule.active ? "Desativar" : "Ativar"}
                      >
                        {rule.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(rule)}>
                        <Pencil size={12} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteRule(rule.id)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>

                  {/* Dry run result inline */}
                  {dryRunResult?.rule_id === rule.id && (
                    <div className="mt-3 p-3 bg-accent/40 rounded-lg border border-border/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye size={13} className="text-primary" />
                          <span className="text-xs font-semibold">
                            Dry Run — {dryRunResult.affected} transações seriam afetadas
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-6 text-xs gap-1" onClick={() => applyRule(rule.id)}>
                            <Play size={10} /> Aplicar
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setDryRunResult(null)}>
                            <X size={10} />
                          </Button>
                        </div>
                      </div>
                      {dryRunResult.transactions?.length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {dryRunResult.transactions.slice(0, 10).map(t => (
                            <div key={t.id} className="text-[10px] flex gap-2 text-muted-foreground font-mono">
                              <span className="text-primary/60">#{t.id}</span>
                              <span>{t.date}</span>
                              <span className="flex-1 truncate">{t.description}</span>
                            </div>
                          ))}
                          {dryRunResult.affected > 10 && (
                            <p className="text-[10px] text-muted-foreground">...e mais {dryRunResult.affected - 10}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Patterns Table */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlignLeft size={14} className="text-primary" /> Padrões de Transações
            </h2>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-7 h-8 text-sm w-56" placeholder="Buscar padrão..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-8 text-sm">
                <option value="all">Todos</option>
                <option value="without">Sem automação ⚠️</option>
                <option value="with">Com automação ✓</option>
              </Select>
            </div>
          </div>

          {/* Table header */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    { col: "description", label: "Descrição" },
                    { col: "count", label: "Ocorrências" },
                  ].map(({ col, label }) => (
                    <th key={col} className="text-left pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <button className="flex items-center gap-0.5 hover:text-primary transition-colors" onClick={() => onSort(col)}>
                        {label}
                        {sortBy === col ? (sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className="opacity-25" />}
                      </button>
                    </th>
                  ))}
                  <th className="text-left pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Automações</th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="py-12 text-center text-muted-foreground text-sm">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2" />Carregando padrões...
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={4} className="py-12 text-center text-muted-foreground text-sm">
                    Nenhum padrão encontrado.
                  </td></tr>
                ) : filtered.map(p => (
                  <>
                    <tr
                      key={p.description}
                      className={`border-b border-border/40 hover:bg-accent/20 transition-colors cursor-pointer group ${p.matched_rules.length === 0 ? "bg-amber-500/5" : ""}`}
                      onClick={() => setExpandedPattern(expandedPattern === p.description ? null : p.description)}
                    >
                      <td className="py-3 pr-4 pl-2">
                        <div className="flex items-center gap-2">
                          {p.matched_rules.length === 0 ? (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Sem automação" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Com automação" />
                          )}
                          <span className="font-mono text-xs text-foreground/90 leading-relaxed">{p.description}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-semibold tabular-nums text-sm">{p.count}</span>
                        <span className="text-muted-foreground text-xs ml-1">transações</span>
                      </td>
                      <td className="py-3 pr-4">
                        {p.matched_rules.length === 0 ? (
                          <span className="text-amber-500 text-xs flex items-center gap-1">
                            <AlertTriangle size={11} /> Sem automação
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {p.matched_rules.map(r => (
                              <span key={r.id} className={`text-[10px] px-2 py-0.5 rounded-full border ${r.active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-border bg-muted/30 text-muted-foreground line-through"}`}>
                                {r.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right pr-2">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm" variant="outline" className="h-7 text-xs gap-1"
                            onClick={e => { e.stopPropagation(); openCreate(p.description) }}
                          >
                            <Plus size={11} /> Nova Regra
                          </Button>
                          {expandedPattern === p.description
                            ? <ChevronUp size={14} className="text-muted-foreground self-center" />
                            : <ChevronDown size={14} className="text-muted-foreground self-center" />
                          }
                        </div>
                      </td>
                    </tr>

                    {/* Expanded: transaction sample */}
                    {expandedPattern === p.description && (
                      <tr key={`${p.description}-detail`} className="border-b border-border/20">
                        <td colSpan={4} className="pb-3 pt-0 px-4">
                          <div className="bg-accent/30 rounded-lg p-3 space-y-2 ml-4">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Transações recentes com este padrão ({p.count} total)
                            </p>
                            {(p.samples || []).map(s => (
                              <div key={s.id} className="flex gap-3 text-xs font-mono text-muted-foreground">
                                <span className="text-primary/60">#{s.id} ({s.account_name})</span>
                                <span>{s.date} ({s.type})</span>
                                <span className="font-semibold text-foreground">{s.category || "—"}</span>
                                <span className={s.type === "expense" ? "text-destructive" : "text-emerald-500"}>
                                  {s.type === "expense" ? "-" : "+"}{(s.amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                  ({s.raw_amount})
                                </span>
                              </div>
                            ))}
                            {p.matched_rules.length > 0 && (
                              <div className="pt-2 border-t border-border/30">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Regras ativas:</p>
                                <div className="flex gap-2 flex-wrap">
                                  {p.matched_rules.map(r => (
                                    <button key={r.id} onClick={() => openEdit(r)} className="text-[10px] flex items-center gap-1 px-2 py-1 rounded border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
                                      <Pencil size={9} /> {r.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground mt-3 text-right">
            {filtered.length} de {patterns.length} padrões |
            <span className="text-amber-500 ml-1">{filtered.filter(p => p.matched_rules.length === 0).length} sem automação</span>
          </p>
        </CardContent>
      </Card>

      {/* Create / Edit Rule Modal */}
      <Dialog open={open} onClose={() => setOpen(false)} title={editingRule ? "Editar Regra de Automação" : "Nova Regra de Automação"}>
        <form onSubmit={save} className="space-y-4">
          <FormField label="Nome da Regra">
            <Input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Nubank Cashback, Aluguel mensal..."
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo de Correspondência">
              <Select value={form.match_type} onChange={e => setForm(f => ({ ...f, match_type: e.target.value }))}>
                {MATCH_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Prioridade (menor = primeiro)">
              <Input
                type="number" min={1} max={9999}
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              />
            </FormField>
          </div>

          <FormField label={`Texto de Identificação (${MATCH_TYPES.find(m => m.value === form.match_type)?.label})`}>
            <Input
              required
              value={form.match_text}
              onChange={e => setForm(f => ({ ...f, match_text: e.target.value }))}
              placeholder="Texto a identificar na descrição da transação..."
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {form.match_type === "contains" && "Ex: 'NUBANK' → identifica qualquer descrição que contenha esta palavra"}
              {form.match_type === "exact" && "Texto deve ser idêntico à descrição completa"}
              {form.match_type === "starts_with" && "Descrição deve começar com este texto"}
              {form.match_type === "ends_with" && "Descrição deve terminar com este texto"}
              {form.match_type === "regex" && "Padrão regex JavaScript (case-insensitive)"}
            </p>
          </FormField>

          <div className="border-t border-border/40 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Zap size={12} /> Ações ao Identificar
            </p>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Aplicar Categoria">
                <Combobox
                  value={form.apply_category}
                  onChange={val => setForm(f => ({ ...f, apply_category: val }))}
                  options={[{ label: "— Manter atual —", value: "" }, ...categories.map(c => ({ label: c, value: c }))]}
                  placeholder="Selecionar categoria..."
                />
              </FormField>

              <FormField label="Aplicar Tipo">
                <Select value={form.apply_type} onChange={e => setForm(f => ({ ...f, apply_type: e.target.value }))}>
                  <option value="">— Manter atual —</option>
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                  <option value="credit">Crédito</option>
                  <option value="transfer_out">Transferência Enviada</option>
                  <option value="transfer_in">Transferência Recebida</option>
                </Select>
              </FormField>
            </div>

            <FormField label="Aplicar Vínculo (Entidade)">
              <Combobox
                value={form.apply_entity_id}
                onChange={val => setForm(f => ({ ...f, apply_entity_id: val }))}
                options={[{ label: "— Manter atual —", value: "" }, ...entities.map(en => ({ label: en.name, value: en.id }))]}
                placeholder="Selecionar entidade..."
              />
            </FormField>

            <FormField label="Observação a aplicar">
              <Input
                value={form.apply_notes}
                onChange={e => setForm(f => ({ ...f, apply_notes: e.target.value }))}
                placeholder="Observação que será adicionada à transação (opcional)"
              />
            </FormField>

            <FormField label="Tags a aplicar">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    placeholder="Adicionar tag..."
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput) } }}
                    className="flex-1 text-sm h-8"
                    list="atag-suggestions"
                  />
                  <datalist id="atag-suggestions">
                    {allTags.map(t => <option key={t.id} value={t.name} />)}
                  </datalist>
                  <Button type="button" size="sm" variant="outline" onClick={() => addTag(tagInput)}>
                    <Tag size={13} />
                  </Button>
                </div>
                {form.apply_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.apply_tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                        #{tag}
                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive"><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </FormField>

            <FormField label="Flags a aplicar">
              <div className="flex gap-2 flex-wrap">
                {FLAGS.map(f => {
                  const active = ((form.apply_flags || 0) & f.bit) === f.bit
                  return (
                    <button key={f.bit} type="button" onClick={() => toggleFlag(f.bit)}
                      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                      <f.icon size={12} className={active ? "" : f.color} />
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </FormField>

            {/* Account filter */}
            <div className="border border-blue-500/20 bg-blue-500/5 rounded-xl p-3 space-y-3">
              <p className="text-xs font-semibold text-blue-500 flex items-center gap-1.5">🏦 Filtrar por Conta (opcional)</p>
              <FormField label="Aplicar somente nas contas" help="Se vazio, aplica em todas">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(form.apply_account_ids || []).map(id => {
                    const acc = accounts.find(a => a.id === id)
                    return acc ? (
                      <span key={id} className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full">
                        {acc.name}
                        <button type="button" onClick={() => setForm(f => ({ ...f, apply_account_ids: f.apply_account_ids.filter(x => x !== id) }))} className="hover:text-destructive"><X size={10} /></button>
                      </span>
                    ) : null
                  })}
                </div>
                <Select
                  value=""
                  onChange={e => {
                    const id = Number(e.target.value)
                    if (id && !(form.apply_account_ids || []).includes(id))
                      setForm(f => ({ ...f, apply_account_ids: [...(f.apply_account_ids || []), id] }))
                  }}
                >
                  <option value="">+ Adicionar conta...</option>
                  {accounts.filter(a => !(form.apply_account_ids || []).includes(a.id)).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </FormField>

              {/* Source / Destination for transfers */}
              {(form.apply_type === 'transfer_out' || form.apply_type === 'transfer_in') && (
                <div className="grid grid-cols-2 gap-3 border-t border-blue-500/10 pt-3">
                  <FormField label={form.apply_type === 'transfer_out' ? 'Conta Origem' : 'Conta Destino'}>
                    <Select value={form.apply_source_account_id} onChange={e => setForm(f => ({ ...f, apply_source_account_id: e.target.value }))}>
                      <option value="">— Manter atual —</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                  </FormField>
                  <FormField label={form.apply_type === 'transfer_out' ? 'Conta Destino' : 'Conta Origem'}>
                    <Select value={form.apply_destination_account_id} onChange={e => setForm(f => ({ ...f, apply_destination_account_id: e.target.value }))}>
                      <option value="">— Manter atual —</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                  </FormField>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border/40 pt-4 grid grid-cols-2 gap-3">
            <FormField label="Modo de Disparo">
              <Select value={form.trigger_mode} onChange={e => setForm(f => ({ ...f, trigger_mode: e.target.value }))}>
                {TRIGGER_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Status">
              <div className="flex items-center gap-3 h-10">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, active: f.active ? 0 : 1 }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${form.active ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600" : "border-border text-muted-foreground"}`}
                >
                  {form.active ? <><ToggleRight size={16} /> Ativa</> : <><ToggleLeft size={16} /> Inativa</>}
                </button>
              </div>
            </FormField>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editingRule ? "Salvar Alterações" : "Criar Regra"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
