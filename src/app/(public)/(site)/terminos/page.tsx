import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { env } from "@/env";
import { IVA_RATE, PLANS } from "@/modules/billing/plans";
import { isPortal } from "../../_lib/site";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de uso del portal para quienes buscan propiedades y para los agentes que publican.",
  alternates: { canonical: "/terminos" },
};

const UPDATED = "17 de noviembre de 2026";

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

/** Portal terms of use. Agents' own sites do not have these (they are the agent's business). */
export default async function TermsPage() {
  if (!(await isPortal())) notFound();
  const name = env.PORTAL_NAME;
  const owner = env.PORTAL_OWNER_NAME ?? "el responsable del portal indicado en la política de privacidad";
  const free = PLANS.free;
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:py-16">
      <header>
        <p className="text-eyebrow font-medium text-clay uppercase">Condiciones de uso</p>
        <h1 className="mt-3 font-display text-display-lg text-balance text-ink">Términos y condiciones</h1>
        <p className="mt-4 text-lg text-pretty text-ink-muted">
          Estas condiciones rigen el uso de {name}, un portal donde agentes inmobiliarios publican propiedades en venta y alquiler en Ecuador. {name} es operado
          por {owner}. Al usar el portal o crear una cuenta aceptas estas condiciones.
        </p>
        <p className="mt-2 text-sm text-ink-muted">Última actualización: {UPDATED}.</p>
      </header>

      <div className="mt-10 space-y-10">
        <Section id="servicio" title="Qué es el portal">
          <p>
            {name} muestra propiedades publicadas por agentes inmobiliarios independientes y pone en contacto a quienes buscan con esos agentes. {name} no es
            parte de las negociaciones, no cobra comisiones por las operaciones y no actúa como corredor, propietario ni intermediario de ninguna propiedad.
          </p>
          <p>
            La información de cada propiedad (precio, superficie, ubicación, fotos y estado) la entrega el agente que la publica. Antes de tomar una decisión,
            verifica los datos directamente con el agente y con los documentos de la propiedad.
          </p>
        </Section>

        <Section id="cuenta" title="Cuentas de agente">
          <ul>
            <li>Para publicar necesitas una cuenta con datos reales. Eres responsable de lo que se haga con ella y de mantener segura tu contraseña.</li>
            <li>Una cuenta corresponde a un agente o inmobiliaria. No crees cuentas a nombre de otras personas.</li>
            <li>Puedes pedir que cerremos tu cuenta en cualquier momento escribiéndonos por los medios de contacto del portal.</li>
          </ul>
        </Section>

        <Section id="publicaciones" title="Lo que publicas">
          <p>Al publicar una propiedad declaras que:</p>
          <ul>
            <li>Tienes autorización del propietario para promocionarla, y que el precio y los datos son verdaderos y están vigentes.</li>
            <li>Tienes derecho a usar las fotos, planos y textos que subes.</li>
            <li>
              No publicas datos personales de terceros, linderos, códigos catastrales ni información que el propietario no haya autorizado a difundir.
            </li>
            <li>Mantendrás la publicación al día: si la propiedad se vende, se alquila o deja de estar disponible, la marcarás o la retirarás.</li>
          </ul>
          <p>
            Podemos ocultar o retirar publicaciones engañosas, duplicadas, ilegales o que incumplan estas condiciones, y suspender las cuentas que lo hagan de
            forma reiterada.
          </p>
        </Section>

        <Section id="ia" title="Lectura de fichas con inteligencia artificial">
          <p>
            Si subes la ficha de una propiedad en PDF, un asistente de inteligencia artificial puede leerla y preparar un borrador de la publicación. El borrador
            puede contener errores u omisiones: revísalo y corrígelo antes de publicarlo. Lo que publicas es tu responsabilidad, aunque lo haya preparado la IA.
          </p>
        </Section>

        <Section id="planes" title="Planes y pagos">
          <ul>
            <li>
              El plan {free.name} es gratuito y permite {free.maxListings === 1 ? "1 propiedad publicada" : `${free.maxListings} propiedades publicadas`}.
            </li>
            <li>
              Los planes pagados son mensuales. Los precios se muestran en dólares de los Estados Unidos y no incluyen el IVA ({Math.round(IVA_RATE * 100)}%),
              que se suma al facturar.
            </li>
            <li>Mientras no exista el pago en línea, el plan se activa al confirmar el pago con nuestro equipo de ventas. No hay cobros automáticos.</li>
            <li>
              Si un plan vence y no se renueva, la cuenta vuelve al plan {free.name}: tus propiedades publicadas siguen visibles, pero no podrás publicar nuevas
              por encima del límite del plan {free.name}.
            </li>
            <li>Podemos cambiar los precios de los planes; el cambio se aplica desde la siguiente renovación y lo anunciaremos en el panel.</li>
          </ul>
        </Section>

        <Section id="uso" title="Uso aceptable">
          <p>
            No uses el portal para enviar spam, extraer datos de forma automatizada, suplantar a otras personas ni contactar a los agentes con fines distintos a
            una consulta real sobre una propiedad.
          </p>
        </Section>

        <Section id="responsabilidad" title="Responsabilidad">
          <p>
            Hacemos lo posible para que el portal esté disponible y funcione bien, pero puede tener interrupciones o errores. {name} no responde por la
            exactitud de las publicaciones de los agentes ni por las operaciones que se acuerden entre agentes, propietarios y clientes.
          </p>
        </Section>

        <Section id="datos" title="Datos personales">
          <p>
            El tratamiento de datos personales se explica en la{" "}
            <Link href="/privacidad" className="text-link underline underline-offset-4">
              política de privacidad
            </Link>
            .
          </p>
        </Section>

        <Section id="cambios" title="Cambios y ley aplicable">
          <p>
            Podemos actualizar estas condiciones; la fecha de arriba indica la última versión. Si el cambio es importante para los agentes, lo avisaremos en el
            panel. Estas condiciones se rigen por las leyes de la República del Ecuador.
          </p>
        </Section>
      </div>
    </div>
  );
}
