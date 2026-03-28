
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"

export function Dialog({ open, onClose, children, title, titleAction, className }) {
  if (!open) return null
  return (
    <div className="fixed top-[-20px] left-0 right-0 bottom-0  z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "relative z-10 w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl animate-fade-in p-6 max-h-[95vh] flex flex-col",
        className
      )}>
        {title && (
          <div className="flex items-center justify-between mb-4 shrink-0 gap-3">
            <h2 className="text-lg font-semibold text-foreground flex-1">{title}</h2>
            {titleAction && <div className="shrink-0">{titleAction}</div>}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none shrink-0">✕</button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  )
}

export function FormField({ label, children, className }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="text-sm font-medium text-muted-foreground">{label}</label>}
      {children}
    </div>
  )
}
