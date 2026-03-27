import { useCallback, useEffect, useState, useRef, useMemo, Fragment } from "react"
import { useSearchParams } from "react-router-dom"
import { Button, Card, CardContent, Input, Select, Badge, Combobox, DateRangePicker, MoneyInput } from "@/components/ui"
import { Dialog, FormField } from "@/components/Dialog"
import { useNotification } from "@/context/NotificationContext"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Pencil, Trash2, Search, Upload, ChevronUp, ChevronDown, X, CheckCircle2, Circle, Eye, EyeOff, AlertTriangle, ShieldAlert, Tag, ArrowLeftRight, Calendar, Filter, Hash, FileCheck, ChevronRight, HelpCircle, Download, FileText, LayoutList, Lock, LockOpen, RefreshCw, FilterIcon, ArrowRight } from "lucide-react"

const DEFAULT_CATS = ["Alimentação", "Transporte", "Moradia", "Saúde", "Educação", "Lazer", "Assinaturas", "Salário", "Investimento", "Consórcios", "Saque", "Boleto", "Pix Recebido", "Pix Enviado", "Fatura Cartão", "Outros"]
// Flags: bit 1=Ocultar, bit 2=Risco, bit 4=Fraude
const FLAGS = [
  { bit: 1, label: "Ocultar", icon: EyeOff, color: "text-muted-foreground" },
  { bit: 2, label: "Risco", icon: AlertTriangle, color: "text-amber-500" },
  { bit: 4, label: "Fraude", icon: ShieldAlert, color: "text-destructive" },
]
const emptyForm = { account_id: "", destination_account_id: "", date: new Date().toISOString().slice(0, 10), description: "", category: "Outros", amount: "", raw_amount: "", type: "expense", notes: "", flags: 0, tags: [], recurring_id: "", entity_id: "", transaction_ref_id: "" }

