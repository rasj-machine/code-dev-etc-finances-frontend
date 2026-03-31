/**
 * OrgUserInfo.jsx
 * Displayed LEFT of the search bar in the app header.
 * Shows: current org + logged user + dropdown (org admin, profile, logout).
 * For guests: shows "Sem organização" with a register banner.
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  Building2, User, ChevronDown, LogOut, Settings, ShieldCheck,
  UserPlus, AlertCircle, Globe, Layers, X, Crown, Shield, UserX,
} from 'lucide-react'

const ROLE_ICON = { owner: Crown, admin: Shield, member: User }
const ROLE_LABEL = { owner: 'Proprietário', admin: 'Admin', member: 'Membro' }

export default function OrgUserInfo() {
  const { user, org, orgs, isGuest, myRole, logout, guestLogout, switchOrg } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [guestBanner, setGuestBanner] = useState(isGuest)
  const ref = useRef()

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const RoleIcon = ROLE_ICON[myRole] || User

  return (
    <div ref={ref} className="relative flex items-center shrink-0">
      {/* Guest banner */}
      {isGuest && guestBanner && (
        <div className="fixed top-14 left-0 right-0 z-30 bg-amber-500 text-white text-xs py-2 px-6 flex items-center gap-3 shadow-md">
          <AlertCircle size={13} className="shrink-0" />
          <span>
            Você está no modo <strong>Sem Conta</strong>. Apenas conexões Self-hosted e Browser-local estão disponíveis.
            <button onClick={() => { guestLogout() }} className="ml-2 underline font-bold">Criar conta para salvar progresso →</button>
          </span>
          <button onClick={() => setGuestBanner(false)} className="ml-auto opacity-80 hover:opacity-100 transition-opacity">
            <X size={13} />
          </button>
        </div>
      )}

      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-accent transition-colors group text-left max-w-[260px]">

        {/* Org avatar */}
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-white text-[10px] font-bold
          ${isGuest ? 'bg-slate-400' : 'bg-gradient-to-br from-primary to-primary/70'}`}>
          {isGuest
            ? <UserX size={13} />
            : (org?.name?.[0]?.toUpperCase() || <Building2 size={13} />)
          }
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 hidden sm:block">
          <p className="text-[11px] font-bold leading-none truncate">
            {isGuest ? 'Sem organização' : (org?.name || 'Selecionar org')}
          </p>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5 truncate">
            {isGuest ? 'Convidado' : (user?.name || user?.email || '')}
          </p>
        </div>

        <ChevronDown size={12} className="text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-2xl shadow-2xl z-50 w-64 overflow-hidden animate-in slide-in-from-top-2 duration-150">
          {/* User header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0
                ${isGuest ? 'bg-slate-400' : 'bg-gradient-to-br from-primary to-primary/70'}`}>
                {isGuest ? <UserX size={15} /> : (user?.name?.[0]?.toUpperCase() || '?')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{user?.name || 'Convidado'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email || 'Sem conta'}</p>
              </div>
              {!isGuest && myRole && (
                <div className="shrink-0">
                  <RoleIcon size={13} className="text-primary" title={ROLE_LABEL[myRole]} />
                </div>
              )}
            </div>

            {/* Active org + 2FA badge */}
            {!isGuest && org && (
              <div className="mt-3 flex items-center gap-2">
                <Building2 size={11} className="text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground flex-1 truncate">{org.name}</span>
                {org.require_2fa && <ShieldCheck size={11} className="text-emerald-500" title="2FA exigido" />}
              </div>
            )}

            {isGuest && (
              <div className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
                <AlertCircle size={11} />
                Modo sem conta — funcionalidades limitadas
              </div>
            )}
          </div>

          {/* Menu items */}
          <div className="p-2 space-y-0.5">
            {!isGuest && (
              <>
                <button onClick={() => { setOpen(false); navigate('/perfil') }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-left hover:bg-accent transition-colors">
                  <User size={14} className="text-muted-foreground" /> Meu Perfil
                </button>
                <button onClick={() => { setOpen(false); navigate('/perfil?tab=org') }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-left hover:bg-accent transition-colors">
                  <Building2 size={14} className="text-muted-foreground" /> Gerenciar Organização
                </button>
              </>
            )}

            {/* Org switcher */}
            {!isGuest && orgs.length > 0 && (
              <div className="border-t border-border/50 mt-1 pt-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1">Trocar Organização</p>
                {orgs.map(o => (
                  <button key={o.id} onClick={async () => { setOpen(false); await switchOrg(o.id); location.reload(true); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-colors
                      ${o.id === org?.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-foreground'}`}>
                    <div className="h-4 w-4 rounded bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                      {o.name[0]?.toUpperCase()}
                    </div>
                    <span className="flex-1 truncate">{o.name}</span>
                    <span className="text-[9px] text-muted-foreground">{ROLE_LABEL[o.role]}</span>
                  </button>
                ))}
                <button onClick={() => { setOpen(false); navigate('/') }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                  <Layers size={13} /> Nova organização
                </button>
              </div>
            )}

            {isGuest && (
              <div className="border-t border-border/50 mt-1 pt-1 space-y-0.5">
                <button onClick={() => { setOpen(false); guestLogout() }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-left hover:bg-accent transition-colors text-primary">
                  <UserPlus size={14} /> Criar conta / Fazer login
                </button>
              </div>
            )}

            <div className="border-t border-border/50 mt-1 pt-1">
              <button onClick={() => { setOpen(false); logout() }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-left hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground">
                <LogOut size={14} /> {isGuest ? 'Sair do modo convidado' : 'Sair da conta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
