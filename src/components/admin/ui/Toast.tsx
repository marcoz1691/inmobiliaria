"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Icon } from "./Icon";
import { ease } from "./motion";

type Tone = "success" | "error" | "info";
type ToastItem = { id: number; text: string; tone: Tone; leaving?: boolean };
type ToastApi = { success: (text: string) => void; error: (text: string) => void; info: (text: string) => void };

const noop: ToastApi = { success: () => {}, error: () => {}, info: () => {} };
const ToastContext = createContext<ToastApi>(noop);

/** Shows short confirmations of what an action did. Field errors stay next to their field. */
export const useToast = () => useContext(ToastContext);

const ICON: Record<Tone, { name: "checkCircle" | "alert" | "info"; className: string }> = {
  success: { name: "checkCircle", className: "text-available" },
  error: { name: "alert", className: "text-sold" },
  info: { name: "info", className: "text-navy" },
};

/**
 * Capsule toasts at the top center (below the notch on phones). Announced through a polite live
 * region; tapping one dismisses it. Enter animates with `@starting-style`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((all) => all.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((all) => all.filter((t) => t.id !== id)), 320);
  }, []);

  const push = useCallback(
    (tone: Tone, text: string) => {
      const id = ++seq.current;
      setItems((all) => [...all.filter((t) => t.text !== text).slice(-2), { id, text, tone }]);
      setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(() => ({ success: (t) => push("success", t), error: (t) => push("error", t), info: (t) => push("info", t) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={cn(
              "pointer-events-auto flex max-w-[min(32rem,100%)] items-center gap-2.5 rounded-full bg-white/90 py-2.5 pr-5 pl-3.5 text-left text-[0.9375rem] font-medium text-ink backdrop-blur-xl backdrop-saturate-150",
              "shadow-[0_12px_40px_-8px_rgba(0,0,0,0.22),0_0_0_0.5px_rgba(0,0,0,0.08)]",
              "transition-[opacity,translate,scale] duration-500",
              ease,
              "starting:-translate-y-4 starting:scale-90 starting:opacity-0",
              t.leaving && "-translate-y-2 scale-95 opacity-0",
            )}
          >
            <Icon name={ICON[t.tone].name} className={cn("size-5 shrink-0", ICON[t.tone].className)} strokeWidth={2} />
            <span>{t.text}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
