import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { ToastContext, type ToastKind } from "./toast";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const DURATION_MS = 4000;
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.kind}`}>
            {toast.kind === "success" ? <CircleCheck size={18} /> : <CircleAlert size={18} />}
            <span>{toast.message}</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Fermer la notification"
              onClick={() => dismiss(toast.id)}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
