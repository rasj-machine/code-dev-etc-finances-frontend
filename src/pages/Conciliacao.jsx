import { useState, useEffect, useCallback, useMemo } from "react"
import { Button, Card, CardContent, Input, Badge, MultiSelect, MoneyInput } from "@/components/ui"
import { Dialog, FormField } from "@/components/Dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { CheckCircle2, AlertTriangle, XCircle, Save, ChevronLeft, ChevronRight, Calculator, CheckSquare, Square, Zap, Filter, Building2, MessageSquare } from "lucide-react"

import { usePrivacy } from "@/context/PrivacyContext"

export default function Conciliacao() {
  const { pinVerified } = usePrivacy()
  const [accounts, setAccounts] = useState([])
  const [selectedAccs, setSelectedAccs] = useState([]) // Array of IDs
  const [data, setData] = useState([])

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [editing, setEditing] = useState(null) // { date, accId, value, notes }

  // Filters
  const [hideFuture, setHideFuture] = useState(true)
  const [hidePending, setHidePending] = useState(false)
  const [hideReconciled, setHideReconciled] = useState(true)

  const [selectedKeys, setSelectedKeys] = useState(new Set()) // "date|accId"
  const [batchNote, setBatchNote] = useState("")
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 100

  const todayStr = useMemo(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  }, [])

  useEffect(() => {
    fetch("/api/accounts").then(r => r.ok ? r.json() : []).then(d => setAccounts(Array.isArray(d) ? d : []))
  }, [pinVerified])

  const loadData = useCallback(() => {
    const accId = selectedAccs.length === 1 ? selectedAccs[0] : "0"
    const idsParam = selectedAccs.length > 0 ? `?ids=${selectedAccs.join(',')}` : ""
    const date_from = `${year}-01-01`
    const date_to = `${year}-12-31`
    const baseUrl = `/api/reconciliation/${accId}`
    const queryJoin = idsParam ? "&" : "?"
    const url = `${baseUrl}${idsParam}${queryJoin}date_from=${date_from}&date_to=${date_to}`
    fetch(url).then(r => r.ok ? r.json() : []).then(d => setData(Array.isArray(d) ? d : []))
  }, [selectedAccs, year])

  useEffect(() => { loadData() }, [loadData, pinVerified])

  const filteredData = useMemo(() => {
    return data.filter(row => {
      const isFuture = row.date > todayStr
      const isReconciled = row.external_balance !== null && Math.abs(row.external_balance - row.platform_balance) < 0.01
      const isPending = row.external_balance === null && !isFuture
      if (hideFuture && isFuture) return false
      if (hidePending && isPending) return false
      if (hideReconciled && isReconciled) return false
      return true
    })
  }, [data, hideFuture, hidePending, hideReconciled, todayStr])

  const pagedData = useMemo(() => {
    return filteredData.slice((page - 1) * pageSize, page * pageSize)
  }, [filteredData, page])

  const totalPages = Math.ceil(filteredData.length / pageSize)

  const saveBalance = async (date, accId, value, notes) => {
    await fetch("/api/reconciliation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: accId, date, external_balance: parseFloat(value), notes })
    })
    setEditing(null); loadData()
  }

  const conciliateSelected = () => setShowBatchModal(true)

  const finishConciliate = async () => {
    const payload = Array.from(selectedKeys).map(key => {
      const [date, accId] = key.split('|')
      const row = data.find(r => r.date === date && String(r.account_id) === accId)
      return { account_id: parseInt(accId), date, external_balance: row.platform_balance, notes: batchNote || row?.notes || "" }
    })
    if (!payload.length) return
    await fetch("/api/reconciliation/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    setSelectedKeys(new Set()); setBatchNote(""); setShowBatchModal(false); loadData()
  }

  const toggleSelect = (date, accId) => {
    const key = `${date}|${accId}`
    const next = new Set(selectedKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelectedKeys(next)
  }

  const toggleAll = () => {
    const selectable = filteredData.filter(r => r.date <= todayStr)
    if (selectedKeys.size === selectable.length && selectable.length > 0) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(selectable.map(r => `${r.date}|${r.account_id}`)))
    }
  }

  const goToToday = () => {
    const idx = filteredData.findIndex(r => r.date === todayStr)
    if (idx !== -1) {
      const targetPage = Math.floor(idx / pageSize) + 1
      setPage(targetPage)
      // Scroll to row after it renders on the new page
      setTimeout(() => {
        const el = document.getElementById(`row-${todayStr}-${filteredData[idx].account_id}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Conciliação de Contas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Compare o saldo plataforma/real. Clique 2x para selecionar. (Vazio = todas).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={goToToday} className="h-8 gap-2">Hoje</Button>
          <div className="flex items-center bg-card border border-border rounded-xl p-1">
            <button disabled={year <= 2025} onClick={() => setYear(y => y - 1)} className="p-1.5 hover:bg-accent rounded-lg disabled:opacity-20"><ChevronLeft size={16} /></button>
            <span className="px-4 font-bold text-sm">{year}</span>
            <button disabled={year >= currentYear + 1} onClick={() => setYear(y => y + 1)} className="p-1.5 hover:bg-accent rounded-lg disabled:opacity-20"><ChevronRight size={16} /></button>
          </div>
          <div className="w-64">
            <MultiSelect selected={selectedAccs} onChange={setSelectedAccs} options={accounts.map(a => ({ label: a.name, value: a.id }))} placeholder="Todas as Contas" />
          </div>
        </div>
      </div>

      <Card className="bg-muted/30 border-none shadow-none">
        <CardContent className="pt-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="h-fut" checked={hideFuture} onChange={e => setHideFuture(e.target.checked)} className="rounded border-border" />
            <label htmlFor="h-fut" className="text-sm font-medium cursor-pointer">Esconder futuras</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="h-pen" checked={hidePending} onChange={e => setHidePending(e.target.checked)} className="rounded border-border" />
            <label htmlFor="h-pen" className="text-sm font-medium cursor-pointer">Esconder pendentes</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="h-con" checked={hideReconciled} onChange={e => setHideReconciled(e.target.checked)} className="rounded border-border" />
            <label htmlFor="h-con" className="text-sm font-medium cursor-pointer">Esconder conciliados</label>
          </div>
        </CardContent>
      </Card>

      <div className="relative overflow-hidden flex flex-col h-[75vh] border border-border rounded-xl bg-card shadow-sm conciliacao-table">
        {selectedKeys.size > 0 && (
          <div className="sticky top-0 left-0 right-0 z-50 p-2.5 bg-primary text-primary-foreground flex items-center justify-between px-6 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2 shrink-0">
              <CheckSquare size={18} className="invisble-privacy" />
              <span className="text-sm font-bold uppercase">{selectedKeys.size} registros selecionados</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" className="h-8 font-bold gap-2 px-4 shadow-sm" onClick={conciliateSelected}><Zap size={14} className="fill-current" /> Conciliar agora</Button>
              <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-white/10" onClick={() => setSelectedKeys(new Set())}>Cancelar</Button>
            </div>
          </div>
        )}

        <div className="overflow-auto flex-1 border-t border-border">
          <table className="w-full text-sm">
            <thead className="bg-card border-b border-border sticky top-0 z-30 shadow-sm">
              <tr>
                <th className="w-10 px-4 py-3"><button onClick={toggleAll}>{selectedKeys.size > 0 && selectedKeys.size === filteredData.filter(r => r.date <= todayStr).length ? <CheckSquare size={16} /> : <Square size={16} />}</button></th>
                <th className="px-4 py-3 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground">Conta</th>
                <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wider text-muted-foreground">Saldo Plataforma</th>
                <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wider text-muted-foreground">Saldo Real (Banco)</th>
                <th className="px-4 py-3 text-right font-bold text-xs uppercase tracking-wider text-muted-foreground">Diferença</th>
                <th className="px-4 py-3 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {pagedData.map(row => {
                const isFuture = row.date > todayStr
                const diff = row.external_balance !== null ? row.external_balance - row.platform_balance : 0
                const isMatch = row.external_balance !== null && Math.abs(diff) < 0.01
                const isError = row.external_balance !== null && !isMatch
                const isMissing = !isFuture && row.external_balance === null
                const isSelected = selectedKeys.has(`${row.date}|${row.account_id}`)

                return (
                  <tr key={`${row.date}-${row.account_id}`} id={`row-${row.date}-${row.account_id}`}
                    onClick={() => !isFuture && toggleSelect(row.date, row.account_id)}
                    className={`${isFuture ? "opacity-50 grayscale bg-accent/5" : isError ? "bg-destructive/5" : isMissing ? "bg-yellow-500/[0.03]" : ""} ${isSelected ? "bg-primary/[0.07]" : ""} transition-colors hover:bg-accent/30 group select-none`}>
                    <td className="px-4 py-2 text-center">
                      {!isFuture && (
                        <button onClick={(e) => { e.stopPropagation(); toggleSelect(row.date, row.account_id) }} className={`${isSelected ? "text-primary" : "text-muted-foreground opacity-30 group-hover:opacity-100"}`}>
                          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          {formatDate(row.date)}
                          {row.date === todayStr && <Badge variant="default" className="text-[9px] py-0 h-4">HOJE</Badge>}
                        </div>
                        {row.notes && <span className="text-[10px] text-muted-foreground italic flex items-center gap-1 mt-0.5"><MessageSquare size={8} /> {row.notes}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Building2 size={12} />{row.account_name}</div></td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium amount-value">{formatCurrency(row.platform_balance)}</td>
                    <td className="px-4 py-2 text-right tabular-nums" onClick={(e) => { e.stopPropagation(); !isFuture && (!editing || editing.date !== row.date || editing.accId !== row.account_id) && setEditing({ date: row.date, accId: row.account_id, value: row.external_balance || 0, notes: row.notes || "" }) }}>
                      {editing?.date === row.date && editing?.accId === row.account_id ? (
                        <div className="flex flex-col gap-1 items-end" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <MoneyInput
                              value={editing.value}
                              onValueChange={(val) => setEditing({ ...editing, value: val })}
                              className="w-24 h-7 text-xs text-right"
                              autoFocus
                            />
                            <button onClick={(e) => { e.stopPropagation(); saveBalance(row.date, row.account_id, editing.value, editing.notes) }} className="p-1 text-success hover:bg-success/10 rounded"><Save size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setEditing(null) }} className="p-1 text-muted-foreground hover:bg-muted rounded"><XCircle size={14} /></button>
                          </div>
                          <input
                            type="text" value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })}
                            placeholder="Obs..." className="w-32 text-[10px] bg-muted border border-border rounded px-1.5 py-0.5 outline-none"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 justify-end group/edit">
                          <span className="font-bold amount-value">{row.external_balance !== null ? formatCurrency(row.external_balance) : "—"}</span>
                          {!isFuture && (
                            <button onClick={(e) => { e.stopPropagation(); setEditing({ date: row.date, accId: row.account_id, value: row.external_balance || "", notes: row.notes || "" }) }} className="opacity-0 group-hover/edit:opacity-100 p-1 hover:bg-accent rounded"><PencilIcon /></button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums font-bold amount-value ${diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground opacity-50"}`}>
                      {row.external_balance !== null ? formatCurrency(diff) : ""}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {isMatch && <Badge variant="success" className="gap-1 bg-success/10 text-success"><CheckCircle2 size={10} /> Conciliado</Badge>}
                      {isError && <Badge variant="destructive" className="gap-1 bg-destructive/10 text-destructive"><XCircle size={10} /> Divergente</Badge>}
                      {isMissing && <Badge variant="warning" className="gap-1 bg-yellow-500/10 text-yellow-600"><AlertTriangle size={10} /> Pendente</Badge>}
                      {isFuture && <Badge variant="secondary" className="gap-1 opacity-50"><Filter size={10} /> Futura</Badge>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border bg-card">
            <p className="text-xs text-muted-foreground">Página {page} de {totalPages} ({filteredData.length} dias)</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próximo</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showBatchModal} onClose={() => setShowBatchModal(false)} title="Conciliação em Lote">
        <div className="space-y-4">
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
            <p className="text-sm font-medium">Você está conciliando <strong className="text-primary">{selectedKeys.size}</strong> registros selecionados.</p>
            <p className="text-xs text-muted-foreground mt-1">O saldo plataforma de cada dia será replicado como o saldo real.</p>
          </div>
          <FormField label="Observação Geral (opcional)">
            <textarea
              value={batchNote}
              onChange={e => setBatchNote(e.target.value)}
              placeholder="Ex: Auditoria semanal realizada..."
              className="w-full min-h-[100px] bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-sans"
            />
          </FormField>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={finishConciliate}>Confirmar Conciliação</Button>
            <Button variant="outline" onClick={() => setShowBatchModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function PencilIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
}
