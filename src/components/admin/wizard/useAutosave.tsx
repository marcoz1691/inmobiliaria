"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/components/ui/cn";
import { Spinner } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { ease } from "../ui/motion";

export type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

type Saver = (patch: Record<string, unknown>) => Promise<ActionResult<unknown>>;

const DEBOUNCE_MS = 800;
const backupKey = (id: string) => `panel:draft:${id}`;

function readBackup(id: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(backupKey(id));
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
function writeBackup(id: string, patch: Record<string, unknown> | null) {
  try {
    if (patch && Object.keys(patch).length) localStorage.setItem(backupKey(id), JSON.stringify(patch));
    else localStorage.removeItem(backupKey(id));
  } catch {
    // Storage may be unavailable (private mode); the in-memory queue still retries.
  }
}

/**
 * Debounced autosave that never drops edits: pending fields are merged, kept in memory and in
 * localStorage until the server confirms, and retried with backoff while offline.
 */
export function useAutosave(propertyId: string, save: Saver) {
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);
  const retryDelay = useRef(2000);
  const saveRef = useRef(save);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inflight.current) await inflight.current;
    const patch = pending.current;
    if (!Object.keys(patch).length) return true;
    pending.current = {};
    setState("saving");
    const attempt = (async () => {
      try {
        const r = await saveRef.current(patch);
        if (r.ok) {
          retryDelay.current = 2000;
          setError(null);
          setServerErrors({});
          writeBackup(propertyId, pending.current);
          setState(Object.keys(pending.current).length ? "saving" : "saved");
          return true;
        }
        // Rejected by validation: keep the user's text on screen, but do not resend it in a loop.
        setError(r.error);
        setServerErrors(r.fieldErrors ?? {});
        writeBackup(propertyId, pending.current);
        setState("error");
        return false;
      } catch {
        // Network failure: put the patch back (newer edits win) and retry later.
        pending.current = { ...patch, ...pending.current };
        writeBackup(propertyId, pending.current);
        setState("offline");
        const delay = retryDelay.current;
        retryDelay.current = Math.min(delay * 2, 15000);
        timer.current = setTimeout(() => void flushRef.current(), delay);
        return false;
      }
    })();
    inflight.current = attempt;
    const ok = await attempt;
    inflight.current = null;
    if (ok && Object.keys(pending.current).length) return flushRef.current();
    return ok;
  }, [propertyId]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const queue = useCallback(
    (patch: Record<string, unknown>) => {
      Object.assign(pending.current, patch);
      writeBackup(propertyId, pending.current);
      if (state !== "offline") setState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    },
    [flush, propertyId, state],
  );

  /** Drops a field from the queue (e.g. it became invalid before it was sent). */
  const discard = useCallback((field: string) => {
    delete pending.current[field];
  }, []);

  useEffect(() => {
    const online = () => {
      retryDelay.current = 2000;
      void flush();
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length || inflight.current) e.preventDefault();
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [flush]);

  return { state, error, serverErrors, queue, flush, discard, readBackup: () => readBackup(propertyId) };
}

export function SaveStatus({ state, error }: { state: SaveState; error: string | null }) {
  const text: Record<SaveState, string> = {
    idle: "Los cambios se guardan solos",
    saving: "Guardando…",
    saved: "Guardado",
    offline: "Sin conexión, reintentando…",
    error: error ?? "No se pudo guardar",
  };
  const tone =
    state === "error" ? "bg-sold-bg text-sold" : state === "offline" ? "bg-reserved-bg text-reserved" : state === "saved" ? "bg-available-bg text-available" : "bg-ink/[0.05] text-ink-muted";
  return (
    <p role="status" aria-live="polite" className={cn("inline-flex min-h-8 max-w-[60vw] items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium transition-colors duration-300", ease, tone)}>
      {state === "saving" ? (
        <Spinner />
      ) : state === "saved" ? (
        <Icon name="check" className="size-3.5 shrink-0" strokeWidth={2.6} />
      ) : state === "idle" ? null : (
        <Icon name="alert" className="size-3.5 shrink-0" strokeWidth={2.2} />
      )}
      <span className="truncate">{text[state]}</span>
    </p>
  );
}
