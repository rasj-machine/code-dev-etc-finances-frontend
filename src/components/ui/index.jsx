import { cn } from "@/lib/utils"

export function Button({ children, variant = "default", size = "md", className, ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    outline: "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
  }
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
    lg: "h-11 px-6 text-base",
    icon: "h-9 w-9",
  }
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  )
}

export function Card({ children, className, ...props }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }) {
  return <div className={cn("flex flex-col space-y-1.5 p-6 pb-3", className)}>{children}</div>
}

export function CardTitle({ children, className }) {
  return <h3 className={cn("font-semibold leading-none tracking-tight text-muted-foreground text-sm", className)}>{children}</h3>
}

export function CardContent({ children, className }) {
  return <div className={cn("p-6 pt-0", className)}>{children}</div>
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-all",
        className
      )}
      {...props}
    />
  )
}

import { NumericFormat } from 'react-number-format'

export function MoneyInput({ className, onValueChange, value, ...props }) {
  return (
    <NumericFormat
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-all",
        className
      )}
      thousandSeparator="."
      decimalSeparator=","
      prefix=""
      decimalScale={2}
      fixedDecimalScale
      allowNegative={false}
      value={(value || 0) / 100}
      onValueChange={(values) => onValueChange(Math.round((values.floatValue || 0) * 100))}
      {...props}
    />
  )
}

export function Select({ children, value, onChange, placeholder = "Selecione...", className }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // To support standard <option> children, we'll parse them
  const options = React.Children.map(children, child => {
    if (child && child.type === 'option') {
      return { value: child.props.value, label: child.props.children }
    }
    return null
  })?.filter(Boolean) || []

  const selected = options.find(o => String(o.value) === String(value))

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <button
        type="button"
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-all"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in zoom-in-95 backdrop-blur-md">
          <div className="p-1">
            {options.map((opt) => (
              <div
                key={opt.value}
                onMouseDown={() => {
                  if (onChange) {
                    onChange({ target: { value: opt.value } })
                  }
                  setOpen(false)
                }}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                  String(opt.value) === String(value) && "bg-accent/50 text-accent-foreground font-medium"
                )}
              >
                <Check className={cn("mr-2 h-4 w-4", String(opt.value) === String(value) ? "opacity-100" : "opacity-0")} />
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function Label({ children, className, ...props }) {
  return (
    <label className={cn("text-sm font-medium text-muted-foreground mb-1 block", className)} {...props}>
      {children}
    </label>
  )
}

export function Badge({ children, variant = "default", className }) {
  const variants = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/10 text-warning",
    secondary: "bg-secondary text-secondary-foreground",
  }
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", variants[variant], className)}>
      {children}
    </span>
  )
}

import React, { useState, useRef, useEffect } from "react"
import { Search, ChevronDown, Check } from "lucide-react"

