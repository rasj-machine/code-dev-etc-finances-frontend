/**
 * LoginPage.jsx — ChatGPT-quality auth screens
 * Views: login → 2fa → register
 */
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Loader2, Eye, EyeOff, ShieldCheck, Mail, Lock, User, ArrowRight, Sparkles, UserX, Globe, Settings2 } from 'lucide-react'

function Field({ label, id, type = 'text', value, onChange, placeholder, icon: Icon, error, autoComplete }) {
  const [show, setShow] = useState(false)
  const isPw = type === 'password'
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />}
        <input
          id={id}
          type={isPw && show ? 'text' : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full bg-background border rounded-xl px-4 py-2.5 text-sm outline-none transition-all
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-destructive ring-1 ring-destructive/30' : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
        />
        {isPw && (
          <button type="button" onClick={() => setShow(s => !s)} tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      {/* Background gradient orbs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-xl shadow-primary/25 mb-4">
            <Sparkles size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm mt-1 text-center">{subtitle}</p>}
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-xl shadow-black/5 p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Login form ─────────────────────────────────────────────────
function LoginForm({ onRegister, on2fa }) {
  const { login, guestLogin, authError, setAuthError, apiBaseUrl, setApiBaseUrl } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState({})
  const [showServer, setShowServer] = useState(false)

  const validate = () => {
    const e = {}
    if (!email.trim())    e.email    = 'E-mail obrigatório'
    if (!password.trim()) e.password = 'Senha obrigatória'
    setErrors(e)
    return !Object.keys(e).length
  }

  const submit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    setAuthError(null)
    const res = await login(email, password)
    setLoading(false)
    if (res.requires_2fa) on2fa(res.temp_token)
  }

  return (
    <AuthCard title="Bem-vindo de volta" subtitle="Faça login na sua conta FinancePro">
      <form onSubmit={submit} className="space-y-4">
        {authError && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
            {authError}
          </div>
        )}

        <div className="flex justify-between items-center mb-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Configuração de Servidor</p>
          <button type="button" onClick={() => setShowServer(!showServer)} 
            className={`p-1 rounded-md transition-colors ${showServer ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
            <Settings2 size={13} />
          </button>
        </div>

        {showServer && (
          <div className="animate-in slide-in-from-top-1 duration-200 mb-2">
            <Field 
              label="URL da API (Opcional)" id="api-base" icon={Globe}
              value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)}
              placeholder="Ex: http://localhost:5000"
            />
            <p className="text-[10px] text-muted-foreground mt-1 px-1">Deixe vazio para usar o servidor padrão</p>
          </div>
        )}

        <Field label="E-mail" id="email" type="email" icon={Mail}
          value={email} onChange={e => setEmail(e.target.value)}
          placeholder="seu@email.com" error={errors.email}
          autoComplete="email" />

        <Field label="Senha" id="password" type="password" icon={Lock}
          value={password} onChange={e => setPassword(e.target.value)}
          placeholder="••••••••" error={errors.password}
          autoComplete="current-password" />

        <button type="submit" disabled={loading}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-all shadow-md shadow-primary/20 mt-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="text-center pt-2">
          <span className="text-sm text-muted-foreground">Não tem uma conta? </span>
          <button type="button" onClick={onRegister} className="text-sm text-primary font-semibold hover:underline">
            Cadastrar-se
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">ou</span></div>
        </div>

        <button type="button" onClick={guestLogin}
          className="w-full h-10 rounded-xl border border-border text-sm flex items-center justify-center gap-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-all">
          <UserX size={14} />
          Entrar sem conta
          <span className="text-[10px] bg-amber-500/15 text-amber-600 px-2 py-0.5 rounded-full">Self-hosted / Browser</span>
        </button>
      </form>
    </AuthCard>
  )
}

// ── 2FA form ───────────────────────────────────────────────────
function TwoFactorForm({ tempToken, onBack }) {
  const { verify2fa, authError, setAuthError } = useAuth()
  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (ev) => {
    ev.preventDefault()
    if (code.length !== 6) return
    setLoading(true)
    setAuthError(null)
    await verify2fa(tempToken, code)
    setLoading(false)
  }

  return (
    <AuthCard title="Verificação em 2 etapas" subtitle="Digite o código gerado pelo Google Authenticator">
      <form onSubmit={submit} className="space-y-5">
        {authError && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
            {authError}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 py-2">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck size={22} className="text-primary" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Código de 6 dígitos</label>
          <input
            type="text" inputMode="numeric" maxLength={6}
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className="w-full text-center text-2xl font-mono tracking-[0.5em] bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            autoFocus
          />
        </div>

        <button type="submit" disabled={loading || code.length !== 6}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-all shadow-md shadow-primary/20">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          {loading ? 'Verificando...' : 'Verificar'}
        </button>

        <button type="button" onClick={onBack} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Voltar ao login
        </button>
      </form>
    </AuthCard>
  )
}

// ── Register form ──────────────────────────────────────────────
function RegisterForm({ onLogin }) {
  const { register, authError, setAuthError } = useAuth()
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState({})

  const validate = () => {
    const e = {}
    if (!name.trim())    e.name    = 'Nome obrigatório'
    if (!email.trim())   e.email   = 'E-mail obrigatório'
    if (password.length < 8) e.password = 'Mínimo 8 caracteres'
    if (password !== confirm)    e.confirm = 'As senhas não coincidem'
    setErrors(e)
    return !Object.keys(e).length
  }

  const submit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    setAuthError(null)
    await register(email, password, name)
    setLoading(false)
  }

  return (
    <AuthCard title="Criar conta" subtitle="Comece a controlar suas finanças agora">
      <form onSubmit={submit} className="space-y-4">
        {authError && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
            {authError}
          </div>
        )}

        <Field label="Seu nome" id="name" icon={User}
          value={name} onChange={e => setName(e.target.value)}
          placeholder="João Silva" error={errors.name}
          autoComplete="name" />

        <Field label="E-mail" id="reg-email" type="email" icon={Mail}
          value={email} onChange={e => setEmail(e.target.value)}
          placeholder="seu@email.com" error={errors.email}
          autoComplete="email" />

        <Field label="Senha" id="reg-password" type="password" icon={Lock}
          value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres" error={errors.password}
          autoComplete="new-password" />

        <Field label="Confirmar Senha" id="confirm" type="password" icon={Lock}
          value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder="Repita a senha" error={errors.confirm}
          autoComplete="new-password" />

        <button type="submit" disabled={loading}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-all shadow-md shadow-primary/20 mt-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {loading ? 'Cadastrando...' : 'Criar conta'}
        </button>

        <div className="text-center pt-2">
          <span className="text-sm text-muted-foreground">Já tem uma conta? </span>
          <button type="button" onClick={onLogin} className="text-sm text-primary font-semibold hover:underline">
            Entrar
          </button>
        </div>
      </form>
    </AuthCard>
  )
}

// ── Auth Shell (login | register | 2fa) ───────────────────────
export default function AuthShell() {
  const [view,      setView]      = useState('login') // 'login'|'register'|'2fa'
  const [tempToken, setTempToken] = useState(null)

  if (view === '2fa') return (
    <TwoFactorForm
      tempToken={tempToken}
      onBack={() => setView('login')}
    />
  )
  if (view === 'register') return (
    <RegisterForm onLogin={() => setView('login')} />
  )
  return (
    <LoginForm
      onRegister={() => setView('register')}
      on2fa={(tk) => { setTempToken(tk); setView('2fa') }}
    />
  )
}
