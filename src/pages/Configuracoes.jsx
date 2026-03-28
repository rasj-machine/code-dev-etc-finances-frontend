import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Switch, Select } from "@/components/ui"
import { Badge, Shield, ShieldOff, Plus, Trash2, Save, Info, Sparkles, Globe, Lock, KeyRound } from "lucide-react"
import { useTranslation } from "@/context/LanguageContext"
import { useNotification } from "@/context/NotificationContext"

export default function Configuracoes() {
  const { lang, setLang, t } = useTranslation()
  const { alert, confirm, toast } = useNotification()
  const [config, setConfig] = useState({ redaction_enabled: "0", invoice_day: "15", credit_invoice_category: "Fatura Cartão" })
  const [redactedTexts, setRedactedTexts] = useState([])
  const [newText, setNewText] = useState("")
  const [loading, setLoading] = useState(true)
  const [pinForm, setPinForm] = useState({ old_pin: "", new_pin: "" })
  const [formatSettings, setFormatSettings] = useState(() => {
    const s = JSON.parse(localStorage.getItem('user_settings') || '{"locale":"pt-BR","currency":"BRL"}')
    return s
  })

  const load = async () => {
    try {
      const [cfgRes, rulesRes] = await Promise.all([
        fetch("/api/config"),
        fetch("/api/redacted-texts")
      ])
      const cfg = cfgRes.ok ? await cfgRes.json() : {}
      const rules = rulesRes.ok ? await rulesRes.json() : []
      
      setConfig(prev => ({ ...prev, ...cfg }))
      setRedactedTexts(Array.isArray(rules) ? rules : [])
    } catch (err) {
       console.error("Erro ao carregar configurações:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggleRedaction = async () => {
    const newValue = config.redaction_enabled === "1" ? "0" : "1"
    const newConfig = { ...config, redaction_enabled: newValue }
    setConfig(newConfig)
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redaction_enabled: newValue })
    })
  }

  const addText = async (e) => {
    e.preventDefault()
    if (!newText.trim()) return
    await fetch("/api/redacted-texts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newText.trim() })
    })
    setNewText("")
    load()
  }

  const deleteText = async (id) => {
    await fetch(`/api/redacted-texts/${id}`, { method: "DELETE" })
    load()
  }

  const autoDiscover = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/redacted-texts/auto-discover", { method: "POST" })
      const data = await res.json()
      toast(`${data.added_count} novos textos de transferências detectados!`, "success")
      load()
    } catch(err) {
      console.error(err)
      alert("error", "Erro ao processar auto-redação.")
      setLoading(false)
    }
  }

  const doPermanentRedact = async () => {
    const ok = await confirm("ATENÇÃO: Isso irá substituir permanentemente as descrições das transações no banco de dados pelas versões redigidas. As versões originais serão mantidas no campo raw_description para backup. Deseja continuar?")
    if (!ok) return
    
    setLoading(true)
    try {
      const res = await fetch("/api/redacted-texts/permanently-redact", { method: "POST" })
      const data = await res.json()
      alert("success", data.message, "Sucesso")
      load()
    } catch(err) {
      console.error(err)
      alert("error", "Erro ao processar redação permanente.")
      setLoading(false)
    }
  }

  const saveFormat = () => {
    localStorage.setItem('user_settings', JSON.stringify(formatSettings))
    toast("Configurações de exibição salvas!", "success")
    setTimeout(() => window.location.reload(), 500)
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando configurações...</div>

  const isEnabled = config.redaction_enabled === "1"

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
          <p className="text-muted-foreground text-sm">Gerencie sua privacidade e preferências do sistema</p>
        </div>
      </div>

      {/* Row 1: Quick Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2"><Globe size={14}/> {t('settings.language')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={lang} onChange={e => setLang(e.target.value)}>
                <option value="en">🇺🇸 English</option>
                <option value="pt">🇧🇷 Português</option>
                <option value="es">🇪🇸 Español</option>
              </Select>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest px-1">Preferência de Crédito</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-muted-foreground mb-2">Dia de vencimento da fatura</p>
              <div className="flex gap-2">
                <Input 
                  type="number" min="1" max="31"
                  value={config.invoice_day || "15"} 
                  onChange={e => setConfig(prev => ({...prev, invoice_day: e.target.value}))}
                  className="h-9 text-sm"
                />
                <Button size="sm" onClick={async () => {
                   await fetch("/api/config", {
                     method: "POST",
                     headers: { "Content-Type": "application/json" },
                     body: JSON.stringify({ invoice_day: config.invoice_day })
                   })
                   toast("Salvo!", "success")
                }}>Salvar</Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 mb-2">Categoria que representa fatura de cartão</p>
              <div className="flex gap-2">
                <Input
                  value={config.credit_invoice_category || "Fatura Cartão"}
                  onChange={e => setConfig(prev => ({...prev, credit_invoice_category: e.target.value}))}
                  className="h-9 text-sm"
                  placeholder="Fatura Cartão"
                />
                <Button size="sm" onClick={async () => {
                   await fetch("/api/config", {
                     method: "POST",
                     headers: { "Content-Type": "application/json" },
                     body: JSON.stringify({ credit_invoice_category: config.credit_invoice_category })
                   })
                   toast("Salvo!", "success")
                }}>Salvar</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest px-1">Formato de Moeda</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="flex gap-2">
                 <Input value={formatSettings.locale} onChange={e => setFormatSettings(s => ({...s, locale: e.target.value}))} className="h-9 text-xs" title="Locale (ex: pt-BR)"/>
                 <Input value={formatSettings.currency} onChange={e => setFormatSettings(s => ({...s, currency: e.target.value}))} className="h-9 text-xs" title="Moeda (ex: BRL)"/>
                 <Button size="sm" onClick={saveFormat}><Save size={14}/></Button>
               </div>
            </CardContent>
          </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PIN Management */}
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Lock size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">PIN de Privacidade</CardTitle>
                <p className="text-xs text-muted-foreground">Senha de 6 dígitos para o modo oculto</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">PIN Atual (se houver)</label>
                      <Input 
                        type="password" maxLength={6} placeholder="******" 
                        value={pinForm.old_pin}
                        onChange={e => setPinForm(v => ({...v, old_pin: e.target.value}))}
                        className="h-10 text-center tracking-[0.5em] font-mono"
                      />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Novo PIN</label>
                      <Input 
                        type="password" maxLength={6} placeholder="******"
                        value={pinForm.new_pin}
                        onChange={e => setPinForm(v => ({...v, new_pin: e.target.value}))}
                        className="h-10 text-center tracking-[0.5em] font-mono border-primary/30"
                      />
                   </div>
                </div>
                <Button className="w-full gap-2" onClick={async () => {
                   if (pinForm.new_pin && pinForm.new_pin.length !== 6) return alert("error", "O novo PIN deve ter 6 dígitos.")
                   const res = await fetch("/api/auth/pin/set", {
                     method: "POST",
                     headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem('auth_token')}` },
                     body: JSON.stringify(pinForm)
                   })
                   const data = await res.json()
                   if (data.status === 'success') {
                     toast("PIN atualizado com sucesso!", "success")
                     setPinForm({ old_pin: "", new_pin: "" })
                   } else {
                     alert("error", data.message)
                   }
                }}>
                   <KeyRound size={16} /> Definir / Redefinir PIN
                </Button>
                <p className="text-[10px] text-center text-muted-foreground italic">Deixe o "Novo PIN" vazio para remover a senha.</p>
             </div>
          </CardContent>
        </Card>

        <Card className={`border-2 transition-all duration-500 ${isEnabled ? "border-primary/20 shadow-lg shadow-primary/5" : "border-border"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isEnabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {isEnabled ? <Shield size={20} /> : <ShieldOff size={20} />}
                </div>
                <div>
                  <CardTitle className="text-lg">Modo Redacted</CardTitle>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isEnabled} onCheckedChange={toggleRedaction} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 pb-2">
                 <Button variant="outline" size="xs" onClick={autoDiscover} className="text-[10px] h-7 gap-1">
                    <Sparkles size={12}/> Auto Redação
                 </Button>
                 <Button variant="warning" size="xs" onClick={doPermanentRedact} className="text-[10px] h-7 gap-1">
                    <Shield size={12}/> Redação Permanente
                 </Button>
              </div>
              <form onSubmit={addText} className="flex gap-2">
                <Input
                  placeholder="Novo texto..."
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  className="h-9 text-sm"
                />
                <Button type="submit" size="sm" className="gap-2 shrink-0">
                  <Plus size={14} />
                </Button>
              </form>

              <div className="max-h-[140px] overflow-y-auto space-y-1 pr-2">
                {redactedTexts.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between p-1.5 pl-3 bg-card border border-border rounded-lg group hover:border-primary/30 transition-colors">
                    <span className="text-xs font-medium truncate max-w-[200px]">{rule.text}</span>
                    <button onClick={() => deleteText(rule.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-primary/5 border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Por que usar?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-xs space-y-2 text-muted-foreground list-disc pl-4 leading-relaxed">
                <li><strong>Privacidade em reuniões</strong>: Mostre dashboards sem expor nomes confidenciais.</li>
                <li><strong>Segurança de Dados</strong>: Evite que nomes sensíveis fiquem visíveis em capturas de tela.</li>
                <li><strong>Foco no Saldo</strong>: Mantenha a atenção nos números, não nos detalhes transacionais.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sobre Vincúlos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O sistema prioriza automaticamente o <strong>Nome de Visualização</strong> definido na tela de Vínculos. Se não houver um, o nome original é utilizado.
              </p>
            </CardContent>
          </Card>
      </div>
    </div>
  )
}
