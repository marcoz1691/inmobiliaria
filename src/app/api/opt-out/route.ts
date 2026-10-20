import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { tenants } from "@/server/db/schema";
import { errorInfo, log } from "@/lib/logger";
import { optOut } from "@/modules/crm/service";
import { readOptOutToken } from "@/modules/integrations/signing";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Small standalone page (no layout, no scripts) using the site's palette. */
function page(status: number, title: string, body: string): Response {
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>
  body{margin:0;background:#f7f5f0;color:#15171a;font:16px/1.6 ui-sans-serif,system-ui,sans-serif}
  main{max-width:34rem;margin:0 auto;padding:4rem 1.25rem}
  h1{font:400 clamp(1.75rem,1.4rem + 1.5vw,2.5rem)/1.1 Georgia,ui-serif,serif;margin:0 0 1rem;letter-spacing:-0.01em}
  p{margin:0 0 1rem;color:#585c63}
  button,a.btn{display:inline-flex;align-items:center;min-height:2.75rem;padding:0 1.5rem;border-radius:999px;border:0;background:#1b2a41;color:#fff;font:600 1rem/1 inherit;font-family:inherit;cursor:pointer;text-decoration:none}
  button:hover,a.btn:hover{background:#2a3d5c}
  :focus-visible{outline:2px solid #1b2a41;outline-offset:3px}
  hr{border:0;border-top:1px solid #ddd7cc;margin:0 0 2rem}
  .eyebrow{font-size:.8125rem;letter-spacing:.08em;text-transform:uppercase;color:#9a4527;margin:0 0 .75rem}
</style></head>
<body><main>${body}</main></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

async function tenantName(id: string): Promise<string | null> {
  const db = await getDb();
  const [t] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, id)).limit(1);
  return t?.name ?? null;
}

const invalid = () =>
  page(400, "Enlace no válido", `<h1>Enlace no válido</h1><p>Este enlace para dejar de recibir mensajes no es válido o está incompleto. Usa el enlace del último correo que recibiste o responde a ese correo pidiendo la baja.</p>`);

/**
 * GET only shows a confirmation (email scanners prefetch links, so a GET must not unsubscribe).
 * POST performs the opt-out: the page's button, or the RFC 8058 one-click request from mail apps.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  const who = readOptOutToken(token);
  if (!who) return invalid();
  const name = await tenantName(who.tenantId);
  if (!name) return invalid();
  return page(
    200,
    "Dejar de recibir mensajes",
    `<p class="eyebrow">${esc(name)}</p><h1>¿Dejar de recibir mensajes?</h1><hr>
<p>Si confirmas, no te enviaremos más correos ni mensajes automáticos. Si tienes una cita agendada, sigue vigente.</p>
<form method="post" action="/api/opt-out"><input type="hidden" name="t" value="${esc(token!)}"><button type="submit">Confirmar baja</button></form>`,
  );
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let token = url.searchParams.get("t");
  if (!token) {
    const form = await req.formData().catch(() => null);
    const value = form?.get("t");
    token = typeof value === "string" ? value : null;
  }
  const who = readOptOutToken(token);
  if (!who) return invalid();
  const name = await tenantName(who.tenantId);
  if (!name) return invalid();
  try {
    await optOut(who.tenantId, who.contactId);
  } catch (err) {
    log.error("opt-out failed", errorInfo(err));
    return page(500, "No pudimos procesar tu baja", `<h1>No pudimos procesar tu baja</h1><p>Inténtalo de nuevo en unos minutos o responde al correo pidiendo la baja.</p>`);
  }
  return page(
    200,
    "Listo: ya no recibirás mensajes",
    `<p class="eyebrow">${esc(name)}</p><h1>Listo: ya no recibirás mensajes automáticos</h1><hr><p>Registramos tu solicitud. Si cambias de opinión, puedes volver a escribirnos desde el sitio.</p>`,
  );
}
