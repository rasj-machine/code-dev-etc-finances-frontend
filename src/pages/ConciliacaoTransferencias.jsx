import { useEffect, useState, useMemo } from "react"
import { Button, Card, CardContent, Select, Combobox, Input } from "@/components/ui"
import { formatCurrency } from "@/lib/utils"
import {
  ArrowRight, CheckCircle2, AlertTriangle, XCircle, Link2, Link2Off,
  RefreshCw, ChevronDown, ChevronUp, Search, Zap
} from "lucide-react"

function amtFmt(t) {
  if (!t) return "—"
  return formatCurrency(Math.abs(t.raw_amount || t.amount || 0))
}

function amtCents(t) {
  if (!t) return 0
  return Math.abs(t.raw_amount || t.amount || 0)
}

/** Score similarity between tx and candidate (lower = better match) */
function matchScore(tx, cand) {
  const amtDiff = Math.abs(amtCents(tx) - amtCents(cand))
  const dayDiff = tx.date && cand.date
    ? Math.abs((new Date(tx.date) - new Date(cand.date)) / 86400000)
    : 999
  // weight: amount mismatch is heavier
  return amtDiff / 100 + dayDiff * 5
}

function StatusBadge({ status }) {
  if (status === "ok")
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full"><CheckCircle2 size={10} /> OK</span>
  if (status === "mismatch")
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full"><AlertTriangle size={10} /> Valor divergente</span>
  return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full"><XCircle size={10} /> Sem vínculo</span>
}

