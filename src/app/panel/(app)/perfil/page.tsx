import type { Metadata } from "next";
import { requireMember } from "@/server/session";
import { SOCIAL_KEYS, getMyProfile, getSite } from "@/modules/agents/admin";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProfileForm, ProfilePhoto, SiteForm } from "@/components/admin/ProfileForms";

export const metadata: Metadata = { title: "Perfil y marca" };

export default async function ProfilePage() {
  const m = await requireMember();
  const [p, site] = await Promise.all([getMyProfile(m), getSite(m)]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Tu sitio" title="Perfil y marca" description="Lo que llenes aquí aparece en tu sitio público. Lo que dejes vacío no se muestra." />
      {p ? (
        <>
          <section aria-labelledby="photo" className="mt-8">
            <h2 id="photo" className="font-display text-2xl text-ink">
              Foto
            </h2>
            <div className="mt-4">
              <ProfilePhoto src={p.photoUrl} name={p.displayName} />
            </div>
          </section>
          <section aria-labelledby="data" className="mt-10">
            <h2 id="data" className="font-display text-2xl text-ink">
              Tus datos
            </h2>
            <div className="mt-4">
              <ProfileForm
                socialKeys={[...SOCIAL_KEYS]}
                initial={{
                  displayName: p.displayName,
                  headline: p.headline ?? "",
                  bio: p.bio ?? "",
                  whatsapp: p.whatsapp ?? "",
                  phone: p.phone ?? "",
                  email: p.email ?? "",
                  city: p.city ?? "",
                  affiliation: p.affiliation ?? "",
                  socials: { ...p.socials } as Record<string, string>,
                }}
              />
            </div>
          </section>
        </>
      ) : (
        <p className="mt-8 text-base text-ink-muted">Tu usuario no tiene un perfil de agente. Pide al dueño de la cuenta que te lo asigne.</p>
      )}
      <section aria-labelledby="site" className="mt-12 border-t border-ink pt-6">
        <h2 id="site" className="font-display text-2xl text-ink">
          Sitio
        </h2>
        <div className="mt-4">
          <SiteForm initial={{ name: site.name, tagline: site.tagline ?? "" }} canEdit={m.role !== "agent"} />
        </div>
      </section>
    </div>
  );
}
