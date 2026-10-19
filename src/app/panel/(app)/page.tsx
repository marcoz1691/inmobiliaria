import { requireMember } from "@/server/session";

export default async function DashboardPage() {
  const member = await requireMember();
  return (
    <div>
      <p className="text-eyebrow text-clay">Inicio</p>
      <h1 className="mt-1 font-display text-display-md text-ink">Hola, {member.userName}</h1>
    </div>
  );
}
