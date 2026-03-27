import { useState, useRef, useEffect } from "react"
import { ChevronDown, Check } from "lucide-react"

/**
 * SearchableSelect — a filterable dropdown that mirrors <select> semantics.
 * Props:
 *   value, onChange(value_string), options=[{value,label}], placeholder, className
 */
export default function SearchableSelect({ value, onChange, options = [], placeholder = "Selecionar...", className = "", disabled = false }) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef(null)

  const selected = options.find(o => String(o.value) === String(value))

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const pick = (val) => { onChange(val); setOpen(false); setQuery("") }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(o => !o) }}
        className="w-full flex items-center justify-between gap-2 h-9 px-3 text-sm rounded-md border border-input bg-background hover:bg-accent/20 transition-colors text-left disabled:opacity-50"
      >
        <span className={`truncate ${selected ? "text-foreground" : "text-muted-foreground"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className={`text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}/>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-48 rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full h-7 px-2 text-sm bg-background border border-input rounded-md outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground text-center">Nenhum resultado</li>
            )}
            {filtered.map((o) => (
              <li key={o.value}
                onClick={() => pick(o.value)}
                className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent/60 transition-colors ${String(o.value) === String(value) ? "text-primary font-medium" : ""}`}
              >
                {String(o.value) === String(value) && <Check size={12} className="shrink-0"/>}
                <span className="flex-1 truncate">{o.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
