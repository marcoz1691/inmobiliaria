import type { Metadata } from "next";
import { env, integrations } from "@/env";
import { CONSENT_TEXT } from "@/modules/crm/service";
import { getSite } from "../../_lib/site";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos personales recoge este sitio, para qué los usamos y cómo ejercer tus derechos.",
  alternates: { canonical: "/privacidad" },
};

const UPDATED = "20 de octubre de 2026";

function Pending() {
  return <span className="rounded-xs bg-reserved-bg px-1.5 py-0.5 text-sm text-reserved">Pendiente de completar</span>;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-8">
      <h2 id={id} className="font-display text-display-md text-ink">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base text-pretty text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">{children}</div>
    </section>
  );
}

/**
 * Describes what the system actually collects. Legal identification fields do not exist in the
 * profile yet, so they render as "pendiente de completar" instead of being made up.
 */
export default async function PrivacyPage() {
  const site = await getSite();
  const { agent } = site;
  const pixel = Boolean(env.META_PIXEL_ID);
  const draft = env.NODE_ENV !== "production";

  const contactWays = [
    agent?.email ? { label: "Correo", value: agent.email, href: `mailto:${agent.email}` } : null,
    agent?.whatsapp ? { label: "WhatsApp", value: agent.whatsapp, href: `https://wa.me/${agent.whatsapp.replace(/\D/g, "")}` } : null,
    agent?.phone ? { label: "Teléfono", value: agent.phone, href: `tel:${agent.phone.replace(/[^\d+]/g, "")}` } : null,
  ].filter((r): r is { label: string; value: string; href: string } => r !== null);

  const owner: { label: string; value: React.ReactNode }[] = [
    { label: "Nombre comercial", value: site.name },
    { label: "Nombre o razón social", value: <Pending /> },
    { label: "RUC o cédula", value: <Pending /> },
    { label: "Domicilio", value: agent?.city ? <>{agent.city} · dirección <Pending /></> : <Pending /> },
    ...(agent?.affiliation ? [{ label: "Afiliación", value: agent.affiliation }] : []),
    {
      label: "Contacto",
      value: contactWays.length ? (
        <span className="flex flex-col">
          {contactWays.map((c) => (
            <a key={c.label} href={c.href} className="underline-offset-4 hover:underline">
              {c.label}: {c.value}
            </a>
          ))}
        </span>
      ) : (
        <Pending />
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:py-16">
      <header>
        <p className="text-eyebrow font-medium text-clay uppercase">Privacidad</p>
        <h1 className="mt-3 font-display text-display-lg text-balance text-ink">Política de privacidad</h1>
        <p className="mt-4 text-lg text-pretty text-ink-muted">
          Aquí te contamos qué datos personales recoge este sitio, para qué los usamos, con quién se comparten y cómo ejercer tus derechos según la Ley Orgánica
          de Protección de Datos Personales del Ecuador (LOPDP).
        </p>
        <p className="mt-2 text-sm text-ink-muted">Última actualización: {UPDATED}.</p>
        {draft ? (
          <p role="note" className="mt-6 rounded-sm border border-line-strong bg-sand px-4 py-3 text-sm text-ink">
            Borrador pendiente de revisión legal. Este aviso solo se muestra fuera de producción.
          </p>
        ) : null}
      </header>

      <div className="mt-10 space-y-10">
        <Section id="responsable" title="Responsable del tratamiento">
          <dl className="border-t border-line">
            {owner.map((r) => (
              <div key={r.label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line py-3">
                <dt className="text-sm text-ink-muted">{r.label}</dt>
                <dd className="text-base text-ink">{r.value}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="datos" title="Qué datos recogemos y para qué">
          <ul>
            <li>
              <strong>Formulario de contacto y consultas sobre propiedades:</strong> nombre, correo, teléfono, tu mensaje y la propiedad que consultas. Los usamos
              para responderte y para registrar tu solicitud como prospecto.
            </li>
            <li>
              <strong>Formulario para agendar una cita:</strong> tus respuestas a las preguntas (por ejemplo, objetivo, presupuesto o plazo), nombre, correo,
              teléfono y el horario que eliges. Sirven para saber si podemos ayudarte, reservar la cita y enviarte la confirmación y los recordatorios.
            </li>
            <li>
              <strong>Origen de la visita:</strong> si llegas desde un anuncio, guardamos los parámetros de campaña del enlace (UTM) y el identificador de clic
              de Meta, para saber qué anuncios funcionan.
            </li>
            {integrations.metaWebhooks ? (
              <li>
                <strong>Mensajes por WhatsApp, Messenger o Instagram:</strong> tu número o identificador en esa red, el nombre de tu perfil y los mensajes,
                para responderte y mantener el historial de la conversación.
              </li>
            ) : null}
            {integrations.metaMessaging ? (
              <li>
                <strong>Formularios de anuncios de Meta (Lead Ads):</strong> los datos que entregas en el formulario de Facebook o Instagram, para contactarte
                e invitarte a agendar una cita.
              </li>
            ) : null}
            {integrations.ai ? (
              <li>
                <strong>Chat del sitio:</strong> los mensajes que escribes, para responderte y, si lo pides, pasar la conversación a una persona.
              </li>
            ) : null}
            <li>
              <strong>Seguridad:</strong> para limitar envíos abusivos usamos una huella (hash) de tu dirección IP; la dirección IP en sí no se guarda para
              este fin.
            </li>
          </ul>
        </Section>

        <Section id="consentimiento" title="Tu consentimiento">
          <p>Antes de enviar un formulario o de dejar tus datos en el chat te pedimos que aceptes este texto:</p>
          <blockquote className="border-l-2 border-clay pl-4 text-ink-muted">{CONSENT_TEXT}</blockquote>
          <p>Guardamos el texto que aceptaste y la fecha. En los formularios de anuncios de Meta, el consentimiento se da en el propio formulario de Meta.</p>
        </Section>

        <Section id="meta" title="Cookies y medición de anuncios">
          {pixel ? (
            <p>
              En las páginas para agendar una cita usamos el Píxel de Meta, que guarda en tu navegador las cookies <code>_fbp</code> y <code>_fbc</code> y
              registra la visita, el envío del formulario y la reserva de la cita. Lo usamos para medir nuestros anuncios en Facebook e Instagram.
            </p>
          ) : (
            <p>Este sitio no usa el Píxel de Meta ni otras cookies de publicidad o analítica en este momento.</p>
          )}
          {integrations.metaCapi ? (
            <p>
              Además enviamos a Meta, desde nuestro servidor (Conversions API), los eventos de envío del formulario y de reserva. Tu correo y teléfono van
              cifrados con un hash irreversible. Para que Meta pueda asociar el evento, enviamos también tu dirección IP y el tipo de navegador (user agent):
              los guardamos temporalmente y los borramos en cuanto se envía el evento, o como máximo a los 7 días.
            </p>
          ) : null}
          <p>
            El chat guarda un identificador de la conversación en el almacenamiento de la pestaña del navegador (se borra al cerrarla). Las cookies del panel
            de administración solo las reciben las personas del equipo que inician sesión.
          </p>
        </Section>

        <Section id="proveedores" title="Con quién se comparten tus datos">
          <p>No vendemos tus datos. Los tratan, por encargo nuestro y solo para estos fines, los siguientes proveedores:</p>
          <ul>
            <li>Vercel y Supabase: alojamiento del sitio y de la base de datos.</li>
            {integrations.email ? <li>Resend: envío de correos de confirmación, recordatorio y seguimiento.</li> : null}
            {integrations.whatsapp || integrations.metaMessaging || integrations.metaWebhooks || integrations.metaCapi || pixel ? (
              <li>Meta Platforms: WhatsApp Business, Messenger, Instagram, formularios de anuncios y medición de anuncios, según el canal que uses.</li>
            ) : null}
            {integrations.ai ? (
              <li>
                Anthropic: las respuestas del chat las genera un asistente de inteligencia artificial (Claude). El contenido de la conversación se envía a
                Anthropic para generar cada respuesta. No escribas en el chat datos sensibles, como información de salud o datos bancarios.
              </li>
            ) : null}
            {integrations.googleCalendar ? (
              <li>
                Google: si el asesor conectó su Google Calendar, la cita se crea en su calendario con tu nombre, teléfono y correo, y su disponibilidad en
                Google se usa para mostrarte los horarios libres.
              </li>
            ) : null}
          </ul>
          <p>Estos proveedores pueden tratar los datos fuera del Ecuador.</p>
        </Section>

        <Section id="mensajes" title="Mensajes y cómo darte de baja">
          {integrations.email || integrations.whatsapp ? (
            <ul>
              {integrations.email ? <li>Cada correo incluye un enlace para dejar de recibir mensajes automáticos; abre el enlace y confirma la baja.</li> : null}
              {integrations.whatsapp ? <li>Por WhatsApp, responde BAJA, STOP o DETENER.</li> : null}
              <li>Si te das de baja, no te enviaremos más mensajes automáticos. Puedes seguir escribiéndonos cuando quieras.</li>
            </ul>
          ) : (
            <p>Por ahora este sitio no envía mensajes automáticos por correo ni por WhatsApp.</p>
          )}
        </Section>

        <Section id="conservacion" title="Cuánto tiempo conservamos tus datos">
          {integrations.metaCapi ? <p>La dirección IP y el tipo de navegador enviados a Meta se borran al enviar el evento o, como máximo, a los 7 días.</p> : null}
          <p>
            Los datos de contacto, tus respuestas y el historial de mensajes se conservan hasta que pidas su eliminación. Plazo máximo de conservación:{" "}
            <Pending />
          </p>
        </Section>

        <Section id="derechos" title="Tus derechos">
          <p>
            Puedes pedir acceso a tus datos, su rectificación o actualización, su eliminación, oponerte a su tratamiento o pedir su suspensión, y solicitar su
            portabilidad. También puedes retirar tu consentimiento en cualquier momento.
          </p>
          <p>
            Escríbenos por los medios de contacto indicados arriba{contactWays.length ? "" : <> (<Pending />)</>}. Si no quedas conforme con la respuesta,
            puedes acudir a la Superintendencia de Protección de Datos Personales.
          </p>
        </Section>
      </div>
    </div>
  );
}
