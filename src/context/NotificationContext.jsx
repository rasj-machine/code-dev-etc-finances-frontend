import { createContext, useContext, useState, useCallback, useRef } from "react"
import { Dialog } from "@/components/Dialog"
import { Button } from "@/components/ui"
import { CheckCircle2, AlertCircle, Info, XCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const [modal, setModal] = useState(null) // { type: 'alert'|'confirm', title, message, onOk, onCancel }
  const [toasts, setToasts] = useState([])
  const toastIdRef = useRef(0)

  const showToast = useCallback((message, type = "default", duration = 3000) => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const alert = useCallback((message, title = "Aviso") => {
    return new Promise((resolve) => {
      setModal({
        type: "alert",
        title: title || "Aviso",
        message,
        onOk: () => {
          setModal(null)
          resolve()
        }
      })
    })
  }, [])

  const confirm = useCallback((message, title = "Confirmar") => {
    return new Promise((resolve) => {
      setModal({
        type: "confirm",
        title: title || "Confirmar",
        message,
        onOk: () => {
          setModal(null)
          resolve(true)
        },
        onCancel: () => {
          setModal(null)
          resolve(false)
        }
      })
    })
  }, [])

  return (
    <NotificationContext.Provider value={{ alert, confirm, toast: showToast }}>
      {children}
      
      {/* Global Modal */}
      <Dialog 
        open={!!modal} 
        onClose={modal?.type === 'alert' ? modal.onOk : modal?.onCancel}
        title={modal?.title}
        className="max-w-sm"
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className={cn(
            "p-3 rounded-full",
            modal?.type === 'confirm' ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
          )}>
            {modal?.type === 'confirm' ? <Info size={32} /> : <AlertCircle size={32} />}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed px-2">
            {modal?.message}
          </p>
          <div className="flex gap-2 w-full pt-4">
            {modal?.type === 'confirm' && (
              <Button variant="ghost" className="flex-1" onClick={modal.onCancel}>
                Cancelar
              </Button>
            )}
            <Button className="flex-1" onClick={modal?.onOk}>
              {modal?.type === 'confirm' ? 'Confirmar' : 'Entendido'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Toasts Container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl animate-in slide-in-from-right-10 duration-300 min-w-[200px] bg-card/80 backdrop-blur-md",
              t.type === 'success' ? "border-success/20" : 
              t.type === 'error' ? "border-destructive/20" : "border-border"
            )}
          >
             <div className={cn(
               "shrink-0",
               t.type === 'success' ? "text-success" : 
               t.type === 'error' ? "text-destructive" : "text-primary"
             )}>
                {t.type === 'success' ? <CheckCircle2 size={18} /> : 
                 t.type === 'error' ? <XCircle size={18} /> : <Info size={18} />}
             </div>
             <span className="text-xs font-semibold">{t.message}</span>
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
