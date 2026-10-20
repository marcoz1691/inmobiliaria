"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

type FilterFormProps = { action: string; children: ReactNode; className?: string; label: string };

/**
 * GET form that works without JavaScript. With JS, empty fields are left out of the URL and
 * navigation stays client-side, so the results skeleton shows while the server filters.
 */
export function FilterForm({ action, children, className, label }: FilterFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(e.currentTarget)) {
      if (typeof v === "string" && v.trim() !== "") params.set(k, v.trim());
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${action}?${qs}` : action, { scroll: false }));
  }

  return (
    <form method="get" action={action} onSubmit={onSubmit} aria-label={label} aria-busy={pending} className={className}>
      {children}
    </form>
  );
}
