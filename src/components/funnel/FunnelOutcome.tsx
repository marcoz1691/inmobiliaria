"use client";

import type { RefObject } from "react";
import { whatsappHref } from "@/components/public/WhatsAppButton";
import { Button } from "@/components/ui/Button";
import type { BookingConfirmation } from "./types";

type Props = {
  phase: { kind: "booked"; booking: BookingConfirmation } | { kind: "unqualified" } | { kind: "no-slots" };
  headingRef?: RefObject<HTMLHeadingElement | null>;
  contact: { whatsapp: string | null; name: string };
};

const headingClass = "font-display text-display-md text-balance text-ink focus:outline-none";

export function FunnelOutcome({ phase, headingRef, contact }: Props) {
  if (phase.kind === "booked") {
    const b = phase.booking;
    return (
      <section role="status" aria-labelledby="resultado" className="animate-rise rounded-lg bg-sand p-6 sm:p-10">
        <p className="inline-flex items-center gap-2 text-eyebrow text-available">
          <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-full bg-available text-white">
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 10.5 3.2 3.2L15 7" />
            </svg>
          </span>
          Cita confirmada
        </p>
        <h2 id="resultado" ref={headingRef} tabIndex={-1} className={`mt-4 ${headingClass}`}>
          Te espero el <span className="whitespace-nowrap">{b.when}</span>
        </h2>
        <dl className="mt-6 divide-y divide-line rounded-md bg-white px-5">
          <div className="flex justify-between gap-6 py-4">
            <dt className="text-[0.9375rem] text-ink-muted">Duración</dt>
            <dd className="text-[1.0625rem] font-medium text-ink">{b.durationMinutes} minutos</dd>
          </div>
          <div className="flex justify-between gap-6 py-4">
            <dt className="text-[0.9375rem] text-ink-muted">Modalidad</dt>
            <dd className="text-[1.0625rem] font-medium text-ink">{b.meetingLabel}</dd>
          </div>
        </dl>
        <p className="mt-6 max-w-prose text-base text-ink-muted">
          Guarda la cita en tu calendario. Si necesitas cambiarla o cancelarla, usa el enlace para gestionarla.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {/* Plain anchor: a Link would prefetch the file. */}
          <a
            href={b.icsUrl}
            download="cita.ics"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-navy px-7 text-[1.0625rem] font-medium whitespace-nowrap text-white transition-colors duration-300 ease-apple hover:bg-navy-hover"
          >
            Añadir a mi calendario
          </a>
          <Button href={b.manageUrl} variant="secondary" size="lg">
            Gestionar mi cita
          </Button>
        </div>
      </section>
    );
  }

  const wa = contact.whatsapp ? whatsappHref(contact.whatsapp, `Hola ${contact.name}, quisiera agendar una cita.`) : null;

  if (phase.kind === "no-slots") {
    return (
      <div className="mt-4">
        <p className="max-w-prose text-base text-ink-muted">
          Ya recibí tus datos. En este momento la agenda está llena; te contactaré para coordinar un horario.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {wa ? (
            <Button href={wa} size="lg">
              Escríbeme por WhatsApp
            </Button>
          ) : null}
          <Button href="/contacto" variant={wa ? "secondary" : "primary"} size="lg">
            Ir a contacto
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section role="status" aria-labelledby="resultado" className="animate-rise rounded-lg bg-sand p-6 sm:p-10">
      <h2 id="resultado" ref={headingRef} tabIndex={-1} className={headingClass}>
        Por ahora no es el mejor momento para una cita
      </h2>
      <p className="mt-4 max-w-prose text-lead text-pretty text-ink-muted">
        Gracias por tus respuestas. Te enviamos opciones por correo para que las revises con calma, y cuando estés listo podemos
        agendar.
      </p>
      <div className="mt-6">
        <Button href="/propiedades" size="lg">
          Ver propiedades
        </Button>
      </div>
    </section>
  );
}
