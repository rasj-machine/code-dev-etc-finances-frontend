/**
 * OrgManagement.jsx — Full org admin panel
 * Accessible from settings. Lets owners/admins:
 *  - Edit org name + 2FA policy
 *  - Invite / remove members + change roles
 *  - Add / remove databases from org (with access control)
 *  - Set up 2FA for their own account
 */
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  Building2, Users, Database, Shield, ShieldCheck, ShieldOff,
  Plus, Trash2, Copy, Check, X, Loader2, AlertCircle, Settings,
  UserPlus, Key, Eye, EyeOff, RefreshCw, Crown, User, LogOut,
  ChevronDown, ChevronUp, Fingerprint, Lock,
} from 'lucide-react'

const ROLE_LABELS = { owner: 'Proprietário', admin: 'Admin', member: 'Membro' }
const ROLE_BADGE  = { owner: 'bg-primary/10 text-primary', admin: 'bg-violet-500/10 text-violet-600', member: 'bg-accent text-muted-foreground' }

function Section({ title, icon: Icon, children, action }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Icon size={16} className="text-primary" />{title}
        </h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Badge({ role }) {
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[role] || ROLE_BADGE.member}`}>{ROLE_LABELS[role] || role}</span>
}

// ── 2FA Setup Modal ───────────────────────────────────────────
function TwoFactorSetup({ onClose }) {
  const { user } = useAuth()
  const [step,    setStep]    = useState('intro') // intro|scan|verify|done
  const [data,    setData]    = useState(null)    // { secret, qr_url }
  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [copied,  setCopied]  = useState(false)

  const startSetup = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/auth/2fa/setup', { method: 'POST' })
      const d = await r.json()
      setData(d)
      setStep('scan')
    } catch { setError('Erro ao iniciar setup') }
    setLoading(false)
  }

  const confirmCode = async () => {
    if (code.length !== 6) return
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/auth/2fa/enable', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
      const d = await r.json()
      if (d.error) { setError(d.error); setLoading(false); return }
      setStep('done')
    } catch { setError('Erro de conexão') }
    setLoading(false)
  }

  const copySecret = () => {
    navigator.clipboard.writeText(data?.secret || '')
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-bold flex items-center gap-2"><Fingerprint size={16} className="text-primary" /> Configurar Autenticador</h3>
          <button onClick={step === 'done' ? onClose : undefined} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-6">
          {step === 'intro' && (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <ShieldCheck size={28} className="text-primary" />
              </div>
              <div>
                <p className="font-bold text-lg">Proteja sua conta</p>
                <p className="text-sm text-muted-foreground mt-2">
                  A autenticação de dois fatores adiciona uma camada extra de segurança.
                  Você precisará do Google Authenticator instalado no seu celular.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button onClick={startSetup} disabled={loading}
                className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                {loading ? 'Preparando...' : 'Começar Configuração'}
              </button>
            </div>
          )}

          {step === 'scan' && data && (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Abra o <strong>Google Authenticator</strong> no seu celular e escaneie o QR code:
              </p>
              <div className="flex justify-center">
                <img src={data.qr_url} alt="QR Code 2FA" className="rounded-xl border border-border" width={200} height={200} />
              </div>
              <div className="bg-accent/50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Ou digite manualmente</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-xs font-mono text-foreground break-all">{data.secret}</code>
                  <button onClick={copySecret} className="text-muted-foreground hover:text-primary transition-colors">
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              <button onClick={() => setStep('verify')}
                className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90">
                Já escaneei →
              </button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Digite o código de 6 dígitos mostrado no seu Google Authenticator:
              </p>
              <input type="text" inputMode="numeric" maxLength={6}
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456" autoFocus
                className="w-full text-center text-2xl font-mono tracking-[0.5em] bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <button onClick={confirmCode} disabled={loading || code.length !== 6}
                className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {loading ? 'Verificando...' : 'Confirmar e Ativar'}
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck size={28} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-lg text-emerald-600">2FA Ativado!</p>
                <p className="text-sm text-muted-foreground mt-2">Sua conta está mais segura. Nas próximas entradas você precisará do código.</p>
              </div>
              <button onClick={onClose} className="w-full h-10 rounded-xl bg-emerald-500/10 text-emerald-600 text-sm font-semibold hover:bg-emerald-500/20 transition-colors border border-emerald-500/30">
                Concluído ✓
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function OrgManagement() {
  const { user, org, orgs, isAdmin, isOwner, myRole, switchOrg, logout, refreshOrgs } = useAuth()
  const [members,     setMembers]     = useState([])
  const [orgDbs,      setOrgDbs]      = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState('member')
  const [dbPath,      setDbPath]      = useState('')
  const [dbName,      setDbName]      = useState('')
  const [loading,     setLoading]     = useState({})
  const [error,       setError]       = useState({})
  const [show2fa,     setShow2fa]     = useState(false)
  const [orgName,     setOrgName]     = useState(org?.name || '')
  const [require2fa,  setRequire2fa]  = useState(!!org?.require_2fa)
  const [saved,       setSaved]       = useState(false)

  const setL = (k, v) => setLoading(p => ({ ...p, [k]: v }))
  const setE = (k, v) => setError(p => ({ ...p, [k]: v }))

  const loadMembers = useCallback(async () => {
    if (!org) return
    const r = await fetch(`/api/orgs/${org.id}/members`)
    if (r.ok) setMembers(await r.json())
  }, [org])

  const loadDbs = useCallback(async () => {
    if (!org) return
    const r = await fetch(`/api/orgs/${org.id}/databases`)
    if (r.ok) setOrgDbs(await r.json())
  }, [org])

  useEffect(() => { loadMembers(); loadDbs() }, [loadMembers, loadDbs])
  useEffect(() => { setOrgName(org?.name || ''); setRequire2fa(!!org?.require_2fa) }, [org])

  const invite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setL('invite', true); setE('invite', null)
    const r = await fetch(`/api/orgs/${org.id}/members/invite`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole })
    })
    const d = await r.json()
    setL('invite', false)
    if (d.error) { setE('invite', d.error); return }
    setInviteEmail('')
    loadMembers()
  }

  const changeRole = async (userId, role) => {
    await fetch(`/api/orgs/${org.id}/members/${userId}/role`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    })
    loadMembers()
  }

  const removeMember = async (userId) => {
    if (!confirm('Remover este membro?')) return
    await fetch(`/api/orgs/${org.id}/members/${userId}`, { method: 'DELETE' })
    loadMembers()
  }

  const addDb = async (e) => {
    e.preventDefault()
    if (!dbPath.trim()) return
    setL('addDb', true); setE('addDb', null)
    const r = await fetch(`/api/orgs/${org.id}/databases`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db_path: dbPath.trim(), db_name: dbName.trim() || dbPath.split('/').pop() || dbPath })
    })
    const d = await r.json()
    setL('addDb', false)
    if (d.error) { setE('addDb', d.error); return }
    setDbPath(''); setDbName(''); loadDbs()
  }

  const removeDb = async (dbId) => {
    if (!confirm('Remover este banco de dados da organização?')) return
    await fetch(`/api/orgs/${org.id}/databases/${dbId}`, { method: 'DELETE' })
    loadDbs()
  }

  const saveOrgSettings = async () => {
    await fetch(`/api/orgs/${org.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: orgName, require_2fa: require2fa })
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    refreshOrgs()
  }

  if (!org) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <p>Nenhuma organização ativa.</p>
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      {show2fa && <TwoFactorSetup onClose={() => { setShow2fa(false); location.reload() }} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Organização</h2>
          <p className="text-sm text-muted-foreground">{org.name} · <span className="capitalize">{ROLE_LABELS[myRole] || myRole}</span></p>
        </div>
        {orgs.length > 1 && (
          <select className="text-sm bg-card border border-border rounded-xl px-3 py-2"
            value={org.id}
            onChange={async e => { await switchOrg(e.target.value) }}>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>

      {/* My Account */}
      <Section title="Minha Conta" icon={User}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <User size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {user?.totp_enabled ? (
              <span className="flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-600 px-3 py-1.5 rounded-full border border-emerald-500/30 font-medium">
                <ShieldCheck size={12} /> 2FA Ativo
              </span>
            ) : (
              <button onClick={() => setShow2fa(true)}
                className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-600 px-3 py-1.5 rounded-full border border-amber-500/30 font-medium hover:bg-amber-500/20 transition-colors">
                <Shield size={12} /> Ativar 2FA
              </button>
            )}
            <button onClick={logout}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full border border-border hover:border-border transition-colors">
              <LogOut size={12} /> Sair
            </button>
          </div>
        </div>

        {!user?.totp_enabled && org?.require_2fa && (
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mt-4">
            <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700">Esta organização exige 2FA</p>
              <p className="text-xs text-muted-foreground mt-0.5">Configure o autenticador para continuar usando a organização.</p>
              <button onClick={() => setShow2fa(true)} className="text-xs text-primary font-semibold hover:underline mt-1">
                Configurar agora →
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Org Settings (owner/admin only) */}
      {isAdmin && (
        <Section title="Configurações da Organização" icon={Settings}
          action={
            <button onClick={saveOrgSettings}
              className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors font-semibold flex items-center gap-1">
              {saved ? <><Check size={11} /> Salvo!</> : 'Salvar'}
            </button>
          }>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Nome da Organização</label>
              <input value={orgName} onChange={e => setOrgName(e.target.value)} disabled={!isOwner}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input type="checkbox" checked={require2fa} onChange={e => setRequire2fa(e.target.checked)} disabled={!isOwner} className="sr-only" />
                <div className={`w-10 h-6 rounded-full transition-colors ${require2fa ? 'bg-primary' : 'bg-border'} ${!isOwner ? 'opacity-50' : ''}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-1 transition-transform ${require2fa ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </div>
              <div>
                <p className="font-semibold text-sm flex items-center gap-1.5"><ShieldCheck size={13} className="text-emerald-500" /> Exigir 2FA dos membros</p>
                <p className="text-xs text-muted-foreground">Todos os membros precisarão de 2FA ativo para entrar</p>
              </div>
            </label>
          </div>
        </Section>
      )}

      {/* Members */}
      <Section title={`Membros (${members.length})`} icon={Users}
        action={isAdmin && (
          <form onSubmit={invite} className="flex items-center gap-2">
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="email@exemplo.com" className="text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-primary w-40" />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 outline-none">
              <option value="member">Membro</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={loading.invite}
              className="text-xs bg-primary/10 text-primary px-2.5 py-1.5 rounded-lg hover:bg-primary/20 transition-colors font-semibold flex items-center gap-1">
              {loading.invite ? <Loader2 size={11} className="animate-spin" /> : <UserPlus size={11} />} Convidar
            </button>
          </form>
        )}>
        {error.invite && <p className="text-xs text-destructive mb-3">{error.invite}</p>}
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 hover:bg-accent/60 transition-colors">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {m.role === 'owner' ? <Crown size={12} className="text-primary" /> : <User size={12} className="text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{m.name || m.email}</p>
                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {m.totp_enabled && <ShieldCheck size={12} className="text-emerald-500" title="2FA ativo" />}
                {isOwner && m.role !== 'owner' ? (
                  <select value={m.role} onChange={e => changeRole(m.user_id, e.target.value)}
                    className="text-[10px] font-semibold bg-background border border-border rounded-lg px-1.5 py-1 outline-none">
                    <option value="member">Membro</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <Badge role={m.role} />
                )}
                {isAdmin && m.role !== 'owner' && m.user_id !== user?.id && (
                  <button onClick={() => removeMember(m.user_id)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Databases */}
      <Section title={`Bancos de Dados (${orgDbs.length})`} icon={Database}>
        {isAdmin && (
          <form onSubmit={addDb} className="flex items-end gap-2 mb-4 flex-wrap">
            <div className="flex-1 min-w-40">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Caminho do banco</label>
              <input value={dbPath} onChange={e => setDbPath(e.target.value)} placeholder="finances.db"
                className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex-1 min-w-32">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Nome exibido</label>
              <input value={dbName} onChange={e => setDbName(e.target.value)} placeholder="Opcional"
                className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <button type="submit" disabled={loading.addDb || !dbPath.trim()}
              className="h-[38px] px-4 text-sm bg-primary/10 text-primary rounded-xl font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1.5 disabled:opacity-60">
              {loading.addDb ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Adicionar
            </button>
          </form>
        )}
        {error.addDb && <p className="text-xs text-destructive mb-3">{error.addDb}</p>}
        {orgDbs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum banco cadastrado nesta organização.</p>
        ) : (
          <div className="space-y-2">
            {orgDbs.map(db => (
              <div key={db.id} className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 hover:bg-accent/60 transition-colors">
                <Database size={14} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{db.db_name || db.db_path}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{db.db_path}</p>
                </div>
                <span className="text-[10px] bg-accent rounded-full px-2 py-0.5 text-muted-foreground">
                  {db.access_mode === 'all_members' ? 'Todos os membros' : 'Restrito'}
                </span>
                {isAdmin && (
                  <button onClick={() => removeDb(db.id)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
