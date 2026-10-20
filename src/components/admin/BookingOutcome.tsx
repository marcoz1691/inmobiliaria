"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { bookingOutcomeAction } from "@/app/panel/(app)/agenda/actions";

export function BookingOutcome({ bookingId, who }: { bookingId: string; who: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const mark = (o: "completed" | "no_show") =>
    start(async () => {
      const r = await bookingOutcomeAction(bookingId, o);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" disabled={pending} onClick={() => mark("completed")}>
        Asistió<span className="sr-only"> ({who})</span>
      </Button>
      <Button variant="ghost" disabled={pending} onClick={() => mark("no_show")}>
        No asistió<span className="sr-only"> ({who})</span>
      </Button>
      {error ? (
        <p role="alert" className="w-full text-sm text-sold">
          {error}
        </p>
      ) : null}
    </div>
  );
}
