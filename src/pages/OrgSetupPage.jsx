/**
 * OrgSetupPage.jsx
 * Shown when user is authenticated but has no active org.
 * Lets them create a new org or select an existing one.
 */
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  Building2, Plus, ChevronRight, Loader2, ShieldCheck, Users,
  AlertCircle, LogOut, ArrowRight, Sparkles, Check,
} from 'lucide-react'

const ROLE_LABELS = { owner: 'Proprietário', admin: 'Admin', member: 'Membro' }
const ROLE_COLORS = { owner: 'text-primary', admin: 'text-violet-500', member: 'text-muted-foreground' }

export default function OrgSetupPage() {
  const { user, orgs, createOrg, switchOrg, logout } = useAuth()
  const [userView, setUserView] = useState(null)
  const view = userView || (orgs.length > 0 ? 'list' : 'create')

  const [orgName, setOrgName] = useState('')
  const [require2fa, setRequire2fa] = useState(true)
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(null)
  const [error, setError] = useState(null)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!orgName.trim()) return
    setLoading(true)
    setError(null)
    const res = await createOrg(orgName.trim(), require2fa)
    setLoading(false)
    if (!res.ok) setError(res.error || 'Erro ao criar organização')
  }

  const handleSwitch = async (org) => {
    setSwitching(org.id)
    setError(null)
    const res = await switchOrg(org.id)
    setSwitching(null)
    if (!res.ok) setError(res.error)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Logo + greeting */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-xl shadow-primary/25 mb-4">
            <Sparkles size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold">Olá, {user?.name || user?.email}!</h1>
          <p className="text-muted-foreground text-sm mt-1">Selecione ou crie uma organização para continuar</p>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-xl shadow-black/5 overflow-hidden">
          {/* Tabs */}
          {orgs.length > 0 && (
            <div className="flex border-b border-border">
              {[['list', 'Minhas Organizações'], ['create', 'Nova Organização']].map(([id, label]) => (
                <button key={id} onClick={() => setUserView(id)}
                  className={`flex-1 py-3.5 text-sm font-semibold transition-colors
                    ${view === id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="p-6">
            {error && (
              <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3 mb-4">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* List view */}
            {view === 'list' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {orgs.length} organização{orgs.length !== 1 ? 'ões' : ''} disponível{orgs.length !== 1 ? 'eis' : ''}
                </p>
                {orgs.map(org => (
                  <button key={org.id} onClick={() => handleSwitch(org)}
                    disabled={!!switching}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Building2 size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{org.name}</p>
                      <p className={`text-xs font-medium ${ROLE_COLORS[org.role] || 'text-muted-foreground'}`}>
                        {ROLE_LABELS[org.role] || org.role}
                        {org.require_2fa && <span className="ml-2 text-emerald-600"><ShieldCheck size={10} className="inline" /> 2FA</span>}
                      </p>
                    </div>
                    {switching === org.id
                      ? <Loader2 size={16} className="animate-spin text-primary shrink-0" />
                      : <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    }
                  </button>
                ))}
                <button onClick={() => setUserView('create')}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border hover:border-primary/50 hover:text-primary text-muted-foreground text-sm transition-all mt-2">
                  <Plus size={14} /> Nova organização
                </button>
              </div>
            )}

            {/* Create view */}
            {view === 'create' && (
              <form onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Nome da Organização
                  </label>
                  <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
                    placeholder="Ex: Finanças Pessoais, Empresa XYZ..."
                    autoFocus
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>

                {/* 2FA requirement */}
                {(() => {
                  const userHas2fa = !!user?.totp_enabled
                  const blocked = require2fa && !userHas2fa
                  return (
                    <>
                      <label className={`flex items-start gap-3 p-4 rounded-xl border transition-all
                        ${blocked
                          ? 'border-amber-500/40 bg-amber-500/5 cursor-default'
                          : 'border-border cursor-pointer hover:border-primary/40 hover:bg-accent/30'}`}>
                        <div className="relative mt-0.5">
                          <input type="checkbox" checked={require2fa}
                            onChange={e => {
                              // block enabling if user has no 2FA
                              if (e.target.checked && !userHas2fa) return
                              setRequire2fa(e.target.checked)
                            }}
                            className="sr-only" />
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                            ${require2fa && userHas2fa ? 'bg-primary border-primary' : require2fa ? 'bg-amber-400 border-amber-400' : 'border-border'}`}>
                            {require2fa && <Check size={10} className="text-white" />}
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-sm flex items-center gap-2">
                            <ShieldCheck size={13} className={userHas2fa ? 'text-emerald-500' : 'text-amber-500'} /> Exigir 2FA dos membros
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Todos os membros precisarão de autenticação de dois fatores para acessar esta organização.
                            Recomendado ✓
                          </p>
                        </div>
                      </label>

                      {/* Warning when require_2fa is on but owner has no 2FA */}
                      {require2fa && !userHas2fa && (
                        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                          <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <p className="font-semibold text-amber-700">Você precisa ativar o 2FA primeiro</p>
                            <p className="text-muted-foreground mt-0.5">
                              O proprietário da organização deve ter 2FA ativo para exigi-lo dos membros.
                              <button type="button" onClick={() => setRequire2fa(false)}
                                className="ml-1 text-amber-700 underline font-medium">
                                Criar sem exigir 2FA
                              </button>
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}

                <button type="submit"
                  disabled={loading || !orgName.trim() || (require2fa && !user?.totp_enabled)}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-all shadow-md shadow-primary/20">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
                  {loading ? 'Criando...' : 'Criar Organização'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Logout */}
        <button onClick={logout} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mx-auto mt-5 transition-colors">
          <LogOut size={12} /> Sair da conta ({user?.email})
        </button>
      </div>
    </div>
  )
}