function TxCell({ tx, accent, dimmed }) {
  if (!tx) return (
    <div className="flex items-center justify-center h-full min-h-[60px] border-2 border-dashed border-border/30 rounded-lg text-muted-foreground/40 text-xs italic">
      — sem contraparte —
    </div>
  )
  return (
    <div className={`px-3 py-2.5 rounded-lg border ${accent} ${dimmed ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="text-[10px] text-muted-foreground font-mono">#{tx.id}</span>
        <span className="text-[10px] text-muted-foreground">{tx.date}</span>
      </div>
      <p className="text-xs font-semibold truncate text-foreground">{tx.description}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">{tx.account_name}</span>
        <span className="text-sm font-black tabular-nums amount-value text-primary">{amtFmt(tx)}</span>
      </div>
      {tx.category && (
        <span className="text-[9px] text-muted-foreground/60 mt-0.5 block">{tx.category}</span>
      )}
    </div>
  )
}

export default function ConciliacaoTransferencias() {
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState({})
  const [filterAcc, setFilterAcc] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("status")
  const [expandedId, setExpandedId] = useState(null)

  const load = async () => {
    setLoading(true)
    const [txns, accs] = await Promise.all([
      fetch("/api/transactions").then(r => r.ok ? r.json() : []),
      fetch("/api/accounts").then(r => r.ok ? r.json() : []),
    ])
    setTransactions(Array.isArray(txns) ? txns : [])
    setAccounts(Array.isArray(accs) ? accs : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const txById = useMemo(() => {
    const m = {}
    for (const t of transactions) m[t.id] = t
    return m
  }, [transactions])

  // ── Correct pairing algorithm ──────────────────────────────────────────────
  // Strategy: collect unique pairs from BOTH sides' transaction_ref_id, then
  // add orphan outs and orphan ins separately.
  const { rows, summary } = useMemo(() => {
    const processedIds = new Set()
    const built = []

    // Pass 1: collect all explicitly linked pairs (from either direction)
    for (const t of transactions) {
      if (!['transfer_out', 'transfer_in'].includes(t.type)) continue
      if (!t.transaction_ref_id) continue
      if (processedIds.has(t.id)) continue

      const other = txById[t.transaction_ref_id]
      if (!other) continue // ref points to deleted/missing tx

      // Normalize: out is always the transfer_out side
      const out = t.type === 'transfer_out' ? t : other
      const tin = t.type === 'transfer_in' ? t : other

      // Skip if neither is a proper transfer pair
      if (!['transfer_out', 'transfer_in'].includes(out?.type)) continue
      if (!['transfer_out', 'transfer_in'].includes(tin?.type)) continue

      processedIds.add(t.id)
      processedIds.add(other.id)

      const diff = Math.abs(amtCents(out) - amtCents(tin))
      built.push({
        out,
        linked: tin,
        status: diff > 5 ? "mismatch" : "ok",
        diff,
      })
    }

    // Pass 2: orphan transfer_out (no visible link)
    for (const t of transactions) {
      if (t.type !== 'transfer_out') continue
      if (processedIds.has(t.id)) continue
      processedIds.add(t.id)
      built.push({ out: t, linked: null, status: "unlinked", diff: null })
    }

    // Pass 3: orphan transfer_in (no visible link)
    for (const t of transactions) {
      if (t.type !== 'transfer_in') continue
      if (processedIds.has(t.id)) continue
      processedIds.add(t.id)
      built.push({ out: null, linked: t, status: "unlinked", diff: null })
    }

    const summary = {
      total: built.length,
      ok: built.filter(r => r.status === "ok").length,
      mismatch: built.filter(r => r.status === "mismatch").length,
      unlinked: built.filter(r => r.status === "unlinked").length,
    }
    return { rows: built, summary }
  }, [transactions, txById])

  // ── Auto-suggestions: top 3 candidates sorted by (amount diff + date diff) ─
  const suggestionsFor = (tx) => {
    if (!tx) return []
    const targetType = tx.type === 'transfer_out' ? 'transfer_in' : 'transfer_out'
    return transactions
      .filter(t => t.type === targetType && t.id !== tx.id && !t.transaction_ref_id)
      .map(t => ({ tx: t, score: matchScore(tx, t) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(({ tx: t }) => t)
  }

  // Full candidate list for combobox
  const candidatesFor = (tx) => {
    if (!tx) return []
    const targetType = tx.type === 'transfer_out' ? 'transfer_in' : 'transfer_out'
    return transactions
      .filter(t => t.type === targetType && t.id !== tx.id)
      .map(t => ({ tx: t, score: matchScore(tx, t) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 60)
      .map(({ tx: t }) => ({
        label: `#${t.id} · ${t.date} · ${t.account_name} — ${t.description?.slice(0, 35)} (${amtFmt(t)})`,
        value: t.id,
      }))
  }

  const filteredRows = useMemo(() => {
    let r = rows
    if (filterStatus !== "all") r = r.filter(row => row.status === filterStatus)
    if (filterAcc) r = r.filter(row =>
      String(row.out?.account_id) === filterAcc ||
      String(row.linked?.account_id) === filterAcc ||
      String(row.out?.destination_account_id) === filterAcc ||
      String(row.linked?.destination_account_id) === filterAcc
    )
    if (search) {
      const s = search.toLowerCase()
      r = r.filter(row =>
        row.out?.description?.toLowerCase().includes(s) ||
        row.linked?.description?.toLowerCase().includes(s) ||
        row.out?.account_name?.toLowerCase().includes(s) ||
        row.linked?.account_name?.toLowerCase().includes(s)
      )
    }
    if (sort === "date_desc") r = [...r].sort((a, b) =>
      ((b.out || b.linked)?.date ?? "").localeCompare((a.out || a.linked)?.date ?? ""))
    else if (sort === "date_asc") r = [...r].sort((a, b) =>
      ((a.out || a.linked)?.date ?? "").localeCompare((b.out || b.linked)?.date ?? ""))
    else if (sort === "amount_desc") r = [...r].sort((a, b) =>
      amtCents(b.out || b.linked) - amtCents(a.out || a.linked))
    else if (sort === "status") r = [...r].sort((a, b) => {
      const p = { unlinked: 0, mismatch: 1, ok: 2 }
      return (p[a.status] ?? 9) - (p[b.status] ?? 9)
    })
    return r
  }, [rows, filterAcc, filterStatus, search, sort])

  const linkTx = async (txId, refId) => {
    setLinking(l => ({ ...l, [txId]: true }))
    try {
      await fetch(`/api/transactions/${txId}/link-ref`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref_id: refId || null }),
      })
      await load()
      setExpandedId(null)
    } finally {
      setLinking(l => ({ ...l, [txId]: false }))
    }
  }

  const unlinkTx = (txId) => linkTx(txId, null)

  const rowBorder = (status) => {
    if (status === "ok")       return "border-border/30"
    if (status === "mismatch") return "border-l-2 border-l-amber-400"
    return "border-l-2 border-l-destructive"
  }

  const rowBg = (status) => {
    if (status === "ok")       return ""
    if (status === "mismatch") return "bg-amber-500/5"
    return "bg-destructive/5"
  }

  const kpiClick = (key) => {
    const map = { "all": "all", "ok": "ok", "mismatch": "mismatch", "unlinked": "unlinked" }
    setFilterStatus(prev => prev === map[key] ? "all" : map[key])
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conciliação de Transferências</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visualize, valide e vincule pares de transferência entre contas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: "all",      label: "Total de pares",     val: summary.total,    color: "text-foreground",   bg: "border-none bg-accent/30" },
          { key: "ok",       label: "Conciliados ✓",      val: summary.ok,       color: "text-success",      bg: "bg-success/5 border-success/20" },
          { key: "mismatch", label: "Valor divergente",   val: summary.mismatch, color: "text-amber-500",    bg: "bg-amber-500/5 border-amber-500/20" },
          { key: "unlinked", label: "Sem vínculo",        val: summary.unlinked, color: "text-destructive",  bg: "bg-destructive/5 border-destructive/20" },
        ].map(s => (
          <Card key={s.key}
            className={`border ${s.bg} shadow-none cursor-pointer transition-all hover:scale-[1.02] ${filterStatus === s.key ? 'ring-2 ring-primary/40' : ''}`}
            onClick={() => kpiClick(s.key)}>
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</p>
              <p className={`text-3xl font-black tabular-nums ${s.color}`}>{s.val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card><CardContent className="pt-3 pb-3">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-7 text-sm h-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 text-sm w-44">
            <option value="all">Todos os status</option>
            <option value="ok">✓ Conciliados</option>
            <option value="mismatch">⚠ Valor divergente</option>
            <option value="unlinked">✗ Sem vínculo</option>
          </Select>
          <Combobox className="h-9 w-48" placeholder="Todas as contas" value={filterAcc}
            onChange={setFilterAcc}
            options={[{ label: "Todas as contas", value: "" }, ...accounts.map(a => ({ label: a.name, value: a.id }))]} />
          <Select value={sort} onChange={e => setSort(e.target.value)} className="h-9 text-sm w-52">
            <option value="status">Status (problemas primeiro)</option>
            <option value="date_desc">Data ↓</option>
            <option value="date_asc">Data ↑</option>
            <option value="amount_desc">Valor ↓</option>
          </Select>
          {(filterAcc || filterStatus !== "all" || search) && (
            <Button variant="outline" size="sm" onClick={() => { setFilterAcc(""); setFilterStatus("all"); setSearch("") }}>
              Limpar
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground shrink-0">{filteredRows.length} pares</span>
        </div>
      </CardContent></Card>

      {/* Content */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground animate-pulse">Carregando transações...</div>
      ) : filteredRows.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">Nenhum registro encontrado.</div>
      ) : (
        <div className="space-y-2">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_28px_1fr_130px] gap-3 px-4 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transferência Enviada (OUT)</p>
            <div />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contraparte Recebida (IN)</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Status · Ações</p>
          </div>

          {filteredRows.map((row, i) => {
            const mainTx = row.out || row.linked
            const isExpanded = expandedId === (row.out?.id ?? row.linked?.id)
            const isLinking = !!(linking[row.out?.id] || linking[row.linked?.id])
            const sourceTx = row.out || row.linked // whichever exists, to get suggestions
            const suggestions = row.status === "unlinked" ? suggestionsFor(sourceTx) : []

            return (
              <Card key={`${row.out?.id ?? 'x'}-${row.linked?.id ?? 'y'}-${i}`}
                className={`border transition-all ${rowBorder(row.status)} ${rowBg(row.status)}`}>
                <CardContent className="p-3">
                  {/* Main row */}
                  <div className="grid grid-cols-[1fr_28px_1fr_130px] gap-3 items-center">
                    <TxCell tx={row.out} accent="border-border/40 bg-card" />
                    <div className="flex items-center justify-center">
                      <ArrowRight size={15} className={
                        row.status === "ok" ? "text-success" :
                        row.status === "mismatch" ? "text-amber-400" : "text-muted-foreground/30"} />
                    </div>
                    <TxCell tx={row.linked} accent="border-border/40 bg-card" />

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-1.5">
                      <StatusBadge status={row.status} />
                      {row.status === "mismatch" && row.diff != null && (
                        <span className="text-[10px] text-amber-500 font-mono">Δ {formatCurrency(row.diff)}</span>
                      )}
                      <div className="flex gap-1 mt-0.5">
                        <button
                          title={isExpanded ? "Fechar" : "Editar vínculo"}
                          onClick={() => setExpandedId(isExpanded ? null : (row.out?.id ?? row.linked?.id))}
                          className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        {row.status !== "unlinked" && (
                          <button
                            title="Remover vínculo"
                            onClick={() => unlinkTx(mainTx?.id)}
                            disabled={isLinking}
                            className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                          >
                            <Link2Off size={13} />
                          </button>
                        )}
                        {isLinking && <RefreshCw size={12} className="animate-spin text-muted-foreground self-center" />}
                      </div>
                    </div>
                  </div>

                  {/* Inline suggestions for unlinked rows */}
                  {row.status === "unlinked" && suggestions.length > 0 && !isExpanded && (
                    <div className="mt-2.5 pt-2.5 border-t border-border/30">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Zap size={10} className="text-amber-400" /> Sugestões automáticas
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map(sug => (
                          <button
                            key={sug.id}
                            onClick={() => linkTx(sourceTx.id, sug.id)}
                            disabled={isLinking}
                            className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors disabled:opacity-40"
                          >
                            <Link2 size={9} />
                            #{sug.id} · {sug.date} · {sug.account_name} · {amtFmt(sug)}
                          </button>
                        ))}
                        <button
                          onClick={() => setExpandedId(row.out?.id ?? row.linked?.id)}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-border/40 text-muted-foreground hover:bg-accent transition-colors"
                        >
                          <ChevronDown size={9} /> Mais opções
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded linking panel */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border/40">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                        <Link2 size={11} />
                        {row.out ? "Selecionar Transfer. Recebida (IN)" : "Selecionar Transfer. Enviada (OUT)"}
                      </p>
                      <div className="flex gap-2 items-center">
                        <Combobox
                          className="h-8 flex-1 text-xs"
                          placeholder="Buscar e selecionar transação..."
                          value={
                            row.out && row.linked ? String(row.linked.id) :
                            !row.out && row.linked?.transaction_ref_id ? String(row.linked.transaction_ref_id) : ""
                          }
                          onChange={val => {
                            const anchor = row.out || row.linked
                            if (val) linkTx(anchor.id, parseInt(val))
                            else unlinkTx(anchor.id)
                          }}
                          options={[
                            { label: "— Remover vínculo —", value: "" },
                            ...candidatesFor(row.out || row.linked)
                          ]}
                        />
                        {isLinking && <RefreshCw size={13} className="animate-spin text-muted-foreground" />}
                      </div>
                      {row.out && row.linked && (
                        <p className="text-[10px] text-muted-foreground mt-2">
                          Vínculo bidirecional: <span className="font-mono text-primary">#{row.out.id} ↔ #{row.linked.id}</span>
                          {row.status === "ok" && <span className="text-success ml-2">✓ Valores conferem</span>}
                          {row.status === "mismatch" && <span className="text-amber-500 ml-2">⚠ Diferença de {formatCurrency(row.diff)}</span>}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
