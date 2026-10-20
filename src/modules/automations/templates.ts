/**
 * Message templates (es-EC, tú). Pure functions: the job handlers load the data and pass a context.
 *
 * Rules: no invented data. The agent's name comes from the profile (falls back to the site name);
 * anything missing is left out instead of being made up. Emails to contacts always carry the
 * opt-out link. WhatsApp business-initiated messages must use templates approved in Meta: the
 * names and suggested texts below are documented in docs/integrations.md.
 */

export const CONTACT_TEMPLATES = [
  "booking_confirmation",
  "booking_reminder_24h",
  "booking_reminder_1h",
  "nurture_welcome",
  "nurture_catalog",
  "no_show_followup",
  "lead_booking_invite",
] as const;
export const AGENT_TEMPLATES = ["agent_new_lead", "agent_booking"] as const;

export type ContactTemplate = (typeof CONTACT_TEMPLATES)[number];
export type AgentTemplate = (typeof AGENT_TEMPLATES)[number];
export type TemplateKey = ContactTemplate | AgentTemplate;

export const isContactTemplate = (k: string): k is ContactTemplate => (CONTACT_TEMPLATES as readonly string[]).includes(k);
export const isAgentTemplate = (k: string): k is AgentTemplate => (AGENT_TEMPLATES as readonly string[]).includes(k);

export type BookingInfo = {
  startsAt: Date;
  endsAt: Date;
  meetingKind: "video" | "phone" | "in_person";
  meetingUrl?: string | null;
};

export type TemplateContext = {
  tenantName: string;
  timezone: string;
  /** From the agent profile. Null when the profile has no name (the site name is used instead). */
  agentName?: string | null;
  contactName?: string | null;
  booking?: BookingInfo | null;
  propertyTitle?: string | null;
  propertyUrl?: string | null;
  /** Booking self-service link. Only present when the token could be delivered encrypted. */
  manageUrl?: string | null;
  optOutUrl?: string | null;
  catalogUrl: string;
  /** Active funnel (qualification + calendar) link. */
  funnelUrl?: string | null;
  /** Agent notifications only. */
  lead?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    score?: number | null;
    message?: string | null;
    panelUrl: string;
  } | null;
};

export type RenderedEmail = { subject: string; html: string; text: string };
export type WhatsAppMessage = { name: string; language: string; params: string[] };

/* ───────────── helpers ───────────── */

export function formatDateTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-EC", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const firstName = (name?: string | null) => name?.trim().split(/\s+/)[0] ?? "";
const greeting = (name?: string | null) => (firstName(name) ? `Hola, ${firstName(name)}:` : "Hola:");
const sender = (c: TemplateContext) => c.agentName?.trim() || c.tenantName;

function meetingLine(c: TemplateContext): string {
  const b = c.booking;
  if (!b) return "";
  if (b.meetingKind === "video") {
    return b.meetingUrl ? `Será por videollamada. Enlace: ${b.meetingUrl}` : `Será por videollamada; ${sender(c)} te compartirá el enlace antes de la cita.`;
  }
  if (b.meetingKind === "phone") return "Será una llamada telefónica al número que registraste.";
  return `Será una reunión presencial; ${sender(c)} te confirmará el punto de encuentro.`;
}

type Block = { kind: "p"; text: string } | { kind: "button"; label: string; href: string } | { kind: "small"; text: string };

