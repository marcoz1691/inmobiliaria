import { env } from "@/env";
import type { OutgoingEmail } from "@/modules/integrations/email";

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Password-reset email sent by Better Auth (`sendResetPassword`). The link expires in one hour. */
export function resetPasswordEmail(to: string, url: string): OutgoingEmail {
  const brand = env.PORTAL_NAME;
  const text = [
    `Recibimos una solicitud para cambiar la contraseña de tu cuenta de agente en ${brand}.`,
    "",
    `Para elegir una nueva contraseña abre este enlace (vence en 1 hora):`,
    url,
    "",
    "Si no lo pediste tú, ignora este correo: tu contraseña no cambia.",
  ].join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5;color:#1d1d1f;max-width:480px">
<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de agente en ${escape(brand)}.</p>
<p><a href="${escape(url)}" style="display:inline-block;background:#1f4d3a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Elegir nueva contraseña</a></p>
<p style="color:#6e6e73;font-size:14px">El enlace vence en 1 hora. Si no lo pediste tú, ignora este correo: tu contraseña no cambia.</p>
</div>`;
  return { to, subject: `Cambia tu contraseña de ${brand}`, html, text };
}
