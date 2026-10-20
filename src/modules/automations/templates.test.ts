import { describe, expect, it } from "vitest";
import { CONTACT_TEMPLATES, AGENT_TEMPLATES, WHATSAPP_TEMPLATES, renderEmail, whatsappTemplate, type TemplateContext } from "./templates";

const ctx: TemplateContext = {
  tenantName: "Sitio <Demo>",
  timezone: "America/Guayaquil",
  agentName: null,
  contactName: "Ana Pérez",
  booking: { startsAt: new Date("2026-10-20T14:00:00Z"), endsAt: new Date("2026-10-20T14:30:00Z"), meetingKind: "video", meetingUrl: null },
  optOutUrl: "https://sitio.test/api/opt-out?t=abc",
  catalogUrl: "https://sitio.test/propiedades",
  funnelUrl: "https://sitio.test/agenda/comprador",
  lead: { name: "Ana", panelUrl: "https://sitio.test/panel/prospectos/1" },
};

describe("message templates", () => {
  it("formats dates in the tenant time zone (es-EC) and falls back to the site name, never an invented agent", () => {
    const m = renderEmail("booking_confirmation", ctx);
    expect(m.subject).toBe("Cita confirmada: martes, 20 de octubre, 09:00");
    expect(m.text).toContain("Tu cita con Sitio <Demo> quedó confirmada");
    expect(m.text).toContain("te compartirá el enlace antes de la cita");
    expect(m.text).not.toContain("Ver o cancelar");
  });

  it("escapes HTML and includes opt-out only for contact emails", () => {
    for (const k of CONTACT_TEMPLATES) {
      const m = renderEmail(k, ctx);
      expect(m.html).toContain("Sitio &lt;Demo&gt;");
      expect(m.html).not.toContain("<Demo>");
      expect(m.html).toContain('href="https://sitio.test/api/opt-out?t=abc"');
      expect(m.html).toContain('<html lang="es">');
    }
    for (const k of AGENT_TEMPLATES) expect(renderEmail(k, ctx).html).not.toContain("opt-out");
  });

  it("includes the manage link only when available", () => {
    expect(renderEmail("booking_reminder_24h", { ...ctx, manageUrl: "https://sitio.test/cita/tok" }).text).toContain("Ver o cancelar mi cita: https://sitio.test/cita/tok");
  });

  it("WhatsApp templates fill every placeholder with a non-empty parameter", () => {
    for (const [key, t] of Object.entries(WHATSAPP_TEMPLATES)) {
      const placeholders = t.body.match(/\{\{\d+\}\}/g)?.length ?? 0;
      const msg = whatsappTemplate(key as keyof typeof WHATSAPP_TEMPLATES, ctx);
      expect(msg.params).toHaveLength(placeholders);
      expect(msg.params.every((p) => p.length > 0)).toBe(true);
      expect(msg.name).toMatch(/^[a-z0-9_]+$/);
    }
  });
});