/** Minimal, accessible email: one column, real text, high contrast, link buttons with visible text. */
function layout(c: TemplateContext, title: string, blocks: Block[], opts: { optOut: boolean }): { html: string; text: string } {
  const body = blocks
    .map((b) => {
      if (b.kind === "p") return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#15171a">${esc(b.text)}</p>`;
      if (b.kind === "small") return `<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#585c63">${esc(b.text)}</p>`;
      return `<p style="margin:8px 0 24px"><a href="${esc(b.href)}" style="display:inline-block;background:#1b2a41;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:12px 22px;border-radius:999px">${esc(b.label)}</a></p>`;
    })
    .join("\n");
  const footer =
    opts.optOut && c.optOutUrl
      ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#585c63">Recibes este mensaje porque dejaste tus datos en el sitio de ${esc(c.tenantName)}. <a href="${esc(c.optOutUrl)}" style="color:#585c63">Dejar de recibir mensajes</a>.</p>`
      : "";
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f7f5f0">
<div role="article" aria-label="${esc(title)}" style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:Arial,Helvetica,sans-serif">
<p style="margin:0 0 20px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#9a4527">${esc(c.tenantName)}</p>
${body}
<p style="margin:16px 0 0;font-size:16px;line-height:1.6;color:#15171a">${esc(sender(c))}</p>
${footer}
</div></body></html>`;
  const text = [
    ...blocks.map((b) => (b.kind === "button" ? `${b.label}: ${b.href}` : b.text)),
    "",
    sender(c),
    ...(opts.optOut && c.optOutUrl ? ["", `Dejar de recibir mensajes: ${c.optOutUrl}`] : []),
  ].join("\n\n");
  return { html, text };
}

/* ───────────── emails ───────────── */

export function renderEmail(key: TemplateKey, c: TemplateContext): RenderedEmail {
  const tz = c.timezone;
  const when = c.booking ? formatDateTime(c.booking.startsAt, tz) : "";
  const property = c.propertyTitle ? ` sobre «${c.propertyTitle}»` : "";
  const manage: Block[] = c.manageUrl ? [{ kind: "button", label: "Ver o cancelar mi cita", href: c.manageUrl }] : [];
  const p = (text: string): Block => ({ kind: "p", text });

  switch (key) {
    case "booking_confirmation": {
      const subject = `Cita confirmada: ${when}`;
      return { subject, ...layout(c, subject, [p(greeting(c.contactName)), p(`Tu cita con ${sender(c)}${property} quedó confirmada para el ${when}.`), p(meetingLine(c)), ...manage, { kind: "small", text: "Si no puedes asistir, avísanos para liberar el horario." }], { optOut: true }) };
    }
    case "booking_reminder_24h": {
      const subject = `Recordatorio: tu cita es mañana`;
      return { subject, ...layout(c, subject, [p(greeting(c.contactName)), p(`Te recordamos tu cita con ${sender(c)}${property}: ${when}.`), p(meetingLine(c)), ...manage], { optOut: true }) };
    }
    case "booking_reminder_1h": {
      const time = c.booking ? formatTime(c.booking.startsAt, tz) : "";
      const subject = `Tu cita empieza a las ${time}`;
      return { subject, ...layout(c, subject, [p(greeting(c.contactName)), p(`Tu cita con ${sender(c)} empieza en una hora (${time}).`), p(meetingLine(c)), ...manage], { optOut: true }) };
    }
    case "nurture_welcome": {
      const subject = `Gracias por escribirnos`;
      return { subject, ...layout(c, subject, [p(greeting(c.contactName)), p(`Gracias por tu interés. Por ahora no es el mejor momento para una cita, pero puedes revisar las propiedades disponibles cuando quieras.`), { kind: "button", label: "Ver propiedades", href: c.catalogUrl }, p("Si tu situación cambia, responde a este correo y te ayudamos.")], { optOut: true }) };
    }
    case "nurture_catalog": {
      const subject = `Propiedades disponibles en ${c.tenantName}`;
      return { subject, ...layout(c, subject, [p(greeting(c.contactName)), p("Te compartimos el catálogo actualizado por si alguna propiedad te interesa."), { kind: "button", label: "Ver catálogo", href: c.catalogUrl }, ...(c.funnelUrl ? [p("Cuando quieras conversar, puedes agendar una cita en línea."), { kind: "button" as const, label: "Agendar una cita", href: c.funnelUrl }] : [])], { optOut: true }) };
    }
    case "no_show_followup": {
      const subject = `Te esperábamos en tu cita`;
      return { subject, ...layout(c, subject, [p(greeting(c.contactName)), p(`No pudimos encontrarnos en la cita${when ? ` del ${when}` : ""}. Si aún te interesa, puedes elegir otro horario.`), ...(c.funnelUrl ? [{ kind: "button" as const, label: "Elegir otro horario", href: c.funnelUrl }] : [{ kind: "button" as const, label: "Ver propiedades", href: c.catalogUrl }])], { optOut: true }) };
    }
    case "lead_booking_invite": {
      const subject = `Agenda tu cita con ${sender(c)}`;
      return { subject, ...layout(c, subject, [p(greeting(c.contactName)), p(`Gracias por tu interés. Para atenderte mejor, responde unas preguntas cortas y elige el horario que te convenga.`), ...(c.funnelUrl ? [{ kind: "button" as const, label: "Agendar mi cita", href: c.funnelUrl }] : [{ kind: "button" as const, label: "Ver propiedades", href: c.catalogUrl }])], { optOut: true }) };
    }
    case "agent_new_lead": {
      const l = c.lead;
      const subject = `Nuevo prospecto: ${l?.name || "sin nombre"}`;
      const lines = [
        l?.name && `Nombre: ${l.name}`,
        l?.email && `Correo: ${l.email}`,
        l?.phone && `Teléfono: ${l.phone}`,
        l?.source && `Origen: ${l.source}`,
        typeof l?.score === "number" && `Puntaje: ${l.score}`,
        c.propertyTitle && `Propiedad: ${c.propertyTitle}`,
        l?.message && `Mensaje: ${l.message}`,
      ].filter((x): x is string => Boolean(x));
      return { subject, ...layout(c, subject, [p("Tienes un nuevo prospecto."), ...lines.map(p), ...(l ? [{ kind: "button" as const, label: "Abrir en el panel", href: l.panelUrl }] : [])], { optOut: false }) };
    }
    case "agent_booking": {
      const l = c.lead;
      const subject = `Nueva cita: ${when}`;
      return { subject, ...layout(c, subject, [p(`${l?.name || "Un prospecto"} agendó una cita para el ${when}.`), ...(c.propertyTitle ? [p(`Propiedad: ${c.propertyTitle}`)] : []), ...(l?.phone ? [p(`Teléfono: ${l.phone}`)] : []), ...(l?.email ? [p(`Correo: ${l.email}`)] : []), ...(l ? [{ kind: "button" as const, label: "Abrir en el panel", href: l.panelUrl }] : [])], { optOut: false }) };
    }
  }
}

/* ───────────── WhatsApp ───────────── */

/**
 * Approved-template names and suggested body texts ({{n}} = parameter n). The texts must be
 * submitted in WhatsApp Manager exactly as documented; parameters are filled in this order.
 */
export const WHATSAPP_TEMPLATES: Record<TemplateKey, { name: string; body: string; params: (c: TemplateContext) => string[] }> = {
  booking_confirmation: {
    name: "cita_confirmada",
    body: "Hola, {{1}}. Tu cita con {{2}} quedó confirmada para el {{3}}. {{4}}",
    params: (c) => [firstName(c.contactName) || "hola", sender(c), c.booking ? formatDateTime(c.booking.startsAt, c.timezone) : "", c.manageUrl ? `Para ver o cancelar tu cita: ${c.manageUrl}` : meetingLine(c)],
  },
  booking_reminder_24h: {
    name: "cita_recordatorio_24h",
    body: "Hola, {{1}}. Te recordamos tu cita con {{2}} mañana, {{3}}. {{4}}",
    params: (c) => [firstName(c.contactName) || "hola", sender(c), c.booking ? formatDateTime(c.booking.startsAt, c.timezone) : "", meetingLine(c)],
  },
  booking_reminder_1h: {
    name: "cita_recordatorio_1h",
    body: "Hola, {{1}}. Tu cita con {{2}} empieza a las {{3}}. {{4}}",
    params: (c) => [firstName(c.contactName) || "hola", sender(c), c.booking ? formatTime(c.booking.startsAt, c.timezone) : "", meetingLine(c)],
  },
  nurture_welcome: {
    name: "seguimiento_bienvenida",
    body: "Hola, {{1}}. Gracias por tu interés en {{2}}. Puedes ver las propiedades disponibles aquí: {{3}}",
    params: (c) => [firstName(c.contactName) || "hola", c.tenantName, c.catalogUrl],
  },
  nurture_catalog: {
    name: "seguimiento_catalogo",
    body: "Hola, {{1}}. Te compartimos el catálogo actualizado de {{2}}: {{3}}",
    params: (c) => [firstName(c.contactName) || "hola", c.tenantName, c.catalogUrl],
  },
  no_show_followup: {
    name: "cita_inasistencia",
    body: "Hola, {{1}}. No pudimos encontrarnos en tu cita con {{2}}. Si aún te interesa, elige otro horario aquí: {{3}}",
    params: (c) => [firstName(c.contactName) || "hola", sender(c), c.funnelUrl ?? c.catalogUrl],
  },
  lead_booking_invite: {
    name: "invitacion_agendar",
    body: "Hola, {{1}}. Gracias por tu interés. Responde unas preguntas cortas y elige el horario para tu cita con {{2}}: {{3}}",
    params: (c) => [firstName(c.contactName) || "hola", sender(c), c.funnelUrl ?? c.catalogUrl],
  },
  agent_new_lead: {
    name: "agente_nuevo_prospecto",
    body: "Nuevo prospecto: {{1}} ({{2}}). Origen: {{3}}. Ábrelo en el panel: {{4}}",
    params: (c) => [c.lead?.name || "sin nombre", c.lead?.phone || c.lead?.email || "sin contacto", c.lead?.source || "sitio", c.lead?.panelUrl ?? ""],
  },
  agent_booking: {
    name: "agente_nueva_cita",
    body: "Nueva cita: {{1}} el {{2}}. Ábrela en el panel: {{3}}",
    params: (c) => [c.lead?.name || "Un prospecto", c.booking ? formatDateTime(c.booking.startsAt, c.timezone) : "", c.lead?.panelUrl ?? ""],
  },
};

export function whatsappTemplate(key: TemplateKey, c: TemplateContext): WhatsAppMessage {
  const t = WHATSAPP_TEMPLATES[key];
  // WhatsApp rejects empty parameters; a dash keeps the template valid without inventing data.
  return { name: t.name, language: "es", params: t.params(c).map((p) => p.trim() || "-") };
}

/** Templates that only make sense with a booking attached. */
export const BOOKING_TEMPLATES: readonly TemplateKey[] = ["booking_confirmation", "booking_reminder_24h", "booking_reminder_1h", "agent_booking"];
