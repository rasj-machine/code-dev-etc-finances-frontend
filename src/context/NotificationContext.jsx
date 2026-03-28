import { createContext, useContext, useState, useCallback, useRef } from "react"
import { Dialog } from "@/components/Dialog"
import { Button } from "@/components/ui"
import { CheckCircle2, AlertCircle, Info, XCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const [modal, setModal] = useState(null) // { type, title, message, onOk, onCancel, icon: Icon }
  const [toasts, setToasts] = useState([])
  const toastIdRef = useRef(0)

  const showToast = useCallback((message, type = "default", duration = 4000) => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const confirm = useCallback((message, title = "Confirmar") => {
    return new Promise((resolve) => {
      setModal({
        type: "confirm",
        title: title || "Confirmar",
        message,
        icon: Info,
        onOk: () => { setModal(null); resolve(true) },
        onCancel: () => { setModal(null); resolve(false) }
      })
    })
  }, [])

  // Alert signature: alert(type, message, optionalTitle)
  // If type is success/info, we might just toast it.
  const alert = useCallback((typeOrMsg, message, title) => {
    const types = ["success", "error", "warning", "info"]
    let type = "info"
    let msg = typeOrMsg
    let hdr = title

    if (types.includes(typeOrMsg)) {
      type = typeOrMsg
      msg = message
      hdr = title
    }

    // Auto-toast successes/infos that are simple
    if (type === "success" || (type === "info" && msg.length < 50)) {
      showToast(msg, type)
      return Promise.resolve()
    }

    const Icon = 
      type === 'error' ? XCircle : 
      type === 'warning' ? AlertCircle :
      type === 'success' ? CheckCircle2 : Info

    return new Promise((resolve) => {
      setModal({
        type: "alert",
        title: hdr || (type === 'error' ? 'Erro' : type === 'warning' ? 'Atenção' : 'Aviso'),
        message: msg,
        icon: Icon,
        variant: type,
        onOk: () => { setModal(null); resolve() }
      })
    })
  }, [showToast])

  return (
    <NotificationContext.Provider value={{ alert, confirm, toast: showToast }}>
      {children}
      
      {/* Premium Global Modal */}
      <Dialog 
        open={!!modal} 
        onClose={modal?.type === 'alert' ? modal.onOk : modal?.onCancel}
        title={""} // Custom title in body for better design
        className="max-w-sm p-0 overflow-hidden border-none shadow-none bg-transparent"
      >
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="p-6 flex flex-col items-center text-center space-y-4">
             {/* Icon with pulsing background */}
             <div className="relative">
                <div className={cn(
                  "absolute inset-0 rounded-full animate-ping opacity-20 duration-1000",
                  modal?.variant === 'error' ? "bg-destructive" :
                  modal?.variant === 'warning' ? "bg-warning" : "bg-primary"
                )} />
                <div className={cn(
                  "relative p-4 rounded-full",
                  modal?.variant === 'error' ? "bg-destructive/10 text-destructive border border-destructive/20" :
                  modal?.variant === 'warning' ? "bg-warning/10 text-warning border border-warning/20" : 
                  "bg-primary/10 text-primary border border-primary/20"
                )}>
                  {modal?.icon && <modal.icon size={36} strokeWidth={2.5} />}
                </div>
             </div>

             <div className="space-y-1.5 pt-2">
                <h3 className="text-lg font-bold tracking-tight">{modal?.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed px-4">
                  {modal?.message}
                </p>
             </div>

             <div className="flex gap-2 w-full pt-4">
               {modal?.type === 'confirm' && (
                 <Button variant="ghost" className="flex-1 h-11 font-semibold" onClick={modal.onCancel}>
                   Cancelar
                 </Button>
               )}
               <Button 
                className={cn(
                  "flex-1 h-11 font-bold shadow-lg",
                  modal?.variant === 'error' ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-destructive/20" :
                  modal?.variant === 'warning' ? "bg-warning hover:bg-warning/90 text-warning-foreground shadow-warning/20" :
                  "shadow-primary/20"
                )} 
                onClick={modal?.onOk}
               >
                 {modal?.type === 'confirm' ? 'Confirmar' : 'Entendido'}
               </Button>
             </div>
          </div>
        </div>
      </Dialog>

      {/* Glassmorphic Toasts Container */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3 pointer-events-none items-end">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={cn(
              "group pointer-events-auto flex items-center gap-3.5 px-5 py-3.5 rounded-2xl border shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] min-w-[300px] max-w-md bg-card/70 backdrop-blur-xl animate-in slide-in-from-right-full slide-in-from-bottom-5 duration-500",
              t.type === 'success' ? "border-success/30 bg-success/5" : 
              t.type === 'error' ? "border-destructive/30 bg-destructive/5" : "border-border/60"
            )}
          >
             <div className={cn(
               "shrink-0 p-2 rounded-xl",
               t.type === 'success' ? "bg-success/20 text-success" : 
               t.type === 'error' ? "bg-destructive/20 text-destructive" : 
               "bg-primary/10 text-primary"
             )}>
                {t.type === 'success' ? <CheckCircle2 size={18} /> : 
                 t.type === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
             </div>
             <div className="flex-1 flex flex-col min-w-0">
               <span className="text-xs font-bold capitalize tracking-tight opacity-50 mb-0.5">
                  {t.type === 'default' ? 'Informação' : t.type}
               </span>
               <p className="text-[13px] font-medium leading-tight text-foreground/90">{t.message}</p>
             </div>
             <div className="h-1.5 w-1.5 rounded-full bg-border group-hover:bg-primary transition-colors duration-300" />
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error("useNotification must be used within NotificationProvider")
  return ctx
}
