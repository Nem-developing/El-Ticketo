import { createContext, useContext, useMemo } from "react";

export type ToastKind = "success" | "error";

export interface ToastContextValue {
  notify: (kind: ToastKind, message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  return useMemo(() => {
    if (!context) throw new Error("useToast doit être utilisé dans <ToastProvider>.");
    return {
      success: (message: string) => context.notify("success", message),
      error: (message: string) => context.notify("error", message),
    };
  }, [context]);
}
