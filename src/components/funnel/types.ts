import type { SlotDay } from "./slots";

/** Question as sent to the browser: scores and disqualifying flags stay on the server. */
export type PublicQuestion = {
  id: string;
  label: string;
  help?: string;
  type: "single" | "multi" | "text" | "number";
  required: boolean;
  options?: { value: string; label: string }[];
};

export type FunnelAnswers = Record<string, string | string[] | number>;

export type FunnelSubmitInput = {
  answers: FunnelAnswers;
  name: string;
  email: string;
  phone: string;
  consent: boolean;
  utm: Record<string, string>;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  eventId?: string;
  formToken: string;
  honeypot: string;
};

export type Schedule = { timezone: string; durationMinutes: number; days: SlotDay[] };

export type FunnelSubmitResult =
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
  | { ok: true; qualified: false }
  | { ok: true; qualified: true; submissionId: string; pass: string; schedule: Schedule };

export type BookingConfirmation = {
  bookingId: string;
  when: string;
  durationMinutes: number;
  meetingLabel: string;
  manageUrl: string;
  icsUrl: string;
};

export type BookResult =
  | { ok: true; booking: BookingConfirmation }
  | { ok: false; error: string; schedule?: Schedule };

export const MEETING_LABEL = { video: "Videollamada", phone: "Llamada telefónica", in_person: "Reunión presencial" } as const;
