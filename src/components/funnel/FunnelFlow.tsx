"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ConsentCheckbox, Honeypot, TextField } from "@/components/public/fields";
import { Button } from "@/components/ui/Button";
import { trackPixel } from "./MetaPixel";
import { FunnelOutcome } from "./FunnelOutcome";
import { QuestionStep } from "./QuestionStep";
import { SlotPicker } from "./SlotPicker";
import { readTracking, type Tracking } from "./tracking";
import type { BookingConfirmation, BookResult, FunnelAnswers, FunnelSubmitInput, FunnelSubmitResult, PublicQuestion, Schedule } from "./types";

type Props = {
  slug: string;
  questions: PublicQuestion[];
  consentText: string;
  formToken: string;
  honeypotName: string;
  pixel: boolean;
  contact: { whatsapp: string | null; name: string };
  submit: (slug: string, input: FunnelSubmitInput) => Promise<FunnelSubmitResult>;
  book: (slug: string, input: { submissionId: string; pass: string; startsAt: string }) => Promise<BookResult>;
};

type Phase =
  | { kind: "form" }
  | { kind: "schedule"; submissionId: string; pass: string; schedule: Schedule }
  | { kind: "booked"; booking: BookingConfirmation }
  | { kind: "unqualified" };

const isEmpty = (v: FunnelAnswers[string] | undefined) => v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** One question per step, then contact details, then the calendar. No chat, no dead ends. */
export function FunnelFlow({ slug, questions, consentText, formToken, honeypotName, pixel, contact, submit, book }: Props) {
  const total = questions.length + 1;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<FunnelAnswers>({});
  const [stepError, setStepError] = useState<string>();
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tracking = useRef<Tracking & { eventId?: string }>({ utm: {} });
  const firstRender = useRef(true);

  useEffect(() => {
    const eventId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    tracking.current = { ...readTracking(new URLSearchParams(window.location.search), document.cookie), eventId };
  }, []);

  // Move focus to the new step's heading so screen readers announce it (not on first load).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step, phase.kind]);

  const question = questions[step];

  function next() {
    if (question?.required && isEmpty(answers[question.id])) {
      setStepError(question.type === "single" || question.type === "multi" ? "Elige una opción para continuar." : "Responde para continuar.");
      return;
    }
    setStepError(undefined);
    setStep((s) => Math.min(s + 1, total - 1));
  }

  function back() {
    setStepError(undefined);
    setStep((s) => Math.max(0, s - 1));
  }

  function onSubmitContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const t = tracking.current;
    const input: FunnelSubmitInput = {
      answers: Object.fromEntries(Object.entries(answers).filter(([, v]) => !isEmpty(v))),
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      consent: fd.get("consent") === "on",
      utm: t.utm,
      fbclid: t.fbclid,
      fbc: t.fbc,
      fbp: t.fbp,
      eventId: t.eventId,
      formToken,
      honeypot: String(fd.get(honeypotName) ?? ""),
    };
    setFormError(undefined);
    startTransition(async () => {
      const res = await submit(slug, input);
      if (!res.ok) {
        setFormError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setFieldErrors({});
      if (pixel && t.eventId) trackPixel("Lead", t.eventId);
      setPhase(res.qualified ? { kind: "schedule", submissionId: res.submissionId, pass: res.pass, schedule: res.schedule } : { kind: "unqualified" });
    });
  }

  function onConfirmSlot(iso: string) {
    if (phase.kind !== "schedule") return;
    setFormError(undefined);
    startTransition(async () => {
      const res = await book(slug, { submissionId: phase.submissionId, pass: phase.pass, startsAt: iso });
      if (!res.ok) {
        setFormError(res.error);
        if (res.schedule) setPhase({ ...phase, schedule: res.schedule });
        return;
      }
      if (pixel) trackPixel("Schedule", `schedule-${res.booking.bookingId}`);
      setPhase({ kind: "booked", booking: res.booking });
    });
  }

  if (phase.kind === "booked" || phase.kind === "unqualified") {
    return <FunnelOutcome phase={phase} headingRef={headingRef} contact={contact} />;
  }

  if (phase.kind === "schedule") {
    const hasSlots = phase.schedule.days.length > 0;
    return (
      <section aria-labelledby="paso-titulo">
        <p className="text-eyebrow text-clay">Último paso</p>
        <h2 id="paso-titulo" ref={headingRef} tabIndex={-1} className="mt-2 font-display text-display-md text-ink focus:outline-none">
          {hasSlots ? "Elige un horario para tu cita" : "Por ahora no hay horarios libres"}
        </h2>
        {hasSlots ? (
          <div className="mt-6">
            <SlotPicker schedule={phase.schedule} pending={pending} error={formError} onConfirm={onConfirmSlot} />
          </div>
        ) : (
          <FunnelOutcome phase={{ kind: "no-slots" }} contact={contact} />
        )}
      </section>
    );
  }

  const progress = Math.round(((step + 1) / total) * 100);
  const onContact = step === total - 1;

  return (
    <div>
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <p>
          Paso {step + 1} de {total}
        </p>
        {step > 0 ? (
          <button type="button" onClick={back} className="-mr-3 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[0.9375rem] text-link hover:bg-navy/5">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12.5 4.5 7 10l5.5 5.5" />
            </svg>
            Atrás
          </button>
        ) : null}
      </div>
      <div role="progressbar" aria-label="Progreso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-mist">
        <div className="h-full rounded-full bg-navy transition-[width] duration-500 ease-apple" style={{ width: `${progress}%` }} />
      </div>

      {!onContact && question ? (
        <form
          key={question.id}
          className="mt-10 animate-[rise_0.5s_var(--ease-apple)_both]"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
          noValidate
        >
          <h2 id={`${question.id}-title`} ref={headingRef} tabIndex={-1} className="font-display text-display-md text-balance text-ink focus:outline-none">
            {question.label}
          </h2>
          <div className="mt-6">
            <QuestionStep
              question={question}
              value={answers[question.id]}
              error={stepError}
              onChange={(v) => {
                setStepError(undefined);
                setAnswers((a) => ({ ...a, [question.id]: v }));
              }}
              onPick={() => setTimeout(() => setStep((s) => Math.min(s + 1, total - 1)), 180)}
            />
          </div>
          <Button type="submit" size="lg" className="mt-8 w-full sm:w-auto">
            Siguiente
          </Button>
        </form>
      ) : (
        <form className="relative mt-10 flex animate-[rise_0.5s_var(--ease-apple)_both] flex-col gap-5" onSubmit={onSubmitContact} noValidate>
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-display-md text-ink focus:outline-none">
            ¿A quién le confirmamos la cita?
          </h2>
          <p className="-mt-2 text-base text-ink-muted">Al enviar verás los horarios disponibles.</p>
          <Honeypot name={honeypotName} />
          {formError ? (
            <p role="alert" className="rounded-sm bg-sold-bg px-4 py-3 text-sm font-medium text-sold">
              {formError}
            </p>
          ) : null}
          <TextField id="f-name" name="name" label="Nombre" autoComplete="name" required error={fieldErrors.name?.[0]} />
          <TextField id="f-email" name="email" label="Correo" type="email" autoComplete="email" inputMode="email" required error={fieldErrors.email?.[0]} />
          <TextField id="f-phone" name="phone" label="Teléfono o WhatsApp" type="tel" autoComplete="tel" inputMode="tel" required hint="Ej.: 099 123 4567" error={fieldErrors.phone?.[0]} />
          <ConsentCheckbox id="f-consent" text={consentText} error={fieldErrors.consent?.[0]} />
          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
            {pending ? "Enviando…" : "Ver horarios disponibles"}
          </Button>
        </form>
      )}
    </div>
  );
}
