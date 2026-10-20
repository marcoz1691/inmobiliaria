import Link from "next/link";
import { requireMember } from "@/server/session";
import { dashboardCounts } from "@/modules/crm/service";
import { listUpcomingBookings } from "@/modules/funnels/service";
import { listForPanel } from "@/modules/properties/service";
import { getAvailability, getMyProfile, missingProfileFields } from "@/modules/agents/admin";
import { Button } from "@/components/ui/Button";

type Attention = { href: string; title: string; detail: string };

export default async function DashboardPage() {
  const m = await requireMember();
  const [counts, bookings, drafts, profile] = await Promise.all([
    dashboardCounts(m),
    listUpcomingBookings(m),
    listForPanel(m, { status: "draft" }),
    getMyProfile(m),
  ]);
  const rules = profile ? await getAvailability(m, profile.id) : [];
  const newLeads = counts.deals.new ?? 0;
  const toReview = drafts.filter((d) => d.needsReview);
  const missing = missingProfileFields(profile);

  const stats = [
    { label: "Prospectos nuevos", value: newLeads, href: "/panel/prospectos" },
    { label: "Citas próximas", value: bookings.length, href: "/panel/agenda" },
    { label: "Borradores pendientes", value: counts.properties.draft ?? 0, href: "/panel/propiedades?estado=draft" },
    { label: "Publicadas", value: counts.properties.published ?? 0, href: "/panel/propiedades?estado=published" },
  ];

  const attention: Attention[] = [];
  if (newLeads > 0)
    attention.push({ href: "/panel/prospectos", title: newLeads === 1 ? "1 prospecto nuevo sin atender" : `${newLeads} prospectos nuevos sin atender`, detail: "Responder rápido multiplica las citas." });
  if (counts.tasksDue > 0) attention.push({ href: "/panel/prospectos", title: counts.tasksDue === 1 ? "1 tarea vence hoy" : `${counts.tasksDue} tareas vencen hoy`, detail: "Revisa tus seguimientos." });
  for (const d of toReview.slice(0, 3))
    attention.push({ href: `/panel/propiedades/${d.id}`, title: `Revisar borrador importado: ${d.title || "sin título"}`, detail: "Confirma los datos leídos del PDF antes de publicar." });
  if (toReview.length > 3) attention.push({ href: "/panel/propiedades?estado=draft", title: `${toReview.length - 3} borradores importados más por revisar`, detail: "Abre la lista de borradores." });
  if (missing.length) attention.push({ href: "/panel/perfil", title: "Completa tu perfil", detail: `Falta: ${missing.join(", ")}. Tu sitio oculta lo que no has llenado.` });
  if (profile && rules.length === 0) attention.push({ href: "/panel/agenda", title: "Configura tus horarios de atención", detail: "Sin horarios, tus embudos no pueden ofrecer citas." });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-eyebrow text-clay uppercase">Inicio</p>
          <h1 className="mt-1 font-display text-display-md text-ink">Hola, {m.userName}</h1>
        </div>
        <Button href="/panel/propiedades/nueva" size="lg" className="w-full sm:w-auto">
          Publicar propiedad
        </Button>
      </div>

      <section aria-labelledby="stats" className="mt-6">
        <h2 id="stats" className="sr-only">
          Resumen
        </h2>
        <dl className="grid grid-cols-2 border-t border-ink lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="relative flex flex-col-reverse gap-1 border-b border-line py-4 pr-4 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-navy">
              <dt className="text-sm text-ink-muted">
                <Link href={s.href} className="after:absolute after:inset-0 focus-visible:outline-none">
                  {s.label}
                </Link>
              </dt>
              <dd className="font-display text-4xl leading-none text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="attention" className="mt-10">
        <h2 id="attention" className="font-display text-2xl text-ink">
          Lo que requiere tu atención
        </h2>
        {attention.length ? (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {attention.map((a) => (
              <li key={a.href + a.title}>
                <Link href={a.href} className="group flex min-h-16 items-center justify-between gap-4 py-3">
                  <span>
                    <span className="block text-base font-medium text-ink group-hover:underline group-hover:underline-offset-4">{a.title}</span>
                    <span className="block text-sm text-ink-muted">{a.detail}</span>
                  </span>
                  <span aria-hidden="true" className="text-ink-muted">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 border-t-2 border-available pt-4 text-base text-ink-muted">Todo al día. Nada pendiente por ahora.</p>
        )}
      </section>
    </div>
  );
}
