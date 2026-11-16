import Image from "next/image";
import Link from "next/link";
import { isUnsizedSource } from "@/lib/image-loader";
import { cn } from "@/components/ui/cn";
import type { PublicAgent } from "@/modules/agents/public";

/** Initials disc when the agent has not uploaded a photo (never a stock portrait). */
function Initials({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span aria-hidden="true" className={cn("grid place-items-center rounded-full bg-mist font-semibold text-ink", className)}>
      {initials}
    </span>
  );
}

export function AgentAvatar({ agent, size = 56, className }: { agent: Pick<PublicAgent, "displayName" | "photoUrl">; size?: number; className?: string }) {
  if (!agent.photoUrl) return <Initials name={agent.displayName} className={className} />;
  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-full bg-mist", className)} style={{ width: size, height: size }}>
      <Image
        src={agent.photoUrl}
        unoptimized={isUnsizedSource(agent.photoUrl)}
        alt=""
        fill
        sizes={`${size * 2}px`}
        className="object-cover object-top"
      />
    </span>
  );
}

/** Directory tile: photo, name, role and how many listings, linking to the agent's page. */
export function AgentTile({ agent, href, listings }: { agent: PublicAgent; href: string; listings: number }) {
  return (
    <article className="group relative flex h-full items-center gap-4 rounded-md bg-white p-5 transition-[transform,box-shadow] duration-500 ease-apple hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgb(0_0_0/0.28)] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-navy">
      <AgentAvatar agent={agent} size={64} className="size-16 text-lg" />
      <div className="min-w-0">
        <h2 className="text-headline text-ink">
          <Link href={href} className="focus-visible:outline-none after:absolute after:inset-0 after:content-['']">
            {agent.displayName}
          </Link>
        </h2>
        {agent.headline || agent.city ? (
          <p className="truncate text-[0.9375rem] text-ink-muted">{[agent.headline, agent.city].filter(Boolean).join(" · ")}</p>
        ) : null}
        <p className="mt-1 text-sm font-medium text-clay">{listings === 1 ? "1 propiedad publicada" : `${listings} propiedades publicadas`}</p>
      </div>
    </article>
  );
}