export function MultiSelect({ selected, onChange, options, placeholder = "Selecione...", className, emptyMessage = "Nenhum resultado." }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef(null)

  const filtered = options.filter(opt =>
    String(opt.label).toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (val) => {
    const next = new Set(selected)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange(Array.from(next))
  }

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch("") }}
        className="flex min-h-[36px] h-auto w-full items-center justify-between rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-all"
      >
        <div className="flex flex-wrap gap-1 items-center overflow-hidden">
          {selected.length === 0 ? (
            <span className="text-muted-foreground truncate">{placeholder}</span>
          ) : selected.length === options.length ? (
            <span className="font-semibold text-primary">Todas Selecionadas</span>
          ) : (
            <span className="font-semibold text-primary">{selected.length} selecionadas</span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
      </button>

      {open && (
        <div className="absolute z-[60] mt-1 max-h-60 w-64 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in zoom-in-95 backdrop-blur-md right-0">
          <div className="flex items-center border-b border-border px-3 py-2 sticky top-0 bg-popover z-10">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              autoFocus
              className="flex h-4 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="p-1">
            <div
              onClick={() => onChange(selected.length === options.length ? [] : options.map(o => o.value))}
              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-primary border-b border-border/10 mb-1 hover:bg-accent/50"
            >
              {selected.length === options.length ? "Desmarcar todas" : "Marcar todas"}
            </div>
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.includes(opt.value)
                return (
                  <div
                    key={opt.value}
                    onClick={() => toggle(opt.value)}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent/30 text-accent-foreground font-medium"
                    )}
                  >
                    <div className={cn("mr-2 flex h-3.5 w-3.5 items-center justify-center rounded border border-primary transition-colors", isSelected ? "bg-primary text-primary-foreground" : "bg-transparent")}>
                      {isSelected && <Check className="h-2.5 w-2.5" />}
                    </div>
                    {opt.label}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function Combobox({ value, onChange, options, placeholder = "Selecione...", className, emptyMessage = "Nenhum resultado." }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef(null)

  const filtered = options.filter(opt =>
    String(opt.label).toLowerCase().includes(search.toLowerCase())
  )

  const selected = options.find(opt => String(opt.value) === String(value))

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch("") }}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-all"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in zoom-in-95 backdrop-blur-md">
          <div className="flex items-center border-b border-border px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              autoFocus
              className="flex h-4 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="p-1">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                    String(opt.value) === String(value) && "bg-accent/50 text-accent-foreground font-medium"
                  )}
                >
                  <Check className={cn("mr-2 h-4 w-4", String(opt.value) === String(value) ? "opacity-100" : "opacity-0")} />
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function Separator({ className }) {
  return <div className={cn("h-px bg-border", className)} />
}

import { Calendar, History } from "lucide-react"

export function DateRangePicker({ from, to, onFromChange, onToChange, className }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  const PRESETS = [
    { label: "Hoje", days: 0 },
    { label: "Ontem", days: 1 },
    { label: "Últimos 7 dias", days: 7 },
    { label: "Últimos 30 dias", days: 30 },
    { label: "Mês Atual", special: 'this_month' },
    { label: "Mês Passado", special: 'last_month' },
    { label: "Este Ano", special: 'this_year' },
    { label: "Todo Período", special: 'all' },
  ]

  const applyPreset = (p) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let start, end = new Date()

    if (p.days !== undefined) {
      start = new Date()
      start.setDate(today.getDate() - p.days)
      if (p.days === 1) end = start // Ontem = start and end same day
    } else if (p.special === 'this_month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    } else if (p.special === 'last_month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      end = new Date(today.getFullYear(), today.getMonth(), 0)
    } else if (p.special === 'this_year') {
      start = new Date(today.getFullYear(), 0, 1)
      end = new Date(today.getFullYear(), 11, 31)
    } else if (p.special === 'all') {
      start = ""
      end = ""
    }

    onFromChange(start ? start.toISOString().split('T')[0] : "")
    onToChange(end ? end.toISOString().split('T')[0] : "")
    setOpen(false)
  }

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-all"
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar className="h-4 w-4 opacity-50" />
          <span>{from || "Início"}</span>
          <span className="opacity-50">→</span>
          <span>{to || "Fim"}</span>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in zoom-in-95 backdrop-blur-md">
          <div className="p-3 grid grid-cols-2 gap-2 border-b border-border bg-muted/20">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)}
                className="text-[10px] uppercase tracking-wider font-bold py-1.5 px-2 rounded bg-background border border-border hover:border-primary hover:text-primary transition-all">
                {p.label}
              </button>
            ))}
          </div>
          <div className="p-3 space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Personalizado</span>
              <div className="flex items-center gap-2">
                <input type="date" value={from} onChange={e => onFromChange(e.target.value)}
                  className="flex-1 bg-background border border-border rounded p-1 text-xs outline-none focus:border-primary" />
                <input type="date" value={to} onChange={e => onToChange(e.target.value)}
                  className="flex-1 bg-background border border-border rounded p-1 text-xs outline-none focus:border-primary" />
              </div>
            </div>
            <Button size="sm" className="w-full text-xs" onClick={() => setOpen(false)}>Aplicar</Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Switch({ checked, onCheckedChange, className, ...props }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  )
}