function getNextInvoiceDate(dateStr, day) {
  if (!dateStr) return ""
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    let resY = y, resM = m
    if (d >= day) {
      resM++
      if (resM > 12) { resM = 1; resY++ }
    }
    return `${resY}-${String(resM).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  } catch { return "" }
}

export default function Transacoes() {
  const { alert } = useNotification()
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [profiles, setProfiles] = useState([])
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef()

  const [searchParams, setSearchParams] = useSearchParams()
  const idParam = searchParams.get("id") ? parseInt(searchParams.get("id")) : null
  const clearIdFilter = () => setSearchParams(p => { p.delete("id"); return p })

  // Filters
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterCat, setFilterCat] = useState(searchParams.get("category") || "")
  const [filterAcc, setFilterAcc] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sort, setSort] = useState({ col: "date", dir: "desc" })
  const [filterCon, setFilterCon] = useState("all")
  const [filterEntity, setFilterEntity] = useState("") // ""=all, "none"=without entity, ID=specific
  const [filterFlag, setFilterFlag] = useState(0)   // bit mask, 0=no filter
  const [filterTag, setFilterTag] = useState(searchParams.get("tag") || "")  // tag name
  const [filterAmtMin, setFilterAmtMin] = useState("")
  const [filterAmtMax, setFilterAmtMax] = useState("")
  const [filterDestAcc, setFilterDestAcc] = useState("")
  const [allTags, setAllTags] = useState([])
  const [recurring, setRecurring] = useState([])
  const [tagInput, setTagInput] = useState("")
  const [categories, setCategories] = useState(DEFAULT_CATS)
  const [invoiceDay] = useState(15)
  const [page, setPage] = useState(1)
  const pageSize = 100

  const [entities, setEntities] = useState([])
  const [open, setOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importBank, setImportBank] = useState("nubank")
  const [importType, setImportType] = useState("extract")
  const [preview, setPreview] = useState(null)
  const [mapping, setMapping] = useState({
    date_col: '',
    amount_col: '',
    desc_col: '',
    cat_col: '',
    uid_col: '',
    id_cols: [],
    custom_delimiter: '',
    quotechar: '"',
    skip_lines: 0,
    has_header: true
  })
  const [previewPage, setPreviewPage] = useState(0)
  const [viewMode, setViewMode] = useState('table') // table, raw
  const [rawText, setRawText] = useState("")
  const [deleting, setDeleting] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [importForm, setImportForm] = useState({ account_id: "", file: null })
  const [jsonView, setJsonView] = useState(false)
  const [refCandidates, setRefCandidates] = useState([])
  const [refLoading, setRefLoading] = useState(false)

  // Renamed for better UX context
  const setIntegrationType = (v) => {
    setImportBank(v);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }
  const setIntegrationMode = (v) => {
    setImportType(v);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const load = () => {
    fetch("/api/transactions").then(r => r.ok ? r.json() : []).then(d => setTransactions(Array.isArray(d) ? d : []))
    fetch("/api/accounts").then(r => r.ok ? r.json() : []).then(d => setAccounts(Array.isArray(d) ? d : []))
    fetch("/api/entities").then(r => r.ok ? r.json() : []).then(d => setEntities(Array.isArray(d) ? d : []))
    fetch("/api/tags").then(r => r.ok ? r.json() : []).then(d => setAllTags(Array.isArray(d) ? d : []))
    fetch("/api/recurring").then(r => r.ok ? r.json() : []).then(d => setRecurring(Array.isArray(d) ? d : []))
    fetch("/api/categories").then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setCategories(d.map(c => c.name)) }).catch(() => { })
  }

  useEffect(() => {
    load()
    fetch("/api/import/profiles").then(r => r.ok ? r.json() : []).then(d => setProfiles(Array.isArray(d) ? d : []))
  }, [])

  const openCreate = () => { setForm({ ...emptyForm, account_id: accounts[0]?.id || "", tags: [], flags: 0 }); setEditing(null); setJsonView(false); setRefCandidates([]); setOpen(true) }
  const openEdit = (t) => {
    setForm({
      ...t,
      amount: String(t.amount),
      tags: t.tags || [],
      flags: t.flags || 0,
      recurring_id: t.recurring_id || "",
      entity_id: t.entity_id || "",
      notes: t.notes || "",
      raw_amount: String(t.raw_amount || ""),
      destination_account_id: t.destination_account_id || ""
    });
    setEditing(t.id);
    setJsonView(false);
    setRefCandidates([]);
    setOpen(true)
    // Load ref candidates for credit/transfer types
    if (['credit', 'transfer_out', 'transfer_in'].includes(t.type)) {
      setRefLoading(true)
      fetch(`/api/transactions/${t.id}/ref-candidates`)
        .then(r => r.json())
        .then(d => setRefCandidates(Array.isArray(d) ? d : []))
        .finally(() => setRefLoading(false))
    }
  }

  // Tag input helpers
  const addTag = (name) => {
    const n = name.trim().toLowerCase()
    if (n && !form.tags.includes(n)) setForm(f => ({ ...f, tags: [...f.tags, n] }))
    setTagInput("")
  }
  const removeTag = (name) => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== name) }))
  const toggleFlag = (bit) => setForm(f => ({ ...f, flags: (f.flags || 0) ^ bit }))

  const save = async (e) => {
    e.preventDefault()
    const body = {
      ...form,
      amount: parseFloat(form.amount),
      account_id: parseInt(form.account_id),
      entity_id: form.entity_id ? parseInt(form.entity_id) : null,
      transaction_ref_id: form.transaction_ref_id ? parseInt(form.transaction_ref_id) : null,
    }
    if (editing) {
      await fetch(`/api/transactions/${editing}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    } else {
      await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    }
    setOpen(false); load()
  }

  const remove = async (id) => {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" })
    setDeleting(null); load()
  }

  const handleFileChange = useCallback((e, forcedFile = null) => {
    const file = forcedFile || e.target.files?.[0]
    if (!file) return
    if (importBank === 'custom') {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target.result
        if (!text) return
        setRawText(text)

        // Resolve BOM or extra spaces
        const content = text.replace(/^\ufeff/, "").trim()
        const allLines = content.split('\n').filter(l => l.trim().length > 0)

        // Apply skip_lines
        const effectiveLines = allLines.slice(mapping.skip_lines || 0)
        if (effectiveLines.length === 0) return

        // HEURISTIC: Find best delimiter based on the header line OR use custom
        const delims = [',', ';', '\t', '|']
        let bestDelim = mapping.custom_delimiter || ','
        if (!mapping.custom_delimiter) {
          let maxCols = 0
          delims.forEach(d => {
            const cols = effectiveLines[0].split(d).length
            if (cols > maxCols) {
              maxCols = cols
              bestDelim = d
            }
          })
        }

        const headers = effectiveLines[0].split(bestDelim).map(h => h.trim().replace(/^"|"$/g, ''))
        const rows = effectiveLines.slice(1).map(line => {
          const cols = line.split(bestDelim).map(c => c.trim().replace(/^"|"$/g, ''))
          const row = {}
          headers.forEach((h, i) => {
            row[h] = cols[i] || ""
          })
          return row
        })

        const previewData = { headers, rows, delimiter: bestDelim, totalLines: allLines.length }
        setPreview(previewData)

        // ENHANCED AUTO-MATCH
        if (!mapping.date_col) {
          const m = { ...mapping, custom_delimiter: bestDelim }
          headers.forEach(h => {
            const lh = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            if (lh.includes('data') || lh.includes('date')) m.date_col = h
            if (lh.includes('valor') || lh.includes('amount') || lh.includes('preco')) m.amount_col = h
            if (lh.includes('desc') || lh.includes('hist') || lh.includes('description') || lh.includes('detalhe')) m.desc_col = h
            if (lh.includes('cat')) m.cat_col = h
            if (lh.includes('uid') || lh.includes('id') || lh.includes('hash')) m.uid_col = h
          })
          setMapping(m)
        }
      }
      reader.onerror = () => alert("Erro ao ler o arquivo CSV.")
      reader.readAsText(file)
    }
  }, [importBank, mapping, alert])

  // Auto-update preview when relevant mapping fields change
  useEffect(() => {
    const file = fileRef.current?.files?.[0]
    if (file && importing) {
      handleFileChange(null, file)
    }
  }, [mapping.skip_lines, mapping.custom_delimiter, mapping.quotechar, importing, handleFileChange])

  const handleImport = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    formData.append('account_id', importForm.account_id)
    formData.append('type', importType)
    formData.append('bank', importBank)
    if (importBank === 'custom') {
      formData.append('mapping', JSON.stringify({
        ...mapping,
        delimiter: preview?.delimiter,
        quotechar: mapping.quotechar || '"'
      }))
    }
    const res = await fetch("/api/import", { method: "POST", body: formData })
    const data = await res.json()
    setImporting(false);
    setPreview(null);
    setRawText("");
    load();
    setImportResult(data);
  }

  const toggleReconcile = async (txn) => {
    // Optimistic update
    setTransactions(prev => prev.map(t => t.id === txn.id ? { ...t, conciliation_status: (t.conciliation_status || 0) ^ 1 } : t))
    await fetch(`/api/transactions/${txn.id}/reconcile`, { method: "PATCH" })
  }

  const onSort = (col) => {
    setSort(s => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }))
    setPage(1)
  }

  const getAccountName = useMemo(() => {
    return (id) => accounts.find(a => a.id === id)?.name || " ⚠️ Não vinculado"
  }, [accounts])

  const visible = useMemo(() => {
    if (idParam) return transactions.filter(t => t.id === idParam)
    let list = transactions.filter(t => {
      if (filterType !== "all" && t.type !== filterType) return false
      if (filterCat && t.category !== filterCat) return false
      if (filterAcc && String(t.account_id) !== String(filterAcc)) return false
      if (dateFrom && t.date < dateFrom) return false
      if (dateTo && t.date > dateTo) return false
      if (filterCon === "reconciled" && (t.conciliation_status & 1) !== 1) return false
      if (filterCon === "unreconciled" && (t.conciliation_status & 1) !== 0) return false
      if (filterEntity === "none" && t.entity_id) return false
      if (filterEntity !== "" && filterEntity !== "none" && String(t.entity_id) !== filterEntity) return false
      if (filterFlag && (t.flags & filterFlag) !== filterFlag) return false
      if (filterTag && !(t.tags || []).includes(filterTag)) return false
      if (filterAmtMin !== "") {
        const absVal = Math.abs(t.raw_amount || t.amount) / 100
        if (absVal < parseFloat(filterAmtMin)) return false
      }
      if (filterAmtMax !== "") {
        const absVal = Math.abs(t.raw_amount || t.amount) / 100
        if (absVal > parseFloat(filterAmtMax)) return false
      }
      if (filterDestAcc) {
        if (!['transfer_in', 'transfer_out', 'transfer'].includes(t.type)) return false
        // Compare both sides as strings to handle int/string mismatch
        if (String(t.destination_account_id ?? '') !== String(filterDestAcc)) return false
      }
      if (search) {
        const s = search.toLowerCase()
        if (!t.description?.toLowerCase().includes(s) && !t.category?.toLowerCase().includes(s) && !t.account_name?.toLowerCase().includes(s)) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      let va = a[sort.col] ?? "", vb = b[sort.col] ?? ""
      if (typeof va === "string") va = va.toLowerCase(), vb = vb.toLowerCase()
      return sort.dir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })
    return list
  }, [transactions, filterType, filterCat, filterAcc, filterDestAcc, dateFrom, dateTo, search, sort, filterCon, idParam, filterFlag, filterTag, filterEntity, filterAmtMin, filterAmtMax])

  const pagedList = useMemo(() => {
    return visible.slice((page - 1) * pageSize, page * pageSize)
  }, [visible, page])

  const totalPages = Math.ceil(visible.length / pageSize)

  const activeFilters = [filterType !== "all", filterCat, filterAcc, filterDestAcc, dateFrom, dateTo, filterCon !== "all", filterFlag !== 0, filterTag, filterEntity, filterAmtMin, filterAmtMax].filter(Boolean).length
  const clearFilters = () => {
    setFilterType("all"); setFilterCat(""); setFilterAcc(""); setFilterDestAcc(""); setDateFrom(""); setDateTo(""); setSearch("");
    setFilterCon("all"); setFilterFlag(0); setFilterTag(""); setFilterEntity(""); setFilterAmtMin(""); setFilterAmtMax(""); setPage(1)
  }

  const totalExp = visible.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
  const totalInc = visible.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
  const totalTransfOut = visible.filter(t => t.type === "transfer_out").reduce((s, t) => s + Math.abs(t.raw_amount || t.amount), 0)
  const totalTransfIn  = visible.filter(t => t.type === "transfer_in").reduce((s,  t) => s + Math.abs(t.raw_amount || t.amount), 0)
  const cntInc  = visible.filter(t => t.type === "income").length
  const cntExp  = visible.filter(t => t.type === "expense").length
  const cntTOut = visible.filter(t => t.type === "transfer_out").length
  const cntTIn  = visible.filter(t => t.type === "transfer_in").length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ID filter active banner */}
      {idParam && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-xl text-sm">
          <span className="font-mono text-primary font-bold">#{idParam}</span>
          <span className="text-foreground">Mostrando apenas esta transação</span>
          <button className="ml-auto text-xs text-muted-foreground hover:text-foreground underline" onClick={clearIdFilter}>Limpar filtro</button>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Transações</h1>
          <p className="text-muted-foreground text-sm mt-1">{visible.length} de {transactions.length} transações</p>
        </div>
        <div class="mr-auto ml-10">
          <Button variant="outline" onClick={() => setFilterCon("unreconciled")}><FilterIcon size={16} /> Não conciliadas</Button>

        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}><Upload size={16} /> Importar CSV</Button>
          <Button onClick={openCreate}><Plus size={16} /> Nova Transação</Button>
        </div>
      </div>

      {/* Filters */}
      <Card><CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Filtros</span>
          {activeFilters > 0 && (
            <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={clearFilters}>
              <X size={12} /> Limpar {activeFilters} filtro{activeFilters > 1 ? "s" : ""}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-7 text-sm h-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm h-9">
            <option value="all">Todos os tipos</option>
            <option value="expense">Despesas</option>
            <option value="income">Receitas</option>
            <option value="credit">Crédito</option>
            <option value="transfer_in">Transf. Recebida</option>
            <option value="transfer_out">Transf. Enviada</option>
          </Select>
          <Combobox
            className="h-9"
            placeholder="Todas categorias"
            value={filterCat}
            onChange={setFilterCat}
            options={[{ label: "Todas categorias", value: "" }, ...categories.map(c => ({ label: c, value: c }))]}
          />
          <Combobox
            className="h-9"
            placeholder="Todas as contas"
            value={filterAcc}
            onChange={setFilterAcc}
            options={[{ label: "Todas as contas", value: "" }, ...accounts.map(a => ({ label: a.name, value: a.id }))]}
          />
          {/* Dest/origin account filter — always visible, more prominent when transfer type selected */}
          <Combobox
            className={`h-9 ${filterDestAcc ? 'ring-1 ring-primary/50' : ''}`}
            placeholder={filterType === 'transfer_in' ? 'Conta Origem (transf)' : 'Conta Destino (transf)'}
            value={filterDestAcc}
            onChange={v => { setFilterDestAcc(v); setPage(1) }}
            options={[{ label: 'Conta Destino/Origem', value: '' }, ...accounts.map(a => ({ label: a.name, value: a.id }))]}
          />
          <DateRangePicker
            from={dateFrom} to={dateTo}
            onFromChange={setDateFrom} onToChange={setDateTo}
            className="h-9 xl:col-span-1"
          />
          <Select value={filterCon} onChange={e => setFilterCon(e.target.value)} className="text-sm h-9">
            <option value="all">Conciliação: Todas</option>
            <option value="reconciled">Conciliadas ✓</option>
            <option value="unreconciled">Não conciliadas</option>
          </Select>
          <Combobox
            className="h-9"
            placeholder="Todos os vínculos"
            value={filterEntity}
            onChange={setFilterEntity}
            options={[
              { label: "Todos os vínculos", value: "" },
              { label: "Sem vínculo", value: "none" },
              ...entities.map(en => ({ label: en.name, value: en.id }))
            ]}
          />
        </div>
        {/* Flags + tag + amount range filters */}
        <div className="flex flex-wrap gap-2 pt-1 items-center">
          {FLAGS.map(f => {
            const active = (filterFlag & f.bit) === f.bit
            const FIcon = f.icon
            return (
              <button key={f.bit}
                onClick={() => setFilterFlag(prev => prev ^ f.bit)}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}>
                <FIcon size={11} className={active ? "" : f.color} />
                {f.label}
              </button>
            )
          })}
          <Combobox
            className="h-7 w-48 text-xs"
            placeholder="Filtrar por Tag"
            value={filterTag}
            onChange={setFilterTag}
            options={[{ label: "Todas as tags", value: "" }, ...allTags.map(t => ({ label: `#${t.name} (${t.txn_count})`, value: t.name }))]}
          />
          {/* Amount range */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[10px] text-muted-foreground font-medium mr-1">Valor:</span>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="pl-7 h-7 w-28 text-xs"
                placeholder="Mínimo"
                value={filterAmtMin}
                onChange={e => { setFilterAmtMin(e.target.value); setPage(1) }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">–</span>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="pl-7 h-7 w-28 text-xs"
                placeholder="Máximo"
                value={filterAmtMax}
                onChange={e => { setFilterAmtMax(e.target.value); setPage(1) }}
              />
            </div>
            {(filterAmtMin || filterAmtMax) && (
              <button
                onClick={() => { setFilterAmtMin(""); setFilterAmtMax("") }}
                className="text-muted-foreground hover:text-foreground"
                title="Limpar faixa de valor"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </CardContent></Card>

      {/* Summary bar — always 5 cards */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="border-none bg-accent/30 shadow-none"><CardContent className="pt-4 pb-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Entradas (filtro)</p>
          <p className="text-xl font-bold tabular-nums amount-value text-success">+{formatCurrency(totalInc)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{cntInc} receita{cntInc !== 1 ? 's' : ''}</p>
        </CardContent></Card>
        <Card className="border-none bg-accent/30 shadow-none"><CardContent className="pt-4 pb-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Saídas (filtro)</p>
          <p className="text-xl font-bold tabular-nums amount-value text-destructive">{formatCurrency(totalExp)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{cntExp} despesa{cntExp !== 1 ? 's' : ''}</p>
        </CardContent></Card>
        <Card className="border-none bg-accent/30 shadow-none"><CardContent className="pt-4 pb-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Saldo (filtro)</p>
          <p className={`text-xl font-bold tabular-nums amount-value ${(totalInc - totalExp) >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(totalInc - totalExp)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{visible.length} total</p>
        </CardContent></Card>
        <Card className="border border-destructive/20 bg-destructive/5 shadow-none"><CardContent className="pt-4 pb-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Transf. Enviadas</p>
          <p className="text-xl font-bold tabular-nums amount-value text-destructive">-{formatCurrency(totalTransfOut)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{cntTOut} transfer{cntTOut !== 1 ? 's' : ''}</p>
        </CardContent></Card>
        <Card className="border border-success/20 bg-success/5 shadow-none"><CardContent className="pt-4 pb-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Transf. Recebidas</p>
          <p className="text-xl font-bold tabular-nums amount-value text-success">+{formatCurrency(totalTransfIn)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{cntTIn} transfer{cntTIn !== 1 ? 's' : ''}</p>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card><CardContent className="pt-4">
        <div className="overflow-hidden">
          <table className="w-full text-sm overflow-hidden">
            <thead>
              <tr className="border-b border-border">
                {[
                  { col: "date", label: "Data" },
                  { col: "description", label: "Descrição" },
                  { col: "category", label: "Categoria" },
                  { col: "account_name", label: "Conta" },
                  { col: "type", label: "Tipo" },
                  { col: "amount", label: "Valor" },
                ].map(({ col, label }) => (
                  <th key={col} className="text-left pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <button className="flex items-center gap-0.5 hover:text-primary transition-colors" onClick={() => onSort(col)}>
                      {label}
                      {sort.col === col ? (sort.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronDown size={11} className="opacity-25" />}
                    </button>
                  </th>
                ))}
                <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">✓</th>
                <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pagedList.map((t, idx) => {
                const globalIdx = (page - 1) * pageSize + idx
                const next = visible[globalIdx + 1]
                const diffDays = (next && sort.col === 'date') ? Math.abs(Math.round((new Date(t.date + 'T00:00:00') - new Date(next.date + 'T00:00:00')) / (1000 * 60 * 60 * 24))) : 0

                // Today's context for Brazil timezone
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const [ty, tm, td] = t.date.split('-')
                const tDate = new Date(ty, tm - 1, td)
                const ago = Math.floor((today - tDate) / (1000 * 60 * 60 * 24))
                const agoText = ago === 0 ? "Hoje" : ago === 1 ? "Ontem" : `${ago} dias atrás`

                return (
                  <Fragment key={t.id}>
                    <tr
                      onDoubleClick={() => openEdit(t)}
                      onClick={(e) => {
                        if (e.detail === 2) return // handled by dblclick
                        if (e.target.closest('button')) return
                        // optional: single click behavior
                      }}
                      className={`border-b border-border/40 hover:bg-accent/20 transition-colors group cursor-pointer ${t.id === idParam ? "ring-1 ring-primary/40 bg-primary/5" : ""
                        }`}
                      title={agoText}>
                      <td className="py-2.5 text-muted-foreground text-xs whitespace-nowrap align-top pt-4 pr-4 pl-4 relative font-mono">
                        <div className={!(diffDays > 0) && sort.col === 'date' ? 'same-day' : ''}>{formatDate(t.date)}</div>
                      </td>
                      <td className="py-2.5 font-medium min-w-48">
                        <div className="flex flex-col gap-1 py-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">#{t.id}</span>
                            {t.entity_name && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                                {t.entity_name}
                              </span>
                            )}
                            {t.transaction_ref_id && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" title={`Ref: #${t.transaction_ref_id}${t.ref_description ? ' — ' + t.ref_description : ''}`}>
                                🔗 #{t.transaction_ref_id}
                              </span>
                            )}
                          </div>
                          <div className="whitespace-pre-wrap leading-relaxed text-sm max-w-[500px]">{t.description}</div>
                        </div>
                      </td>
                      <td className="py-2.5"><Badge variant="secondary">{t.category || "—"}</Badge></td>
                      <td className="py-2.5 text-muted-foreground text-xs">{t.account_name}</td>
                      <td className="py-2.5">
                        <Badge variant={t.type === "expense" ? "destructive" : (['credit', 'transfer', 'transfer_in', 'transfer_out'].includes(t.type) ? "outline" : "success")}>
                          {t.type === "expense" ? "Despesa" :
                            t.type === "credit" ? "Crédito" :
                              t.type === "transfer_out" ? (" ➡️ Transf. Enviada para o banco " + getAccountName(t.destination_account_id)) :
                                t.type === "transfer_in" ? ("⬅️ Transf. Recebida do banco " + getAccountName(t.destination_account_id)) :
                                  t.type === "transfer" ? "Transferência" : "Receita"}
                        </Badge>
                      </td>
                      <td className={`py-2.5 font-semibold tabular-nums amount-value ${t.type === "expense" ? "text-destructive" : (['credit', 'transfer', 'transfer_in', 'transfer_out'].includes(t.type) ? "text-primary/70" : "text-success")}`}>
                        {t.type === "expense" ? "-" : (t.type === "credit" ? "💳 " : (['transfer', 'transfer_in', 'transfer_out'].includes(t.type) ? <ArrowLeftRight size={12} className="inline-block mr-1" /> : "+"))}{formatCurrency(Math.abs(t.raw_amount || t.amount))}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button size="icon" variant="ghost"
                          className={(t.conciliation_status & 1) === 1 ? "text-success" : "text-muted-foreground"}
                          title={(t.conciliation_status & 1) === 1 ? "Conciliada — clique para desfazer" : "Marcar como conciliada"}
                          onClick={() => toggleReconcile(t)}>
                          {(t.conciliation_status & 1) === 1 ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        </Button>
                      </td>
                      <td className="py-2.5 text-right pr-4">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil size={13} /></Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleting(t)}><Trash2 size={13} /></Button>
                        </div>
                      </td>
                    </tr>
                    {diffDays > 0 && sort.col === 'date' && (
                      <tr className="border-none hover:bg-transparent">
                        <td className="relative h-10 py-0 flex items-center justify-center">
                          <div className="absolute top-0 bottom-0 left-[26px] w-[2px] bg-border/20" />
                          <div className="absolute top-1/2 left-[26px] -translate-y-1/2 -translate-x-1/2 z-10 timeline-day">
                            <div className="bg-background border border-border/80 px-2 py-0.5 rounded-full text-[10px] font-bold text-[#b7d71e] shadow-sm whitespace-nowrap">
                              <span>+{diffDays} {diffDays === 1 ? 'dia' : 'dias'}</span>
                            </div>
                          </div>
                        </td>
                        <td colSpan={7}></td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {visible.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Nenhuma transação encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
            <p className="text-xs text-muted-foreground">Página {page} de {totalPages} ({visible.length} resultados)</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próximo</Button>
            </div>
          </div>
        )}
      </CardContent></Card>

      {/* Create/Edit */}
      <Dialog open={open} onClose={() => { setOpen(false); setJsonView(false) }} title={editing ? "Editar Transação" : "Nova Transação"}
        className="max-w-3xl"
        titleAction={editing && (
          <button
            type="button"
            onClick={() => setJsonView(v => !v)}
            className={`text-[10px] font-mono px-2 py-1 rounded border transition-all ${
              jsonView ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {jsonView ? "✏️ Editar" : "{ } JSON"}
          </button>
        )}
      >
        {jsonView ? (
          // ── JSON view ──────────────────────────────────────────────────────
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Dados completos da transação</p>
              <button
                type="button"
                onClick={() => {
                  const jsonStr = JSON.stringify({
                    ...form,
                    metadata: (() => { try { return JSON.parse(form.metadata || 'null') } catch { return form.metadata } })()
                  }, null, 2)
                  navigator.clipboard.writeText(jsonStr).then(() => alert('info', 'JSON copiado!'))
                }}
                className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 border border-border rounded px-2 py-0.5 transition-colors"
              >
                📋 Copiar
              </button>
            </div>
            <pre className="bg-accent/30 border border-border/50 rounded-xl p-4 text-[11px] font-mono overflow-auto max-h-[65vh] leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify({
                id: form.id,
                date: form.date,
                description: form.description,
                category: form.category,
                type: form.type,
                amount_cents: form.amount,
                amount_brl: form.amount ? (form.amount / 100).toFixed(2) : null,
                raw_amount_cents: form.raw_amount,
                raw_amount_brl: form.raw_amount ? (form.raw_amount / 100).toFixed(2) : null,
                account_id: form.account_id,
                account_name: form.account_name,
                entity_id: form.entity_id,
                entity_name: form.entity_name,
                destination_account_id: form.destination_account_id,
                external_uid: form.external_uid,
                raw_external_uid: form.raw_external_uid,
                conciliation_status: form.conciliation_status,
                flags: form.flags,
                tags: form.tags,
                notes: form.notes,
                recurring_id: form.recurring_id,
                liquidation_date: form.liquidation_date,
                raw_description: form.raw_description,
                created_at: form.created_at,
                updated_at: form.updated_at,
                metadata: (() => { try { return JSON.parse(form.metadata || 'null') } catch { return form.metadata } })()
              }, null, 2)}
            </pre>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg py-2 transition-colors"
              onClick={() => setJsonView(false)}
            >
              Voltar ao formulário
            </button>
          </div>
        ) : (
        // ── Normal form ────────────────────────────────────────────────────
        <form onSubmit={save} className="space-y-0">

          {/* Hero header — at-a-glance when editing */}
          {editing && (
            <div className={`mb-5 px-4 py-3 rounded-xl flex items-center justify-between gap-4 ${
              form.type === 'expense' ? 'bg-destructive/8 border border-destructive/20' :
              form.type === 'income'  ? 'bg-success/8 border border-success/20' :
              'bg-primary/8 border border-primary/20'
            }`}>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-0.5">
                  #{form.id} · {form.account_name}
                </p>
                <p className="text-sm font-medium text-foreground truncate">{form.description}</p>
                {form.raw_description && form.raw_description !== form.description && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">orig: {form.raw_description}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className={`text-2xl font-black tabular-nums amount-value ${
                  form.type === 'expense' ? 'text-destructive' :
                  form.type === 'income'  ? 'text-success' : 'text-primary'
                }`}>
                  {form.type === 'expense' ? '-' : '+'}{formatCurrency(Math.abs((form.raw_amount || form.amount || 0)))}
                </p>
                <p className="text-[10px] text-muted-foreground">{form.date}</p>
              </div>
            </div>
          )}

          {/* ── Section: Identificação ─────────────────────────────────── */}
          <div className="space-y-3 pb-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Identificação</p>
            <FormField label="Descrição">
              <Input required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="" />
            </FormField>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Data">
                <Input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </FormField>
              <FormField label="Tipo">
                <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="expense">💸 Despesa</option>
                  <option value="income">💰 Receita</option>
                  <option value="credit">💳 Crédito</option>
                  <option value="transfer_out">➡️ Transf. Enviada</option>
                  <option value="transfer_in">⬅️ Transf. Recebida</option>
                </Select>
              </FormField>
              <FormField label="Categoria">
                <Combobox value={form.category} onChange={val => setForm(f => ({ ...f, category: val }))} options={categories.map(c => ({ label: c, value: c }))} placeholder="Categoria" />
              </FormField>
            </div>
            {/* Conta Destino/Origem — only for transfers, shown as extra row */}
            {['transfer', 'transfer_in', 'transfer_out'].includes(form.type) && (
              <FormField label={form.type === 'transfer_in' ? 'Conta Origem (Obrigatório)' : 'Conta Destino (Obrigatório)'}>
                <Select required value={form.destination_account_id} onChange={e => setForm(f => ({ ...f, destination_account_id: e.target.value }))}>
                  <option value="">{form.type === 'transfer_in' ? 'Conta Origem...' : 'Conta Destino...'}</option>
                  {accounts.filter(a => a.id !== parseInt(form.account_id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </FormField>
            )}
          </div>

          <div className="border-t border-border/40" />

          {/* ── Section: Valores ──────────────────────────────────────────── */}
          <div className="space-y-3 py-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Valores</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={form.type === 'expense' ? 'Valor da Despesa (R$)' : 'Valor (R$)'}>
                <MoneyInput required value={form.amount} onValueChange={val => setForm(f => ({ ...f, amount: val }))} />
                {(form.type === 'credit' || ['transfer', 'transfer_in', 'transfer_out'].includes(form.type)) && (
                  <p className="text-[10px] text-amber-500 mt-1">ℹ️ Impacto no saldo = R$0. Valor é apenas referência.</p>
                )}
              </FormField>
              {(form.type === 'credit' || ['transfer', 'transfer_in', 'transfer_out'].includes(form.type)) ? (
                <FormField label="Valor de Referência (R$)">
                  <MoneyInput value={form.raw_amount} onValueChange={val => setForm(f => ({ ...f, raw_amount: val }))} />
                  <p className="text-[10px] text-muted-foreground italic mt-1">Aparece nos relatórios (sinal automático).</p>
                </FormField>
              ) : (
                <FormField label="Conta">
                  <Combobox value={form.account_id} onChange={val => setForm(f => ({ ...f, account_id: val }))} options={accounts.map(a => ({ label: a.name, value: a.id }))} placeholder="Selecione a conta" />
                </FormField>
              )}
            </div>

            {/* Liquidação de Crédito */}
            {form.type === 'credit' && (
              <div className="bg-accent/20 p-3 rounded-lg border border-border/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold">Data de Liquidação</label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                      checked={(form.liquidation_date || "") === getNextInvoiceDate(form.date, invoiceDay)}
                      onChange={e => setForm(f => ({ ...f, liquidation_date: e.target.checked ? getNextInvoiceDate(form.date, invoiceDay) : "" }))}
                    />
                    <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">Próxima fatura (dia {invoiceDay})</span>
                  </label>
                </div>
                <Input type="date" value={form.liquidation_date || ""} onChange={e => setForm(f => ({ ...f, liquidation_date: e.target.value }))} className="h-7 text-xs" />
                <p className="text-[10px] text-muted-foreground italic">Dia em que o dinheiro sairá efetivamente da conta.</p>
              </div>
            )}
          </div>

          <div className="border-t border-border/40" />

          {/* ── Section: Classificação ────────────────────────────────────── */}
          <div className="space-y-3 py-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Classificação</p>
            <div className="grid grid-cols-3 gap-3">
              {/* Show Conta when already occupied in Valores col */}
              {(form.type === 'credit' || ['transfer', 'transfer_in', 'transfer_out'].includes(form.type)) && (
                <FormField label="Conta">
                  <Combobox value={form.account_id} onChange={val => setForm(f => ({ ...f, account_id: val }))} options={accounts.map(a => ({ label: a.name, value: a.id }))} placeholder="Selecione a conta" />
                </FormField>
              )}
              <FormField label="Vínculo (Entidade)">
                <Combobox value={form.entity_id} onChange={val => setForm(f => ({ ...f, entity_id: val }))}
                  options={[{ label: "— Sem vínculo —", value: "" }, ...entities.map(en => ({ label: en.name, value: en.id }))]}
                  placeholder="Selecione o vínculo" />
              </FormField>
              <FormField label="Gasto Recorrente">
                <Combobox value={form.recurring_id} onChange={val => setForm(f => ({ ...f, recurring_id: val }))}
                  options={[{ label: "— Nenhum —", value: "" }, ...recurring.map(r => ({ label: r.name, value: r.id }))]}
                  placeholder="Vincular a recorrente" />
              </FormField>
            </div>

            {/* Ref transaction */}
            {editing && ['credit', 'transfer_out', 'transfer_in'].includes(form.type) && (
              <FormField label={
                form.type === 'credit' ? '🔗 Vincular à Fatura'
                : form.type === 'transfer_out' ? '🔗 Contraparte (Transf. Recebida no destino)'
                : '🔗 Contraparte (Transf. Enviada na origem)'
              }>
                {refLoading ? (
                  <p className="text-xs text-muted-foreground animate-pulse">Carregando candidatos...</p>
                ) : (
                  <>
                    <Combobox
                      value={form.transaction_ref_id ? String(form.transaction_ref_id) : ""}
                      onChange={val => setForm(f => ({ ...f, transaction_ref_id: val || null }))}
                      options={[
                        { label: "— Sem vínculo —", value: "" },
                        ...refCandidates.map(c => ({
                          label: `#${c.id} · ${c.date} · ${c.account_name} — ${c.description?.slice(0, 35)} (${(Math.abs(c.raw_amount || c.amount) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`,
                          value: String(c.id)
                        }))
                      ]}
                      placeholder="Selecionar transação de referência..."
                    />
                    {form.transaction_ref_id && <p className="text-[10px] text-primary mt-1">✓ Vinculado à #{form.transaction_ref_id}</p>}
                    {refCandidates.length === 0 && <p className="text-[10px] text-muted-foreground mt-1">Nenhum candidato encontrado.</p>}
                  </>
                )}
              </FormField>
            )}
          </div>

          <div className="border-t border-border/40" />

          {/* ── Section: Extras ───────────────────────────────────────────── */}
          <div className="space-y-3 py-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Extras</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Observação">
                <Input value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anotação livre (opcional)" />
              </FormField>
              <FormField label="Tags">
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <Input value={tagInput} placeholder="Adicionar tag..."
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
                      className="flex-1 text-sm h-8" list="tag-suggestions"
                    />
                    <datalist id="tag-suggestions">{allTags.map(t => <option key={t.id} value={t.name} />)}</datalist>
                    <Button type="button" size="sm" variant="outline" onClick={() => addTag(tagInput)}><Tag size={13} /></Button>
                  </div>
                  {form.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {form.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                          #{tag}
                          <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </FormField>
            </div>

            {/* Flags */}
            <FormField label="Flags">
              <div className="flex gap-2 flex-wrap">
                {FLAGS.map(f => {
                  const active = ((form.flags || 0) & f.bit) === f.bit
                  const FIcon = f.icon
                  return (
                    <button key={f.bit} type="button" onClick={() => toggleFlag(f.bit)}
                      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}>
                      <FIcon size={12} className={active ? "" : f.color} />
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </FormField>

            {/* Import metadata read-only */}
            {editing && form.metadata && (() => {
              let meta = null
              try { meta = JSON.parse(form.metadata) } catch { return null }
              if (!meta?.source_file) return null
              return (
                <div className="bg-accent/20 border border-border/40 rounded-lg px-3 py-2 flex items-center gap-3">
                  <span className="text-lg">📂</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Importado de</p>
                    <p className="text-xs font-medium truncate">{meta.source_file}</p>
                    {meta.source_md5 && <p className="text-[10px] text-muted-foreground font-mono">MD5: {meta.source_md5}</p>}
                    {meta.imported_at && <p className="text-[10px] text-muted-foreground">{new Date(meta.imported_at).toLocaleString('pt-BR')}</p>}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-border/40">
            <Button type="submit" className="flex-1">{editing ? "Salvar alterações" : "Adicionar transação"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
        )} {/* end jsonView ternary */}
      </Dialog>


      {/* Import */}
      <Dialog open={importing} onClose={() => { setImporting(false); setImportResult(null); setPreview(null) }} title="Integração de Extrato CSV" className="max-w-4xl">
        {importResult ? (
          <div className="space-y-4">
            <div className={`rounded-lg p-4 text-sm ${importResult.status === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              <p className="font-semibold text-base mb-1">{importResult.status === "success" ? "✓ Concluído" : "✕ Erro"}</p>
              <p>{importResult.message}</p>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => { setImporting(false); setImportResult(null) }}>Fechar</Button>
              <Button variant="outline" onClick={() => setImportResult(null)}>Importar Outro</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleImport} className="space-y-6">
            <FormField label="Conta de Destino">
              <Select required value={importForm.account_id} onChange={e => setImportForm(f => ({ ...f, account_id: e.target.value }))}>
                <option value="">Selecione a conta de destino...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </FormField>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Tipo de Integração</label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {profiles.map(p => {
                  const active = importBank === p.id
                  return (
                    <div key={p.id}>
                      <button type="button" onClick={() => setIntegrationType(p.id)}
                        className={`w-full h-full rounded-xl border px-3 py-3 text-sm font-medium text-left transition-all ${active ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5"}`}>
                        <p className="font-bold whitespace-nowrap overflow-hidden text-ellipsis">{p.label}</p>
                        <p className="text-[9px] opacity-60 uppercase tracking-tighter">Padrão {p.id}</p>
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Enhanced Help Guidance */}
              {profiles.find(p => p.id === importBank)?.help && (
                <div className="mt-3 p-4 bg-primary/5 border border-primary/10 rounded-xl animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start gap-3">
                    <HelpCircle size={18} className="text-primary shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono">Guia de Integração</p>
                      <p className="text-xs text-muted-foreground leading-relaxed italic">
                        {profiles.find(p => p.id === importBank).help}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-6">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Modo de Ingestão</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setIntegrationMode('extract')}
                  className={`rounded-xl border px-4 py-3 text-xs font-medium transition-all ${importType === 'extract' ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" : "border-border text-muted-foreground hover:bg-accent"}`}>
                  Extrato Bancário
                </button>
                <button type="button" onClick={() => setIntegrationMode('credit')}
                  className={`rounded-xl border px-4 py-3 text-xs font-medium transition-all ${importType === 'credit' ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" : "border-border text-muted-foreground hover:border-accent"}`}>
                  Fatura / Crédito
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 px-1 italic">
                {importType === 'credit' ? '💡 Transações de crédito não alteram o saldo atual da conta.' : '💡 Transações de extrato atualizam o saldo contábil da conta.'}
              </p>
            </div>

            {importBank === 'custom' && (
              <div className="space-y-4 animate-in zoom-in-95 duration-300">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Custom Mapping &amp; Extraction</h3>
                    {preview && <Badge variant="outline" className="text-[8px] border-primary/20 text-primary">{preview.totalLines} Linhas Totais</Badge>}
                  </div>

                  {!preview ? (
                    <div className="py-8 border-2 border-dashed border-primary/10 rounded-xl flex flex-col items-center justify-center gap-2 bg-card/40">
                      <p className="text-[10px] text-muted-foreground font-medium">Anexe um arquivo abaixo para configurar o mapeamento manual</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-muted-foreground uppercase border-b border-border pb-1 font-mono">1. Campos do Sistema</h4>
                          <div className="grid grid-cols-1 gap-3">
                            <FormField label="Data Principal">
                              <Select value={mapping.date_col} onChange={e => setMapping(m => ({ ...m, date_col: e.target.value }))}>
                                <option value="">Selecione...</option>
                                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </Select>
                            </FormField>
                            <FormField label="Valor Principal">
                              <Select value={mapping.amount_col} onChange={e => setMapping(m => ({ ...m, amount_col: e.target.value }))}>
                                <option value="">Selecione...</option>
                                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </Select>
                            </FormField>
                            <FormField label="Descrição Principal">
                              <Select value={mapping.desc_col} onChange={e => setMapping(m => ({ ...m, desc_col: e.target.value }))}>
                                <option value="">Selecione...</option>
                                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </Select>
                            </FormField>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-muted-foreground uppercase border-b border-border pb-1 font-mono">2. Identificação &amp; Parser</h4>
                          <div className="grid grid-cols-1 gap-3">
                            <div className="grid grid-cols-2 gap-2">
                              <FormField label="Aspas / Escape">
                                <Select value={mapping.quotechar} onChange={e => setMapping(m => ({ ...m, quotechar: e.target.value }))}>
                                  <option value={'"'}>Aspas Duplas ( " )</option>
                                  <option value={"'"}>Aspas Simples ( ' )</option>
                                </Select>
                              </FormField>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <FormField label="Pular Linhas Iniciais">
                                <Input
                                  type="number"
                                  className="h-8 text-xs font-mono"
                                  value={mapping.skip_lines}
                                  onChange={e => setMapping(m => ({ ...m, skip_lines: parseInt(e.target.value) || 0 }))}
                                />
                              </FormField>
                              <FormField label="Delimitador CSV">
                                <Select value={mapping.custom_delimiter} onChange={e => setMapping(m => ({ ...m, custom_delimiter: e.target.value }))}>
                                  <option value="">Auto-Detectar</option>
                                  <option value=",">Vírgula ( , )</option>
                                  <option value=";">Ponto e vírgula ( ; )</option>
                                  <option value="\t">Tabulação ( TAB )</option>
                                  <option value="|">Barra ( | )</option>
                                </Select>
                              </FormField>
                            </div>
                            <FormField label="Colunas de Idempotência (Chave Única)">
                              <div className="flex flex-wrap gap-1 p-2 border border-border rounded-lg bg-background min-h-[40px]">
                                {preview.headers.map(h => {
                                  const selected = mapping.id_cols.includes(h)
                                  return (
                                    <button key={h} type="button" onClick={() => {
                                      setMapping(m => ({
                                        ...m,
                                        id_cols: selected ? m.id_cols.filter(x => x !== h) : [...m.id_cols, h]
                                      }))
                                    }} className={`text-[9px] px-2 py-0.5 rounded-full border transition-all ${selected ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-border text-muted-foreground hover:bg-accent"}`}>
                                      {h}
                                    </button>
                                  )
                                })}
                              </div>
                            </FormField>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                        <button type="button" onClick={() => handleFileChange(null, fileRef.current?.files?.[0])} className="hover:text-primary transition-colors">🔄 Atualizar Preview</button>
                      </div>

                      <div className="rounded-xl border border-border overflow-hidden shadow-2xl bg-card">
                        <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                          <div className="flex items-center gap-6">
                            <div className="flex gap-4">
                              <button type="button" onClick={() => setViewMode('table')} className={`text-[9px] font-bold uppercase transition-all ${viewMode === 'table' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Preview Estruturado</button>
                              <button type="button" onClick={() => setViewMode('raw')} className={`text-[9px] font-bold uppercase transition-all ${viewMode === 'raw' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Arquivo Raw (Texto)</button>
                            </div>
                            {viewMode === 'table' && (
                              <div className="hidden lg:flex items-center gap-2 border-l border-border pl-6">
                                <span className="text-[10px] text-muted-foreground font-mono">Colunas: <span className="text-primary font-bold">{preview.headers.length}</span></span>
                                <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">({preview.headers.join(', ')})</span>
                              </div>
                            )}
                          </div>
                          {viewMode === 'table' && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-muted-foreground uppercase font-mono">Página Exemplo:</span>
                              {[0, 1, 2].map(p => (
                                <button key={p} type="button" onClick={() => setPreviewPage(p)}
                                  className={`w-5 h-5 rounded flex items-center justify-center text-[9px] border transition-all ${previewPage === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}>
                                  {p + 1}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="max-h-[250px] overflow-auto">
                          {viewMode === 'table' ? (
                            <table className="w-full text-[10px]">
                              <thead>
                                <tr className="bg-accent/30 border-b border-border sticky top-0">
                                  {preview.headers.map(h => <th key={h} className="text-left p-2.5 font-bold tabular-nums text-muted-foreground uppercase whitespace-nowrap">{h}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {preview.rows.slice(previewPage * 5, (previewPage * 5) + 5).map((row, i) => (
                                  <tr key={i} className="border-t border-border/50 hover:bg-primary/5 transition-colors">
                                    {preview.headers.map(h => <td key={h} className="p-2.5 truncate max-w-[180px] border-r border-border/20 last:border-0">{row[h]}</td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="p-0 text-[10px] font-mono text-muted-foreground leading-relaxed bg-black/20 overflow-hidden flex">
                              <div className="bg-muted/30 border-r border-border/50 py-4 px-2 text-right select-none text-muted-foreground/40 min-w-[35px]">
                                {rawText.split('\n').slice(0, 50).map((_, i) => (
                                  <div key={i} className={`h-5 ${i < mapping.skip_lines ? 'text-destructive/40 font-bold bg-destructive/5' : ''}`}>{i + 1}</div>
                                ))}
                              </div>
                              <div className="py-4 px-4 overflow-x-auto w-full">
                                {rawText.split('\n').slice(0, 50).map((line, i) => (
                                  <div key={i} className={`h-5 whitespace-pre pr-4 transition-colors ${i < mapping.skip_lines ? 'text-destructive/60 bg-destructive/5 line-through opacity-50' : 'hover:bg-primary/5'}`}>
                                    {line || ' '}
                                  </div>
                                ))}
                                {rawText.split('\n').length > 50 && <div className="mt-2 text-primary/40 italic">... (arquivo truncado no preview)</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <FormField label="Arquivo CSV / TSV">
              <input
                type="file"
                name="file"
                accept=".csv,.tsv,.txt"
                ref={fileRef}
                onChange={handleFileChange}
                className="w-full text-xs text-muted-foreground file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all focus:outline-none bg-background/50 border border-border rounded-xl p-1.5"
                required
              />
            </FormField>

            <div className="flex gap-3 pt-6 border-t border-border/40">
              <Button type="submit" className="flex-1 h-12 font-bold shadow-lg shadow-primary/20" disabled={!importForm.account_id || (importBank === 'custom' && !preview)}>
                Finalizar Integração
              </Button>
              <Button type="button" variant="outline" className="h-12 px-6" onClick={() => setImporting(false)}>Cancelar</Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Excluir Transação">
        <p className="text-muted-foreground mb-4">Excluir <strong>{deleting?.description}</strong>? O saldo da conta será ajustado.</p>
        <div className="flex gap-3">
          <Button variant="destructive" className="flex-1" onClick={() => remove(deleting.id)}>Excluir</Button>
          <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
        </div>
      </Dialog>
      {/* Import Result Modal */}
      <Dialog open={!!importResult} onClose={() => setImportResult(null)} title="Resultado da Importação">
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${importResult?.status === 'success' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
              {importResult?.status === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-tight">{importResult?.message}</p>
              {(importResult?.duplicates?.length > 0 || importResult?.ignored?.length > 0) && (
                <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                  {importResult?.duplicates?.length || 0} duplicadas puladas. {importResult?.ignored?.length || 0} ignoradas.
                </p>
              )}
            </div>
          </div>

          {(importResult?.duplicates?.length > 0) && (
            <div className="p-3 bg-muted/30 rounded-xl border border-border/40">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Linhas Duplicadas (MD5):</p>
              <p className="text-[9px] font-mono break-all opacity-70 max-h-[80px] overflow-auto leading-relaxed">
                {importResult.duplicates.join(', ')}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1 h-11" variant="outline" onClick={() => { setImportResult(null); setImporting(true); setPreview(null); }}>
              <RefreshCw size={14} className="mr-2" /> Importar Outro
            </Button>
            <Button className="flex-1 h-11 shadow-lg shadow-primary/10" onClick={() => setImportResult(null)}>
              Fechar
            </Button>
          </div>
        </div>
      </Dialog>
    </div >
  )
}
