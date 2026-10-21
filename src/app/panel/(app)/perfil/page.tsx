import type { Metadata } from "next";
import { requireMember } from "@/server/session";
import { SOCIAL_KEYS, getMyProfile, getSite } from "@/modules/agents/admin";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProfileForm, ProfilePhoto, SiteForm } from "@/components/admin/ProfileForms";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { GroupBody, ListGroup } from "@/components/admin/ui/ListGroup";

export const metadata: Metadata = { title: "Perfil y marca" };

export default async function ProfilePage() {
  const m = await requireMember();
  const [p, site] = await Promise.all([getMyProfile(m), getSite(m)]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Tu sitio" title="Perfil y marca" description="Lo que llenes aquí aparece en tu sitio público. Lo que dejes vacío no se muestra." />
      <div className="grid gap-8">
        {p ? (
          <>
            <ListGroup as="div" title="Foto" titleId="photo" footer="Una foto real tuya. Solo la recortamos y optimizamos.">
              <GroupBody>
                <ProfilePhoto src={p.photoUrl} name={p.displayName} />
              </GroupBody>
            </ListGroup>
            <ListGroup as="div" title="Tus datos" titleId="data">
              <GroupBody>
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
              </GroupBody>
            </ListGroup>
          </>
        ) : (
          <EmptyState icon="person" title="Sin perfil de agente" description="Tu usuario no tiene un perfil de agente. Pide al dueño de la cuenta que te lo asigne." />
        )}
        <ListGroup as="div" title="Sitio" titleId="site">
          <GroupBody>
            <SiteForm initial={{ name: site.name, tagline: site.tagline ?? "" }} canEdit={m.role !== "agent"} />
          </GroupBody>
        </ListGroup>
      </div>
    </div>
  );
}
