import { useState, useEffect, useRef, useCallback } from "react"
import { useDatabase } from "@/context/DatabaseContext"
import { Button, Input } from "@/components/ui"
import {
  Bot, Send, Settings, Trash2, X, Database, ChevronDown, ChevronUp,
  Loader2, Copy, Check, MessageSquare, Zap, RotateCcw, AlertCircle,
  Table2, Code2, Sparkles,
} from "lucide-react"

// ── Simple markdown renderer (no heavy dependency) ─────────────
function Markdown({ text }) {
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-zinc-900 text-zinc-100 rounded-xl p-4 my-3 text-xs overflow-x-auto font-mono leading-relaxed">$1</pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-accent px-1.5 py-0.5 rounded text-xs font-mono text-primary">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 class="font-bold text-base mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-lg mt-5 mb-1">$2</h2>')
    .replace(/^# (.+)$/gm,  '<h1 class="font-bold text-xl mt-5 mb-1">$1</h1>')
    .replace(/^[-•] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>')
  return (
    <div
      className="prose-sm max-w-none leading-relaxed text-sm [&_pre]:my-3 [&_li]:my-0.5"
      dangerouslySetInnerHTML={{ __html: `<p class="mb-2">${html}</p>` }}
    />
  )
}

// ── Tool call card ─────────────────────────────────────────────
function ToolCallCard({ call }) {
  const [open, setOpen] = useState(false)
  const isQuery = call.name === 'query_database'
  const rows = call.result?.rows

  return (
    <div className="my-2 border border-border/60 rounded-xl overflow-hidden text-xs bg-background/50">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/40 transition-colors text-left">
        <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0
          ${call.result?.error ? "bg-destructive/20 text-destructive" : "bg-emerald-500/20 text-emerald-600"}`}>
          {isQuery ? <Database size={10} /> : <Zap size={10} />}
        </div>
        <span className="font-mono text-muted-foreground">
          {isQuery ? call.args?.reason || call.name : "Resumo financeiro"}
        </span>
        {call.result?.count !== undefined && !call.result?.error && (
          <span className="ml-auto text-emerald-600 font-medium">{call.result.count} linha{call.result.count !== 1 ? 's' : ''}</span>
        )}
        {call.result?.error && <span className="ml-auto text-destructive">Erro</span>}
        {open ? <ChevronUp size={11} className="shrink-0" /> : <ChevronDown size={11} className="shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border/60 p-3 space-y-2 bg-background/30">
          {call.args?.sql && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Code2 size={9} />SQL</p>
              <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-2 text-[10px] font-mono overflow-x-auto leading-relaxed">{call.args.sql}</pre>
            </div>
          )}
          {call.result?.error && (
            <div className="text-destructive bg-destructive/10 rounded-lg px-3 py-2">Erro: {call.result.error}</div>
          )}
          {rows && rows.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1"><Table2 size={9} />Resultado</p>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-[10px]">
                  <thead className="bg-accent/60">
                    <tr>{Object.keys(rows[0]).map(k => <th key={k} className="text-left px-2 py-1.5 font-medium text-muted-foreground uppercase tracking-wide">{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-border/40 hover:bg-accent/30">
                        {Object.values(r).map((v, j) => <td key={j} className="px-2 py-1 font-mono">{String(v ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 20 && <p className="text-center text-muted-foreground py-1 text-[9px]">+ {rows.length - 20} linhas omitidas</p>}
              </div>
            </div>
          )}
          {!rows && !call.result?.error && (
            <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-2 text-[10px] font-mono overflow-x-auto">
              {JSON.stringify(call.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────
function Message({ msg }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(msg.content || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (msg.role === 'user') return (
    <div className="flex justify-end gap-2 group">
      <div className="max-w-[78%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-md shadow-primary/10">
        {msg.content}
      </div>
    </div>
  )

  if (msg.role === 'assistant') return (
    <div className="flex gap-3 group">
      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-md shadow-primary/20 mt-0.5">
        <Bot size={14} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Tool calls */}
        {msg.toolCalls?.map(tc => <ToolCallCard key={tc.id} call={tc} />)}
        {/* Content */}
        {msg.content && (
          <div className="bg-card border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm relative">
            <Markdown text={msg.content} />
            <button onClick={copy}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-accent text-muted-foreground">
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return null
}

// ── Typing indicator ───────────────────────────────────────────
function Typing({ status }) {
  if (!status) return null
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
        <Bot size={14} className="text-white" />
      </div>
      <div className="bg-card border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-muted-foreground flex items-center gap-2.5">
        <Loader2 size={13} className="animate-spin text-primary" />
        <span>{status}</span>
      </div>
    </div>
  )
}

// ── Config panel (slide-in) ────────────────────────────────────
function ConfigPanel({ onClose, dbName }) {
  const [cfg, setCfg] = useState({
    ai_enabled: '0', ai_provider: 'openai', ai_model: 'gpt-4o-mini',
    ai_api_key: '', ai_base_url: '', ai_temperature: '0.3', ai_system_prompt: '',
  })
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/ai/config').then(r => r.json()).then(d => {
      setCfg(d)
      setKeyInput(d.ai_api_key || '')
    }).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    const body = { ...cfg, ai_api_key: keyInput }
    await fetch('/api/ai/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const PROVIDERS = [
    { id: 'openai',    label: 'OpenAI',     models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { id: 'anthropic', label: 'Anthropic',  models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'] },
    { id: 'groq',      label: 'Groq',       models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
    { id: 'ollama',    label: 'Ollama (local)', models: ['llama3.2', 'mistral', 'qwen2.5:7b'] },
    { id: 'custom',    label: 'Custom OpenAI-compatible', models: [] },
  ]
  const provider = PROVIDERS.find(p => p.id === cfg.ai_provider) || PROVIDERS[0]

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-[400px] h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles size={16} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm">Configurações de IA</p>
              <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{dbName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Enable toggle */}
          <label className="flex items-center justify-between p-4 rounded-xl border border-border bg-accent/30 cursor-pointer hover:bg-accent/60 transition-colors">
            <div className="flex items-center gap-3">
              <Bot size={18} className={cfg.ai_enabled === '1' ? "text-primary" : "text-muted-foreground"} />
              <div>
                <p className="font-semibold text-sm">{cfg.ai_enabled === '1' ? "IA Ativada" : "IA Desativada"}</p>
                <p className="text-[10px] text-muted-foreground">Ativar o assistente para este banco</p>
              </div>
            </div>
            <div className="relative">
              <input type="checkbox" className="sr-only"
                checked={cfg.ai_enabled === '1'}
                onChange={e => setCfg(c => ({ ...c, ai_enabled: e.target.checked ? '1' : '0' }))} />
              <div className={`w-10 h-6 rounded-full transition-colors ${cfg.ai_enabled === '1' ? "bg-primary" : "bg-border"}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-1 transition-transform
                  ${cfg.ai_enabled === '1' ? "translate-x-5" : "translate-x-1"}`} />
              </div>
            </div>
          </label>

          {/* Provider */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Provedor de IA</label>
            <div className="grid grid-cols-1 gap-1.5">
              {PROVIDERS.map(p => (
                <button key={p.id} onClick={() => setCfg(c => ({ ...c, ai_provider: p.id, ai_model: p.models[0] || c.ai_model }))}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm text-left transition-all
                    ${cfg.ai_provider === p.id ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40 text-foreground"}`}>
                  <span className="flex-1">{p.label}</span>
                  {cfg.ai_provider === p.id && <Check size={13} className="text-primary" />}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Modelo</label>
            {provider.models.length > 0 ? (
              <select value={cfg.ai_model} className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                onChange={e => setCfg(c => ({ ...c, ai_model: e.target.value }))}>
                {provider.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <Input value={cfg.ai_model} className="text-sm font-mono"
                placeholder="nome-do-modelo"
                onChange={e => setCfg(c => ({ ...c, ai_model: e.target.value }))} />
            )}
          </div>

          {/* API Key */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Chave de API {cfg.ai_api_key_set && <span className="text-emerald-600 normal-case font-normal">• configurada</span>}
            </label>
            <Input type="password" value={keyInput} className="text-sm font-mono"
              placeholder={cfg.ai_api_key_set ? "••••••••••••••• (deixe vazio para não alterar)" : "sk-..."}
              onChange={e => setKeyInput(e.target.value)} />
            <p className="text-[10px] text-muted-foreground mt-1">Armazenada no system_config do banco atual</p>
          </div>

          {/* Base URL (for custom/ollama) */}
          {(cfg.ai_provider === 'custom' || cfg.ai_provider === 'ollama' || cfg.ai_provider === 'groq') && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">URL Base da API</label>
              <Input value={cfg.ai_base_url || ''} className="text-sm font-mono"
                placeholder={cfg.ai_provider === 'ollama' ? "http://localhost:11434/v1" : cfg.ai_provider === 'groq' ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1"}
                onChange={e => setCfg(c => ({ ...c, ai_base_url: e.target.value }))} />
            </div>
          )}

          {/* Temperature */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Temperatura — {Number(cfg.ai_temperature || 0.3).toFixed(1)}
            </label>
            <input type="range" min="0" max="1" step="0.1" value={cfg.ai_temperature || 0.3}
              className="w-full accent-primary"
              onChange={e => setCfg(c => ({ ...c, ai_temperature: e.target.value }))} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>Preciso (0.0)</span><span>Criativo (1.0)</span>
            </div>
          </div>

          {/* Custom system prompt */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Prompt de Sistema (opcional)
            </label>
            <textarea value={cfg.ai_system_prompt || ''} rows={4}
              className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 text-foreground resize-none font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Deixe vazio para usar o prompt padrão otimizado para finanças..."
              onChange={e => setCfg(c => ({ ...c, ai_system_prompt: e.target.value }))} />
          </div>
        </div>

        {/* Save button */}
        <div className="p-5 border-t border-border">
          <Button className="w-full gap-2" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Zap size={14} />}
            {saved ? "Salvo!" : saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Suggestion chips ───────────────────────────────────────────
const SUGGESTIONS = [
  "Qual é meu saldo total hoje?",
  "Quanto gastei este mês?",
  "Quais são minhas maiores despesas do mês?",
  "Liste as últimas 10 transações",
  "Como está meu fluxo de caixa dos últimos 3 meses?",
  "Quais categorias consomem mais meu orçamento?",
]

// ── Main AiChat page ───────────────────────────────────────────
export default function AiChat() {
  const { currentDb } = useDatabase()

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [error, setError] = useState(null)
  const [aiEnabled, setAiEnabled] = useState(null)

  const bottomRef = useRef()
  const textareaRef = useRef()

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, status])

  // Check if AI is enabled (re-check when config panel closes)
  useEffect(() => {
    fetch('/api/ai/config').then(r => r.json()).then(d => {
      setAiEnabled(d.ai_enabled === '1' && !!d.ai_api_key_set)
    }).catch(() => setAiEnabled(false))
  }, [showConfig])

  const clearChat = () => { setMessages([]); setError(null) }

  const send = useCallback(async (text) => {
    const content = (text || input).trim()
    if (!content || sending) return
    setInput('')
    setError(null)
    setSending(true)

    const userMsg = { role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)

    // Build message history for API (exclude tool call UI data)
    const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))
      .filter(m => m.content)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || `HTTP ${res.status}`)
      }

      // Insert placeholder assistant message
      const assistantIdx = newMessages.length
      setMessages(prev => [...prev, { role: 'assistant', content: '', toolCalls: [] }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const localToolCalls = {}

      setStatus('Pensando...')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))

            if (evt.type === 'tool_call') {
              setStatus(`Consultando banco: ${evt.args?.reason || evt.name}...`)
              localToolCalls[evt.id] = { id: evt.id, name: evt.name, args: evt.args, result: null }
              setMessages(prev => {
                const next = [...prev]
                next[assistantIdx] = { ...next[assistantIdx], toolCalls: Object.values(localToolCalls) }
                return next
              })
            }
            else if (evt.type === 'tool_result') {
              localToolCalls[evt.id] = { ...localToolCalls[evt.id], result: evt.result }
              setMessages(prev => {
                const next = [...prev]
                next[assistantIdx] = { ...next[assistantIdx], toolCalls: Object.values(localToolCalls) }
                return next
              })
            }
            else if (evt.type === 'content') {
              setStatus('')
              setMessages(prev => {
                const next = [...prev]
                next[assistantIdx] = { ...next[assistantIdx], content: evt.text }
                return next
              })
            }
            else if (evt.type === 'done') {
              setStatus('')
            }
            else if (evt.type === 'error') {
              throw new Error(evt.message)
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      setError(err.message)
      setMessages(prev => prev.filter(m => m !== prev[prev.length - 1] || m.role !== 'assistant'))
    } finally {
      setSending(false)
      setStatus('')
      textareaRef.current?.focus()
    }
  }, [input, messages, sending])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // ── Empty state ─────────────────────────────────────────────
  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -mt-8 -mx-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md shadow-primary/20">
          <Bot size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-sm">Assistente Financeiro IA</h1>
          <p className="text-[11px] text-muted-foreground truncate">
            {currentDb?.name || "Nenhum banco selecionado"}
            {aiEnabled === true && <span className="ml-2 text-emerald-600 font-medium">• Online</span>}
            {aiEnabled === false && <span className="ml-2 text-amber-500 font-medium">• Configure a IA</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={clearChat}>
              <RotateCcw size={12} /> Limpar
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setShowConfig(true)} title="Configurar IA">
            <Settings size={15} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center max-w-lg mx-auto">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-xl shadow-primary/20">
              <Bot size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Como posso ajudar?</h2>
              <p className="text-muted-foreground text-sm">
                Faça perguntas sobre suas finanças — transações, saldos, categorias, tendências e muito mais.
              </p>
            </div>

            {aiEnabled === false && (
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-left">
                <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-700">IA não configurada</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Configure o provedor e a chave de API para começar.</p>
                  <button onClick={() => setShowConfig(true)} className="text-xs text-primary hover:underline mt-1 font-medium">
                    Configurar agora →
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 w-full">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="px-4 py-2.5 rounded-xl border border-border/80 text-sm text-left hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all text-muted-foreground">
                  <MessageSquare size={13} className="inline mr-2 opacity-60" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages list */}
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}

        {/* Typing indicator */}
        <Typing status={status} />

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm">
            <AlertCircle size={15} className="text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-destructive">Erro</p>
              <p className="text-muted-foreground text-xs mt-0.5">{error}</p>
              {aiEnabled === false && (
                <button onClick={() => setShowConfig(true)} className="text-xs text-primary hover:underline mt-1 font-medium">
                  Configurar IA →
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 px-6 py-4 border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="flex gap-3 items-end max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pergunte sobre suas finanças... (Enter para enviar, Shift+Enter para nova linha)"
              rows={1}
              style={{ maxHeight: '160px', height: 'auto' }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
              className="w-full resize-none bg-background border border-border rounded-2xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all leading-relaxed"
            />
          </div>
          <Button
            onClick={() => send()}
            disabled={!input.trim() || sending}
            className="h-11 w-11 rounded-xl p-0 shrink-0 shadow-md shadow-primary/20"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-2">
          A IA pode cometer erros. Sempre confira informações importantes.
        </p>
      </div>

      {/* Config panel */}
      {showConfig && <ConfigPanel onClose={() => setShowConfig(false)} dbName={currentDb?.name || ''} />}
    </div>
  )
}
