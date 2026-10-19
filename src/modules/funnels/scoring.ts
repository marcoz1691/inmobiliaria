import type { FunnelQuestion } from "@/server/db/schema";

export type Answers = Record<string, string | string[] | number>;
export type ScoreResult = { score: number; qualified: boolean; disqualifiedReason: string | null; missing: string[] };

/**
 * Rule-based qualification: each chosen option adds its score; an option flagged `disqualify`
 * ends qualification regardless of score. Free-text answers never score.
 */
export function scoreSubmission(questions: FunnelQuestion[], answers: Answers, threshold: number): ScoreResult {
  let score = 0;
  let disqualifiedReason: string | null = null;
  const missing: string[] = [];
  for (const q of questions) {
    const raw = answers[q.id];
    const empty = raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0);
    if (empty) {
      if (q.required) missing.push(q.id);
      continue;
    }
    if (q.type !== "single" && q.type !== "multi") continue;
    const values = Array.isArray(raw) ? raw : [String(raw)];
    for (const v of values) {
      const opt = q.options?.find((o) => o.value === v);
      if (!opt) {
        missing.push(q.id);
        continue;
      }
      score += opt.score;
      if (opt.disqualify && !disqualifiedReason) disqualifiedReason = `${q.label}: ${opt.label}`;
    }
  }
  return { score, qualified: missing.length === 0 && !disqualifiedReason && score >= threshold, disqualifiedReason, missing };
}

export type FunnelTemplate = {
  key: "real_estate_buyer" | "high_ticket_service";
  vertical: "real_estate" | "services";
  name: string;
  headline: string;
  subheadline: string;
  threshold: number;
  durationMinutes: number;
  meetingKind: "video" | "phone" | "in_person";
  questions: FunnelQuestion[];
};

export const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  {
    key: "real_estate_buyer",
    vertical: "real_estate",
    name: "Comprador calificado",
    headline: "Agenda una asesoría para encontrar tu propiedad",
    subheadline: "Responde 5 preguntas rápidas y elige un horario. Sin compromiso.",
    threshold: 6,
    durationMinutes: 30,
    meetingKind: "video",
    questions: [
      {
        id: "objetivo",
        label: "¿Qué estás buscando?",
        type: "single",
        required: true,
        options: [
          { value: "vivir", label: "Comprar para vivir", score: 2 },
          { value: "invertir", label: "Comprar para invertir", score: 2 },
          { value: "alquilar", label: "Alquilar", score: 1 },
          { value: "vender", label: "Vender mi propiedad", score: 2 },
        ],
      },
      {
        id: "presupuesto",
        label: "¿Cuál es tu presupuesto aproximado?",
        type: "single",
        required: true,
        options: [
          { value: "lt60", label: "Menos de US$60.000", score: 1 },
          { value: "60-150", label: "US$60.000 – 150.000", score: 2 },
          { value: "150-300", label: "US$150.000 – 300.000", score: 3 },
          { value: "gt300", label: "Más de US$300.000", score: 3 },
        ],
      },
      {
        id: "pago",
        label: "¿Cómo planeas pagar?",
        type: "single",
        required: true,
        options: [
          { value: "contado", label: "De contado", score: 3 },
          { value: "credito_aprobado", label: "Crédito ya aprobado o en trámite", score: 3 },
          { value: "credito_por_iniciar", label: "Crédito, aún no lo inicio", score: 1 },
          { value: "no_se", label: "Aún no lo sé", score: 0 },
        ],
      },
      {
        id: "plazo",
        label: "¿En qué plazo quieres concretar?",
        type: "single",
        required: true,
        options: [
          { value: "1m", label: "Este mes", score: 3 },
          { value: "3m", label: "En 1 a 3 meses", score: 2 },
          { value: "6m", label: "En 3 a 6 meses", score: 1 },
          { value: "explorando", label: "Solo estoy explorando", score: 0, disqualify: true },
        ],
      },
      { id: "zona", label: "¿En qué ciudad o sector?", type: "text", required: false },
    ],
  },
  {
    key: "high_ticket_service",
    vertical: "services",
    name: "Sesión estratégica",
    headline: "Agenda tu sesión estratégica",
    subheadline: "Cuéntanos tu situación en menos de un minuto y elige un horario.",
    threshold: 7,
    durationMinutes: 45,
    meetingKind: "video",
    questions: [
      {
        id: "objetivo",
        label: "¿Qué resultado quieres lograr en los próximos 90 días?",
        type: "text",
        required: true,
      },
      {
        id: "inversion",
        label: "¿Cuánto estás dispuesto a invertir para lograrlo?",
        type: "single",
        required: true,
        options: [
          { value: "lt500", label: "Menos de US$500", score: 0, disqualify: true },
          { value: "500-2000", label: "US$500 – 2.000", score: 2 },
          { value: "2000-5000", label: "US$2.000 – 5.000", score: 3 },
          { value: "gt5000", label: "Más de US$5.000", score: 4 },
        ],
      },
      {
        id: "urgencia",
        label: "¿Cuándo quieres empezar?",
        type: "single",
        required: true,
        options: [
          { value: "ya", label: "Ahora mismo", score: 3 },
          { value: "mes", label: "Este mes", score: 2 },
          { value: "despues", label: "Más adelante", score: 0 },
        ],
      },
      {
        id: "decision",
        label: "¿Tomas la decisión tú?",
        type: "single",
        required: true,
        options: [
          { value: "si", label: "Sí, yo decido", score: 2 },
          { value: "compartida", label: "La decido con alguien más", score: 1 },
        ],
      },
    ],
  },
];
