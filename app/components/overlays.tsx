"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, IconButton, cn } from "./ui";

/* ───────────── Sheet: bottom sheet on mobile, centered dialog on desktop ───────────── */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="flex justify-center pt-2.5 sm:hidden">
              <span className="h-1.5 w-10 rounded-full bg-slate-300" />
            </div>
            <div className="flex items-center justify-between px-5 pb-2 pt-2 sm:pt-4">
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              <IconButton label="Close" onClick={onClose} className="-mr-2">
                <X className="size-5" />
              </IconButton>
            </div>
            {/* drag-to-close only from the handle/title, never while scrolling the body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4" onPointerDown={(e) => e.stopPropagation()}>
              {children}
            </div>
            {footer && (
              <div
                className="border-t border-slate-100 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ───────────── Toasts ───────────── */

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

const ToastCtx = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

/* ───────────── Confirm dialog ───────────── */

type ConfirmOptions = { title: string; message?: string; confirmText?: string; danger?: boolean };
const ConfirmCtx = createContext<(opts: ConfirmOptions) => Promise<boolean>>(async () => false);

export function useConfirm() {
  return useContext(ConfirmCtx);
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 4500 : 2800);
  }, []);

  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })),
    []
  );

  const closeConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  const icons = {
    success: <CheckCircle2 className="size-5 text-emerald-400" />,
    error: <XCircle className="size-5 text-red-400" />,
    info: <Info className="size-5 text-sky-300" />,
  };

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {children}

        {/* toasts: top on mobile (clear of the bottom nav), bottom-right on desktop */}
        <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-auto lg:items-end">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl"
              >
                {icons[t.kind]}
                {t.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {confirmState && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
              <motion.div
                className="absolute inset-0 bg-slate-900/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => closeConfirm(false)}
              />
              <motion.div
                role="alertdialog"
                className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
              >
                <div
                  className={cn(
                    "mx-auto mb-3 flex size-12 items-center justify-center rounded-full",
                    confirmState.danger ? "bg-red-50 text-red-500" : "bg-brand-50 text-brand-600"
                  )}
                >
                  <AlertTriangle className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{confirmState.title}</h3>
                {confirmState.message && <p className="mt-1 text-sm text-slate-500">{confirmState.message}</p>}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => closeConfirm(false)}>
                    Cancel
                  </Button>
                  <Button
                    className={confirmState.danger ? "bg-red-600 hover:bg-red-700 active:bg-red-800" : undefined}
                    onClick={() => closeConfirm(true)}
                  >
                    {confirmState.confirmText || "Confirm"}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}
