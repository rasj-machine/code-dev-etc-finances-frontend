import { useState, useRef, useEffect } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/context/LanguageContext"
import { useDatabase } from "@/context/DatabaseContext"
import {
  LayoutDashboard,
  CreditCard,
  ArrowLeftRight,
  TrendingUp,
  Bitcoin,
  Wallet,
  Link2,
  BarChart2,
  Building2,
  RefreshCw,
  ClipboardList,
  LayoutList,
  Tag,
  CheckCircle,
  Settings,
  Zap,
  Cpu,
  ChevronDown,
  ChevronUp,
  Home,
  Plus,
  Check,
  HardDrive,
  BrainCircuit,
  Cloud,
  BookOpen,
  PiggyBank,
  FileText,
  GitMerge,
  FolderOpen,
} from "lucide-react"

function DbSelector() {
  const { currentDb, databases, selectDatabase } = useDatabase()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const handleSelect = async (db) => {
    setOpen(false)
    if (db.is_current) return
    await selectDatabase(db.path)
    location.reload(true)
  }

  const name = currentDb?.name ?? ""

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors group text-left"
      >
        <HardDrive size={14} className="text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Banco de Dados</p>
          <p className="text-xs font-semibold truncate text-foreground">{name}</p>
        </div>
        {open ? <ChevronUp size={12} className="text-muted-foreground shrink-0" /> : <ChevronDown size={12} className="text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-150">
          <div className="p-2 space-y-0.5 max-h-56 overflow-y-auto">
            {databases.map(db => {
              const isLocal = db.storageType === 'local' || db.type === 'browser'
              const Icon = isLocal ? HardDrive : Cloud
              return (
                <button
                  key={db.path || db.id}
                  onClick={() => handleSelect(db)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors",
                    db.is_current
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon size={12} className={cn("shrink-0", db.is_current ? "text-primary" : "text-muted-foreground")} />
                  <div className="flex-1 min-w-0">
                    <span className="block truncate">{db.name}</span>
                    <span className="text-[9px] opacity-70 block leading-none">
                      {isLocal ? 'Local Storage' : 'Cloud / API'}
                    </span>
                  </div>
                  {db.is_current && <Check size={11} />}
                </button>
              )
            })}
            <div className="border-t border-border/50 mt-1 pt-1">
              <button
                onClick={() => { setOpen(false); navigate("/") }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Plus size={12} className="shrink-0" />
                Gerenciar bancos...
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Collapsible nav group */
function NavGroup({ label, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="space-y-0.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 group"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
          {label}
        </span>
        {open
          ? <ChevronUp size={10} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          : <ChevronDown size={10} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
        }
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  )
}

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )
      }
    >
      <Icon size={15} />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

export default function Sidebar() {
  const { t } = useTranslation()
  const { currentDb } = useDatabase()

  if (!currentDb) {
    return (
      <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col bg-card border-r border-border">
        <div className="p-5 flex items-center gap-3 border-b border-border">
          <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
            <Wallet size={16} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-sm">FinancePro</h1>
            <p className="text-[10px] text-muted-foreground">Finanças pessoais</p>
          </div>
        </div>
        <nav className="flex-1 p-3">
          <NavItem to="/" icon={Home} label="Início" end />
        </nav>
        <div className="p-3 border-t border-border">
          <DbSelector />
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col bg-card border-r border-border">
      {/* Logo */}
      <div className="p-5 flex items-center gap-3 border-b border-border">
        <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
          <Wallet size={16} className="text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-bold text-foreground text-sm">FinancePro</h1>
          <p className="text-[10px] text-muted-foreground">Finanças pessoais</p>
        </div>
      </div>

      {/* <nav className="flex p-3 space-y-3 overflow-y-auto">
        <div className="space-y-0.5">
          <NavItem to="/" icon={Home} label="Início" end />
          <NavItem to="/tutorial-extrato" icon={BookOpen} label="Tutorial Extrato" />
        </div>
      </nav> */}

      <div className="border-t border-border/40" />

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-3 overflow-y-auto">

        <div className="text-[10px] border-border  p-1 uppercase text-primary">Geral</div>
        <div className="border-t border-border/40" />

        {/* Geral */}
        <div className="space-y-0.5">
          <NavItem to="/" icon={Home} label="Início" end />
          <NavItem to="/tutorial-extrato" icon={BookOpen} label="Tutorial Extrato" />
          <NavItem to="/processar-arquivos" icon={FolderOpen} label="Processar Arquivos" />
        </div>

        <div className="text-[10px] border-border  border-t p-1 pt-5 uppercase text-primary">Banco de dados</div>
        <div className="border-t border-border/40" />

        <div className="space-y-0.5">
          <NavItem to="/dashboard" icon={LayoutDashboard} label={t('sidebar.dashboard')} />
          <NavItem to="/ai" icon={BrainCircuit} label="IA Financeira" />
        </div>

        <div className="border-t border-border/40" />


        {/* Movimentações */}
        <NavGroup label="Movimentações">
          <NavItem to="/contas" icon={CreditCard} label={t('sidebar.accounts')} />
          <NavItem to="/transacoes" icon={ArrowLeftRight} label={t('sidebar.transactions')} />
          <NavItem to="/recorrentes" icon={RefreshCw} label={t('sidebar.recurring')} />
          <NavItem to="/pre-transacoes" icon={ClipboardList} label={t('sidebar.pre_transactions')} />
          <NavItem to="/vinculos" icon={Link2} label={t('sidebar.links')} />
        </NavGroup>

        <div className="border-t border-border/40" />

        {/* Patrimônio & Investimentos */}
        <NavGroup label="Mercado">
          <NavItem to="/patrimonio" icon={Building2} label={t('sidebar.wealth')} />
          <NavItem to="/investimentos" icon={TrendingUp} label={t('sidebar.investments')} />
          <NavItem to="/crypto" icon={Bitcoin} label={t('sidebar.crypto')} />
        </NavGroup>

        <div className="border-t border-border/40" />

        {/* Análise & Relatórios */}
        <NavGroup label="Análise">
          <NavItem to="/gastos-receitas" icon={LayoutList} label={t('sidebar.expenses_income')} />
          <NavItem to="/relatorios" icon={BarChart2} label={t('sidebar.reports')} />
          <NavItem to="/unificado" icon={Zap} label={t('sidebar.unified')} />
        </NavGroup>

        <div className="border-t border-border/40" />

        {/* Organização */}
        <NavGroup label="Organização">
          <NavItem to="/categorias-tags" icon={Tag} label={t('sidebar.categories_tags')} />
          <NavItem to="/automacao" icon={Cpu} label={t('sidebar.automation')} />
        </NavGroup>

        <div className="border-t border-border/40" />

        {/* Conciliação */}
        <NavGroup label="Conciliação">
          <NavItem to="/conciliacao" icon={CheckCircle} label={t('sidebar.reconciliation')} />
          <NavItem to="/conciliacao-transferencias" icon={GitMerge} label="Transf. Conciliação" />
        </NavGroup>

        <div className="border-t border-border/40" />

        {/* Sistema */}
        <NavGroup label="Sistema" defaultOpen={false}>

          <NavItem to="/configuracoes" icon={Settings} label={t('sidebar.settings')} />
        </NavGroup>

      </nav>

      {/* DB Selector */}
      <div className="p-3 border-t border-border border-b">
        <DbSelector />
      </div>
    </aside>
  )
}
