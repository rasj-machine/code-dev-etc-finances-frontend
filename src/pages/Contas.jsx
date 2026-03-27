import { useState, useEffect, useMemo } from "react"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Badge, MoneyInput } from "@/components/ui"
import { Dialog, FormField } from "@/components/Dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useApi } from "@/lib/useApi"
import { ArrowLeft, Plus, Pencil, Trash2, Building2, Bitcoin, Wallet, TrendingUp, TrendingDown, AlertTriangle, ArrowUp, ArrowDown, ArrowRight, Banknote } from "lucide-react"
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area,
} from "recharts"

const TYPES = ["bank", "wallet", "crypto"]
const TYPE_LABELS = { bank: "Banco", wallet: "Carteira", crypto: "Crypto" }
const TYPE_ICONS = { bank: Building2, wallet: Wallet, crypto: Bitcoin }
const TYPE_BADGE = { bank: "default", wallet: "secondary", crypto: "warning" }
const emptyForm = { name: "", type: "bank", balance: "", institution: "", currency: "BRL" }

const fmtK = (v) => `R$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + "k" : Number(v).toFixed(0)}`

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-bold amount-value">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function lastNMonths(n = 12) {
  const result = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return result
}

export default function Contas() {
  const api = useApi()

  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [tfOrigin, setTfOrigin] = useState("")
  const [tfDest, setTfDest] = useState("")

  const load = async () => {
    const [accs, txns] = await Promise.all([
      api.get("/api/accounts").catch(() => []),
      api.get("/api/transactions").catch(() => []),
    ])
    setAccounts(Array.isArray(accs) ? accs : [])
    setTransactions(Array.isArray(txns) ? txns : [])
  }

  useEffect(() => { load() }, [api.get]) // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setForm(emptyForm); setEditing(null); setOpen(true) }
  const openEdit = (a) => { setForm({ ...a, balance: String(a.balance) }); setEditing(a.id); setOpen(true) }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = { ...form, balance: parseFloat(form.balance) || 0 }
      if (editing) {
        await api.put(`/api/accounts/${editing}`, body)
      } else {
        await api.post("/api/accounts", body)
      }
      setOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    await api.del(`/api/accounts/${id}`)
    setDeleting(null)
    await load()
  }

  const syncAccount = async (id) => {
    await api.post(`/api/accounts/${id}/sync`, {})
    await load()
  }

  // ── Financial calculations (unchanged) ───────────────────────
  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + a.balance, 0), [accounts])
  const [accountMapData, setAccountMap] = useState({})

  const { totalIncome, totalExpense, totalTransferSent, perAccount, monthlyData } = useMemo(() => {
    let tIncome = 0, tExpense = 0, tTsent = 0
    const accountMap = {};
    const months = lastNMonths(12)
    const byMonth = {}
    for (const m of months) byMonth[m] = { month: m, income: 0, expense: 0 }

    for (const t of transactions) {
      const { type, amount, raw_amount: rawAmt, account_id: accId, destination_account_id: destAccId, date } = t
      const val = amount || 0
      const rawVal = rawAmt || 0
      const mKey = date?.slice(0, 7)

      if (type === "income") tIncome += val
      else if (type === "expense") tExpense += val
      else if (type === "transfer" || type === "transfer_out" || type === "transfer_in") {
        if (type === "transfer_out" || (type === "transfer" && rawVal < 0)) tTsent += Math.abs(rawVal)
      }

      if (accId) {
        if (!accountMap[accId]) accountMap[accId] = { name: accounts.find(a => a.id === accId)?.name || accId, receives_total: 0, sends_total: 0, income: 0, expense: 0, count: 0, sends: {}, receives: {}, transfers: 0, transfer_sent: 0, transfer_recv: 0, trans_sent_ref: {}, trans_sent_ref_total: 0, trans_recv_ref: {}, trans_recv_ref_total: 0 }
        if (destAccId && !accountMap[destAccId]) accountMap[destAccId] = { name: accounts.find(a => a.id === destAccId)?.name || destAccId, receives_total: 0, sends_total: 0, income: 0, expense: 0, count: 0, sends: {}, receives: {}, transfers: 0, transfer_sent: 0, transfer_recv: 0, trans_sent_ref: {}, trans_sent_ref_total: 0, trans_recv_ref: {}, trans_recv_ref_total: 0 }
        const acc = accountMap[accId]
        acc.count++
        if (type === "income") acc.income += val
        else if (type === "expense") acc.expense += val
        else if (type === "transfer" || type === "transfer_out" || type === "transfer_in") {
          if (type === "transfer_out") {
            acc.transfer_sent += Math.abs(rawVal)
            acc.transfers -= Math.abs(rawVal);
            accountMap[accId].sends[destAccId] = (accountMap[accId].sends[destAccId] || 0) + Math.abs(rawVal)
            accountMap[accId].sends_total += Math.abs(rawVal)
            if (destAccId) {
              // accountMap[destAccId].transfer_recv += Math.abs(rawVal);
              accountMap[destAccId].trans_sent_ref[accId] = (accountMap[destAccId].trans_sent_ref[accId] || 0) + Math.abs(rawVal)
              accountMap[destAccId].trans_sent_ref_total += Math.abs(rawVal)
              // accountMap[destAccId].count++
            }
          } else if (type === "transfer_in") {
            acc.transfer_recv += Math.abs(rawVal)
            acc.transfers += Math.abs(rawVal);
            accountMap[accId].receives[destAccId] = (accountMap[accId].receives[destAccId] || 0) + Math.abs(rawVal)
            accountMap[accId].receives_total += Math.abs(rawVal)
            if (destAccId) {
              // accountMap[destAccId].transfer_sent += Math.abs(rawVal);
              accountMap[destAccId].trans_recv_ref[accId] = (accountMap[destAccId].trans_recv_ref[accId] || 0) + Math.abs(rawVal)
              accountMap[destAccId].trans_recv_ref_total += Math.abs(rawVal)
              // accountMap[destAccId].count++
            }
          }
        }
      }

      if (byMonth[mKey]) {
        if (type === "income") byMonth[mKey].income += val
        else if (type === "expense") byMonth[mKey].expense += val
        else if (type === "transfer") {
          if (rawVal > 0) byMonth[mKey].income += rawVal
          else byMonth[mKey].expense += Math.abs(rawVal)
        }
      }
    }

    let cumulative = 0
    const processedMonthly = months.map(m => {
      cumulative += byMonth[m].income - byMonth[m].expense
      return { ...byMonth[m], balance: cumulative }
    })

    setAccountMap(accountMap)
    return { totalIncome: tIncome, totalExpense: tExpense, totalTransferSent: tTsent, perAccount: accountMap, monthlyData: processedMonthly }
  }, [transactions])

  const netResult = totalIncome - totalExpense

  // ── Transfer flow matrix ─────────────────────────────────────────
  const transferFlows = useMemo(() => {
    const flows = [] // { from, fromName, to, toName, amount }
    for (const t of transactions) {
      if (t.type !== 'transfer_out') continue
      const from = t.account_id
      const to = t.destination_account_id
      if (!from || !to) continue
      const existing = flows.find(f => f.from === from && f.to === to)
      const amt = Math.abs(t.raw_amount || t.amount || 0)
      if (existing) existing.amount += amt
      else flows.push({
        from, to, amount: amt,
        fromName: accounts.find(a => a.id === from)?.name || String(from),
        toName: accounts.find(a => a.id === to)?.name || String(to),
      })
    }
    return flows.sort((a, b) => b.amount - a.amount)
  }, [transactions, accounts])

  const filteredFlows = useMemo(() =>
    transferFlows.filter(f =>
      (!tfOrigin || String(f.from) === tfOrigin) &&
      (!tfDest   || String(f.to)   === tfDest)
    ), [transferFlows, tfOrigin, tfDest])

  const tfTotalAportes = useMemo(() =>
    transactions.filter(t => t.type === 'transfer_in' && (!tfDest || String(t.account_id) === tfDest) && (!tfOrigin || String(t.destination_account_id) === tfOrigin))
      .reduce((s, t) => s + Math.abs(t.raw_amount || t.amount || 0), 0)
  , [transactions, tfOrigin, tfDest])

  const tfTotalRetiradas = useMemo(() =>
    transactions.filter(t => t.type === 'transfer_out' && (!tfOrigin || String(t.account_id) === tfOrigin) && (!tfDest || String(t.destination_account_id) === tfDest))
      .reduce((s, t) => s + Math.abs(t.raw_amount || t.amount || 0), 0)
  , [transactions, tfOrigin, tfDest])

  return (
    <div className="space-y-6 animate-fade-in" id="accounts">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold">Contas &amp; Carteiras</h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
            Saldo total: <span className="text-foreground font-semibold amount-value">{formatCurrency(totalBalance)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => location.href = '#overview'} className="hover:bg-accent hover:border-primary/50 hover:text-primary">
            <ArrowDown className="w-3 h-3" /> Controle
          </Button>
          <Button variant="outline" size="sm" onClick={() => location.href = '#transfers'} className="hover:bg-accent hover:border-primary/50 hover:text-primary">
            <ArrowDown className="w-3 h-3" /> Transferências
          </Button>
          <Button variant="outline" size="sm" onClick={() => location.href = '#follow'} className="hover:bg-accent hover:border-primary/50 hover:text-primary">
            <ArrowDown className="w-3 h-3" /> Acompanhamento
          </Button>
          <div className="w-px h-8 bg-border/60 mx-1" />
          <Button onClick={openCreate} size="sm"><Plus size={16} /> Nova Conta</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 pb-5">
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Receitas (todo período)</p>
          <p className="text-2xl font-bold text-success amount-value">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-muted-foreground mt-1">{transactions.filter(t => t.type === "income").length} transacoes</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Despesas (todo período)</p>
          <p className="text-2xl font-bold text-destructive amount-value">{formatCurrency(totalExpense)}</p>
          <p className="text-xs text-muted-foreground mt-1">{transactions.filter(t => t.type === "expense").length} transacoes</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Resultado Líquido</p>
          <p className={`text-2xl font-bold amount-value ${netResult >= 0 ? "text-success" : "text-destructive"}`}>
            {formatCurrency(netResult)} {netResult > 0 ? "👍" : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{transactions.length} transações no total</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Transferências</p>
          <p className="text-2xl font-bold text-primary amount-value">{formatCurrency(totalTransferSent)}</p>
          <p className="text-xs text-muted-foreground mt-1">Entre minhas contas</p>
        </CardContent></Card>
      </div>

      <hr className="border-border/60 flex w-full" />

      {/* Account Cards */}
      <div id="overview" className="pt-5">
        <div className="flex justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Controle de contas</h2>
          <Button variant="outline" size="sm" onClick={() => location.href = '#follow'} className="hover:bg-accent hover:border-primary/50 hover:text-primary">
            <ArrowDown className="w-3 h-3" /> Acompanhamento
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map(a => {
            const Icon = TYPE_ICONS[a.type] || Wallet
            const stats = perAccount[a.id] || { income: 0, expense: 0, count: 0, transfers: 0, transfer_sent: 0, transfer_recv: 0 }
            return (
              <Card key={a.id} className="hover:-translate-y-1 transition-transform duration-300">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon size={18} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.institution || "—"}</p>
                      </div>
                    </div>
                    <Badge variant={TYPE_BADGE[a.type]}>{TYPE_LABELS[a.type]}</Badge>
                  </div>

                  <div className="mb-4">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Última Conciliação Manual</p>
                    <p className={`text-xs font-semibold ${a.last_recon_date && (new Date() - new Date(a.last_recon_date)) / 86400000 > 2 ? "text-destructive" : a.last_recon_date ? "text-foreground" : "text-amber-500"}`}>
                      {a.last_recon_date ? formatDate(a.last_recon_date) : "Nunca conciliada"}
                    </p>
                  </div>

                  <p className="text-2xl font-bold text-foreground amount-value">{formatCurrency(a.balance + stats.transfers)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">NET {a.currency} (in + transfer_in - out - transfer_out)</p>

                  {stats.count > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/60">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground font-medium">Receitas (in)</p>
                          <p className="text-sm font-bold text-success tabular-nums">{formatCurrency(stats.income)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground font-medium">Despesas (out)</p>
                          <p className="text-sm font-bold text-destructive tabular-nums">{formatCurrency(stats.expense)}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[9px] uppercase text-muted-foreground">Transferencias</p>
                        <p className="text-xs font-bold text-primary">{formatCurrency(stats.transfers)}</p>
                      </div>
                      <div className="bg-blue-500/5 mt-10 p-2">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          <div className=" col-span-2">
                            <span>Aportes <small>(Transf Entradas):</small></span>
                            <hr />
                            <p className="text-[9px] uppercase text-muted-foreground">Transf. conciliado destino (transfer in from ref): <p className="text-xs font-bold text-primary">{formatCurrency(stats.transfer_recv)}</p>
                              <small>Está cadastrado como transferencia enviada no banco da tabela abaixo, com destino para este banco:</small>
                            </p>

                            <hr />
                            {stats?.trans_sent_ref && Object.keys(stats?.trans_sent_ref).length > 0 && (
                              <table className="w-full mt-2 text-xs">
                                <tr>
                                  <td><strong>Banco:</strong></td>
                                  <td className="text-right"><strong>Valor</strong></td>
                                </tr>
                                {Object.keys(stats?.trans_sent_ref || {}).map(t => (
                                  <tr key={t} className="hover:bg-blue-700">
                                    <td className="flex align-middle items-center">{accountMapData[t]?.name} <ArrowRight size={12} /> <Building2 size={12} /></td>
                                    <td className="text-right">+{formatCurrency(stats?.trans_sent_ref[t])}</td>
                                  </tr>
                                ))}
                              </table>)}

                            <p className="border-t text-xs font-bold text-amber-500 ml-auto block text-right">
                              +{formatCurrency(stats.trans_sent_ref_total)}

                            </p>
                          </div>

                          <div className="text-center w-full col-span-2 text-xs opacity-50 flex justify-center align-center items-center flex-col">
                            <ArrowUp size={12} />
                            <div>(valores devem bater)</div>
                            <ArrowDown size={12} />
                          </div>
                          <div className="col-span-2 mt-2">
                            <hr />
                            <p className="text-[9px] uppercase text-muted-foreground">Transf. recebidos: {Object.keys(stats?.receives).length}
                              <p className="text-xs font-bold text-primary">{formatCurrency(stats.receives_total)}</p>
                              <small>Está cadastrado como transferencia recebida neste banco, com origem do banco abaixo:</small>
                            </p>

                            <hr />
                            {stats?.receives && Object.keys(stats?.receives).length > 0 && (
                              <table className="w-full mt-2 text-xs">
                                <tr>
                                  <td><strong>Banco:</strong></td>
                                  <td className="text-right"><strong>Valor</strong></td>
                                </tr>
                                {Object.keys(stats?.receives || {}).map(t => (
                                  <tr key={t} className="hover:bg-blue-700">
                                    <td className="flex align-middle items-center">{accountMapData[t]?.name} <ArrowRight size={12} /> <Building2 size={12} /></td>
                                    <td className="text-right">+{formatCurrency(stats?.receives[t])}</td>
                                  </tr>
                                ))}
                              </table>)}



                            <p className="border-t text-xs font-bold text-amber-500 ml-auto block text-right">
                              +{formatCurrency(stats.receives_total)}
                            </p>
                          </div>

                        </div>
                        {stats.trans_sent_ref_total != stats.transfer_recv && (
                          <><br /><span className="text-red-500">Faltando declarar: {formatCurrency(stats.transfer_recv - stats.trans_sent_ref_total)}</span>
                            <br /><small>Precisa cadastrar alguma transf.</small>
                          </>
                        )}
                      </div>
                      <div className="bg-blue-500/5 mt-10 p-2">

                        <span className="mt-20">Retiradas <small>(Transf Saidas):</small></span>
                        <div className="col-span-2">
                          <hr />
                          <p className="text-[9px] uppercase text-muted-foreground">Transf. conciliado origem (transfer out from ref): <p className="text-xs font-bold text-primary">-{formatCurrency(stats.transfer_sent)}</p>
                            <small>Está cadastrado como transferencia recebida no banco da tabela abaixo, com origem deste banco:</small>
                          </p>
                          <hr />

                          {stats?.trans_recv_ref && Object.keys(stats?.trans_recv_ref).length > 0 && (
                            <table className="w-full mt-2 text-xs">
                              <tr>
                                <td><strong>Banco:</strong></td>
                                <td className="text-right"><strong>Valor</strong></td>
                              </tr>
                              {Object.keys(stats?.trans_recv_ref || {}).map(t => (
                                <tr key={t} className="hover:bg-blue-700">
                                  <td className="flex align-middle items-center"><Building2 size={12} /> <ArrowRight size={12} /> {accountMapData[t]?.name}</td>
                                  <td className="text-right">-{formatCurrency(stats?.trans_recv_ref[t])}</td>
                                </tr>
                              ))}
                            </table>)}

                          <p className="border-t text-xs font-bold text-amber-500 ml-auto block text-right">
                            -{formatCurrency(stats.trans_recv_ref_total)}

                          </p>
                        </div>

                        <div className="text-center w-full col-span-2 text-xs opacity-50 flex justify-center align-center items-center flex-col">
                          <ArrowUp size={12} />
                          <div>(valores devem bater)</div>
                          <ArrowDown size={12} />
                        </div>

                        <div className="col-span-2 mt-2">
                          <hr />
                          <p className="text-[9px] uppercase text-muted-foreground">Transf. enviados: {Object.keys(stats?.sends).length}
                            <p className="text-xs font-bold text-primary">-{formatCurrency(stats.sends_total)}</p>
                            <small>Está cadastrado como transferencia enviada neste banco, com destino para o baixo abaixo:</small>
                          </p>
                          <hr />
                          {stats?.sends && Object.keys(stats?.sends).length > 0 && (
                            <table className="w-full mt-2 text-xs">
                              <tr>
                                <td><strong>Banco:</strong></td>
                                <td className="text-right"><strong>Valor</strong></td>
                              </tr>
                              {Object.keys(stats?.sends || {}).map(t => (
                                <tr key={t} className="hover:bg-blue-700">
                                  <td className="flex align-middle items-center"><Building2 size={12} /> <ArrowRight size={12} /> {accountMapData[t]?.name}</td>
                                  <td className="text-right">-{formatCurrency(stats?.sends[t])}</td>
                                </tr>
                              ))}
                            </table>)}


                          <p className="border-t text-xs font-bold text-amber-500 ml-auto block text-right">
                            -{formatCurrency(stats.sends_total)}
                          </p>
                        </div>

                        {stats.trans_recv_ref_total != stats.transfer_sent && (
                          <><br /><span className="text-red-500">Faltando declarar: {formatCurrency(stats.transfer_sent - stats.trans_recv_ref_total)}</span>
                            <br /><small>Precisa cadastrar alguma transf.</small>
                          </>

                        )}

                      </div>







                      {Math.abs(a.balance - (stats.income - stats.expense)) > 0.01 && (
                        <div className="p-2 border border-amber-500/30 bg-amber-500/5 rounded-lg flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 text-amber-500">
                            <AlertTriangle size={12} />
                            <span className="text-[10px] font-medium leading-none">
                              Saldo divergente das transações.<br /><br />
                              Na conta: R$ {a.balance.toFixed(2)}<br />
                              Transações: R$ {(stats.income - stats.expense + stats.transfers).toFixed(2)}<br /><br />
                              Diferença: <u><strong>R$ {(a.balance - (stats.income - stats.expense)).toFixed(2)}</strong></u>
                            </span>
                          </div>
                          <button onClick={() => syncAccount(a.id)}
                            className="text-[10px] font-bold text-amber-500 hover:text-amber-600 underline whitespace-nowrap">
                            Sincronizar
                          </button>
                        </div>
                      )}

                      <p className="text-[10px] border-t border-border/60 mt-3 pt-2 text-muted-foreground italic">
                        {stats.count} transacoes registrados
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openEdit(a)}>
                      <Pencil size={12} /> Editar
                    </Button>
                    <Button size="sm" variant="destructive" className="h-8 px-2" onClick={() => setDeleting(a)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {accounts.length === 0 && (
            <div className="col-span-3 text-center py-20 text-muted-foreground">
              Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.
            </div>
          )}
        </div>
      </div>

      {/* ── Transferências Section ────────────────────────────────────── */}
      <div id="transfers" className="pt-2">
        <hr className="border-border/60 mb-8" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Transferências entre Contas</h2>
          <Button variant="outline" size="sm" onClick={() => location.href = '#accounts'} className="hover:bg-accent hover:border-primary/50 hover:text-primary">
            <ArrowUp className="h-3 w-3" /> Voltar ao topo
          </Button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Aportes (Entradas)</p>
              <p className="text-2xl font-bold text-success amount-value">+{formatCurrency(tfTotalAportes)}</p>
              <p className="text-xs text-muted-foreground mt-1">transfer_in recebidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Retiradas (Saídas)</p>
              <p className="text-2xl font-bold text-destructive amount-value">-{formatCurrency(tfTotalRetiradas)}</p>
              <p className="text-xs text-muted-foreground mt-1">transfer_out enviados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Saldo do Filtro</p>
              <p className={`text-2xl font-bold amount-value ${tfTotalAportes - tfTotalRetiradas >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(tfTotalAportes - tfTotalRetiradas)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">aportes − retiradas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Conta Origem</label>
            <Select value={tfOrigin} onChange={e => setTfOrigin(e.target.value)} className="h-9 text-sm">
              <option value="">Todas as origens</option>
              {accounts.map(a => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
            </Select>
          </div>
          <div className="flex items-center pb-1.5">
            <ArrowRight size={16} className="text-muted-foreground" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Conta Destino</label>
            <Select value={tfDest} onChange={e => setTfDest(e.target.value)} className="h-9 text-sm">
              <option value="">Todos os destinos</option>
              {accounts.map(a => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
            </Select>
          </div>
          {(tfOrigin || tfDest) && (
            <Button variant="outline" size="sm" onClick={() => { setTfOrigin(""); setTfDest("") }} className="mb-0">
              Limpar
            </Button>
          )}
        </div>

        {/* Flow matrix table */}
        <Card>
          <CardContent className="p-0">
            {filteredFlows.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                Nenhuma transferência encontrada para o filtro selecionado.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Origem</th>
                    <th className="text-center px-2 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground w-6"></th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Destino</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Total Transferido</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">%</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFlows.map((f, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer"
                      onClick={() => { setTfOrigin(String(f.from)); setTfDest(String(f.to)) }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 size={11} className="text-primary" />
                          </div>
                          <span className="font-medium">{f.fromName}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <ArrowRight size={14} className="text-muted-foreground mx-auto" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                            <Building2 size={11} className="text-success" />
                          </div>
                          <span className="font-medium">{f.toName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums amount-value text-primary">
                        {formatCurrency(f.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">
                        {tfTotalRetiradas > 0 ? ((f.amount / tfTotalRetiradas) * 100).toFixed(1) + '%' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/60 bg-accent/20">
                    <td colSpan={3} className="px-4 py-2.5 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      Total ({filteredFlows.length} {filteredFlows.length === 1 ? 'fluxo' : 'fluxos'})
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-primary tabular-nums amount-value">
                      {formatCurrency(filteredFlows.reduce((s, f) => s + f.amount, 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">100%</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="space-y-4">
        <hr className="border-border/60 my-12" />
        <div className="flex justify-between" id="follow">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Acompanhamento das contas</h2>
          <Button variant="outline" size="sm" onClick={() => location.href = '#accounts'} className="hover:bg-accent hover:border-primary/50 hover:text-primary">
            <ArrowUp className="h-3 w-3" /> Contas &amp; Carteiras
          </Button>
        </div>

        {monthlyData.length > 0 && (
          <div className="space-y-4">
            <Card><CardHeader className="pb-2">
              <CardTitle className="text-sm">Saldo Acumulado (fluxo líquido) — últimos 12 meses</CardTitle>
            </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="gBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2.5}
                      fill="url(#gBalance)" name="Saldo Acumulado" dot={{ r: 3, fill: "#6366f1" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card><CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp size={14} className="text-success" /> Receita Mensal — últimos 12 meses
                </CardTitle>
              </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={monthlyData}>
                      <defs><linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2.5}
                        fill="url(#gIncome)" name="Receita" dot={{ r: 3, fill: "#22c55e" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card><CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingDown size={14} className="text-destructive" /> Despesa Mensal — últimos 12 meses
                </CardTitle>
              </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={monthlyData}>
                      <defs><linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2.5}
                        fill="url(#gExp)" name="Despesa" dot={{ r: 3, fill: "#ef4444" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Editar Conta" : "Nova Conta"}>
        <form onSubmit={save} className="space-y-4">
          <FormField label="Nome da Conta">
            <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nubank, Inter, Binance..." />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tipo">
              <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </Select>
            </FormField>
            <FormField label="Moeda">
              <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="BTC">BTC</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Instituição / Corretora">
            <Input value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} placeholder="Nubank, XP, Binance..." />
          </FormField>
          <FormField label="Saldo Atual (R$)">
            <MoneyInput required value={form.balance} onValueChange={val => setForm(f => ({ ...f, balance: val }))} placeholder="0.00" />
          </FormField>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar" : "Criar"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Excluir Conta">
        <p className="text-muted-foreground mb-4">Tem certeza que deseja excluir <strong>{deleting?.name}</strong>?</p>
        <div className="flex gap-3">
          <Button variant="destructive" className="flex-1" onClick={() => remove(deleting.id)}>Excluir</Button>
          <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
        </div>
      </Dialog>
    </div >
  )
}
