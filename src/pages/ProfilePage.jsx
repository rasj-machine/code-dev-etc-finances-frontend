/**
 * ProfilePage.jsx — User profile + language + password + 2FA
 * No backend for language; stored in localStorage via LanguageContext.
 */
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTranslation } from '@/context/LanguageContext'
import { useSearchParams } from 'react-router-dom'
import OrgManagement from './OrgManagement'
import {
  User, Globe, Lock, ShieldCheck, ShieldOff, Check, Loader2,
  Eye, EyeOff, Building2, Fingerprint, LogOut,
} from 'lucide-react'

const LANGUAGES = [
  { code: 'pt', label: 'Português (BR)', flag: '🇧🇷' },
  { code: 'en', label: 'English (US)',   flag: '🇺🇸' },
  { code: 'es', label: 'Español',        flag: '🇪🇸' },
]

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Icon size={16} className="text-primary" />
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, type = 'text', value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  const isPw = type === 'password'
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{label}</label>
      <div className="relative">
        <input type={isPw && show ? 'text' : type} value={value} onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all pr-10" />
        {isPw && <button type="button" onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>}
      </div>
    </div>
  )
}

function TwoFactorSection() {
  const { user, setUser } = useAuth()
  const [step,   setStep]   = useState('idle') // idle|setup|scan|verify|disable
  const [data,   setData]   = useState(null)
  const [code,   setCode]   = useState('')
  const [error,  setError]  = useState(null)
  const [loading,setLoading]= useState(false)

  const startSetup = async () => {
    setLoading(true); setError(null)
    const r = await fetch('/api/auth/2fa/setup', { method: 'POST' })
    const d = await r.json()
    setData(d); setLoading(false); setStep('scan')
  }

  const confirmCode = async () => {
    if (code.length !== 6) return
    setLoading(true); setError(null)
    const r = await fetch('/api/auth/2fa/enable', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    const d = await r.json()
    setLoading(false)
    if (d.error) { setError(d.error); return }
    setUser({ ...user, totp_enabled: true })
    setStep('idle')
  }

  const disable = async () => {
    if (code.length !== 6) return
    setLoading(true); setError(null)
    const r = await fetch('/api/auth/2fa/disable', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    const d = await r.json()
    setLoading(false)
    if (d.error) { setError(d.error); return }
    setUser({ ...user, totp_enabled: false })
    setStep('idle'); setCode('')
  }

  if (step === 'scan' && data) return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Escaneie com o Google Authenticator:</p>
      <div className="flex justify-center"><img src={data.qr_url} alt="QR 2FA" className="rounded-xl border border-border" width={180} height={180} /></div>
      <p className="text-center text-xs text-muted-foreground">Chave: <code className="font-mono text-foreground">{data.secret}</code></p>
      <button onClick={() => setStep('verify')} className="w-full h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Escaneei →</button>
      <button onClick={() => setStep('idle')} className="w-full text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
    </div>
  )

  if (step === 'verify' || step === 'disable') return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{step === 'verify' ? 'Confirme o código para ativar 2FA:' : 'Digite o código para desativar 2FA:'}</p>
      <input type="text" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="123456" autoFocus
        className="w-full text-center text-xl font-mono tracking-widest bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => { setStep('idle'); setCode('') }} className="flex-1 h-9 rounded-xl border border-border text-sm hover:bg-accent text-muted-foreground">Cancelar</button>
        <button onClick={step === 'verify' ? confirmCode : disable} disabled={loading || code.length !== 6}
          className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
          {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : step === 'verify' ? 'Ativar' : 'Desativar'}
        </button>
      </div>
    </div>
  )

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl ${user?.totp_enabled ? 'bg-emerald-500/10 border border-emerald-500/25' : 'bg-accent/30 border border-border'}`}>
      <div className="flex items-center gap-3">
        <Fingerprint size={20} className={user?.totp_enabled ? 'text-emerald-600' : 'text-muted-foreground'} />
        <div>
          <p className="font-semibold text-sm">{user?.totp_enabled ? '2FA Ativo ✓' : '2FA Desativado'}</p>
          <p className="text-xs text-muted-foreground">Google Authenticator</p>
        </div>
      </div>
      {user?.totp_enabled ? (
        <button onClick={() => { setCode(''); setStep('disable') }}
          className="text-xs text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg border border-destructive/30 transition-colors">
          {loading ? <Loader2 size={12} className="animate-spin" /> : 'Desativar'}
        </button>
      ) : (
        <button onClick={startSetup} disabled={loading}
          className="text-xs text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg border border-primary/20 transition-colors font-semibold">
          {loading ? <Loader2 size={12} className="animate-spin" /> : 'Configurar'}
        </button>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const { user, logout, isGuest, guestLogout } = useAuth()
  const { lang, setLang } = useTranslation()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'profile')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState(null)

  const changePw = async (e) => {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwError('As senhas não coincidem'); return }
    if (newPw.length < 8)   { setPwError('Mínimo 8 caracteres'); return }
    setSaving(true); setPwError(null)
    const r = await fetch('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPw, new_password: newPw })
    })
    const d = await r.json()
    setSaving(false)
    if (d.error) { setPwError(d.error); return }
    setPwSaved(true); setCurrentPw(''); setNewPw(''); setConfirmPw('')
    setTimeout(() => setPwSaved(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold">Perfil e Configurações</h2>
        <p className="text-sm text-muted-foreground">Gerencie sua conta e preferências</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-accent/50 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('profile')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all
            ${tab === 'profile' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <User size={13} /> Meu Perfil
        </button>
        <button onClick={() => setTab('org')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all
            ${tab === 'org' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Building2 size={13} /> Organização
        </button>
      </div>

      {tab === 'profile' && (
        <>
          {/* Name/email */}
          <Section title="Informações da Conta" icon={User}>
            <div className="flex items-center gap-4">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0
                ${isGuest ? 'bg-slate-400' : 'bg-gradient-to-br from-primary to-primary/70'}`}>
                {isGuest ? '?' : (user?.name?.[0]?.toUpperCase() || '?')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold">{user?.name || 'Convidado'}</p>
                <p className="text-sm text-muted-foreground">{user?.email || 'Sem e-mail'}</p>
                {isGuest && <p className="text-xs text-amber-600 mt-0.5">Modo sem conta</p>}
              </div>
              {!isGuest && (
                <button onClick={logout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive px-3 py-1.5 rounded-lg border border-border hover:border-destructive/50 transition-colors">
                  <LogOut size={12} /> Sair
                </button>
              )}
              {isGuest && (
                <button onClick={guestLogout} className="text-xs text-primary px-3 py-1.5 rounded-lg bg-primary/10 font-semibold hover:bg-primary/20 transition-colors">
                  Criar conta →
                </button>
              )}
            </div>
          </Section>

          {/* Language */}
          <Section title="Idioma do Sistema" icon={Globe}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {LANGUAGES.map(lg => (
                <button key={lg.code} onClick={() => setLang(lg.code)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all
                    ${lang === lg.code ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/30 text-foreground'}`}>
                  <span className="text-xl">{lg.flag}</span>
                  <span className="font-medium flex-1">{lg.label}</span>
                  {lang === lg.code && <Check size={13} className="text-primary shrink-0" />}
                </button>
              ))}
            </div>
          </Section>

          {/* 2FA */}
          {!isGuest && (
            <Section title="Autenticação de Dois Fatores" icon={ShieldCheck}>
              <TwoFactorSection />
            </Section>
          )}

          {/* Change password */}
          {!isGuest && (
            <Section title="Alterar Senha" icon={Lock}>
              <form onSubmit={changePw} className="space-y-3">
                <Field label="Senha Atual" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" />
                <Field label="Nova Senha" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Mínimo 8 caracteres" />
                <Field label="Confirmar Nova Senha" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repita a senha" />
                {pwError && <p className="text-xs text-destructive">{pwError}</p>}
                <button type="submit" disabled={saving}
                  className="h-9 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                  {pwSaved ? 'Salvo ✓' : saving ? 'Salvando...' : 'Alterar Senha'}
                </button>
              </form>
            </Section>
          )}
        </>
      )}

      {tab === 'org' && <OrgManagement />}
    </div>
  )
}
