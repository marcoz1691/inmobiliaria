import { getPublicProperty, listFeatured } from "@/modules/properties/service";
import { getSite } from "../../../../_lib/site";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * 410 Gone for archived listings. App Router pages cannot choose this status, so the detail
 * page redirects here and this handler answers with a small self-contained page plus suggestions.
 */
export async function GET(_req: Request, { params }: RouteContext<"/propiedades/[slug]/no-disponible">) {
  const { slug } = await params;
  const site = await getSite();
  const lookup = await getPublicProperty(site.tenantId, slug);
  if (lookup.kind === "ok") return Response.redirect(new URL(`/propiedades/${encodeURIComponent(slug)}`, _req.url), 307);
  if (lookup.kind === "missing") return new Response("Not found", { status: 404 });

  const suggestions = await listFeatured(site.tenantId, 3);
  const items = suggestions
    .map((p) => `<li><a href="/propiedades/${encodeURIComponent(p.slug)}">${esc(p.title)}</a>${p.city ? `<span>${esc([p.sector, p.city].filter(Boolean).join(", "))}</span>` : ""}</li>`)
    .join("");

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>Esta propiedad ya no está disponible · ${esc(site.name)}</title>
<style>
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#1d1d1f;font:17px/1.47 -apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,"Helvetica Neue",Arial,sans-serif;letter-spacing:-.011em;-webkit-font-smoothing:antialiased}
header{position:sticky;top:0;background:rgba(255,255,255,.8);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid rgba(29,29,31,.1)}
header div,main{max-width:48rem;margin:0 auto;padding:0 20px}
header a{font-weight:600;font-size:17px;letter-spacing:-.02em;color:#1d1d1f;text-decoration:none;display:inline-flex;min-height:52px;align-items:center}
main{padding-top:64px;padding-bottom:80px}
.eyebrow{font-size:15px;font-weight:600;color:#b64400;margin:0}
h1{font:700 clamp(2.25rem,1.5rem + 3vw,4rem)/1.05 -apple-system,BlinkMacSystemFont,"SF Pro Display",Inter,"Helvetica Neue",Arial,sans-serif;letter-spacing:-.028em;margin:12px 0 16px;text-wrap:balance}
p{color:#6e6e73;max-width:36rem;font-size:clamp(1.1875rem,1rem + .6vw,1.5rem);line-height:1.42}
.btn{display:inline-flex;align-items:center;min-height:48px;padding:0 28px;border-radius:999px;background:#0071e3;color:#fff;text-decoration:none;font-weight:500;margin-top:16px}
.btn:hover{background:#0062c4}
h2{font-size:24px;font-weight:600;letter-spacing:-.016em;margin:64px 0 0}
ul{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:12px}
li{background:#f5f5f7;border-radius:22px;padding:16px 24px;display:flex;flex-direction:column}
li a{font-size:20px;font-weight:600;letter-spacing:-.016em;color:#1d1d1f;min-height:44px;display:inline-flex;align-items:center;text-decoration:none}
li a:hover{text-decoration:underline}
li span{font-size:15px;color:#6e6e73}
.more{color:#0066cc;text-decoration:none;display:inline-flex;min-height:44px;align-items:center}
.more:hover{text-decoration:underline}
a:focus-visible{outline:2px solid #0071e3;outline-offset:3px;border-radius:8px}
</style>
</head>
<body>
<header><div><a href="/">${esc(site.name)}</a></div></header>
<main id="contenido">
<p class="eyebrow">Propiedad retirada</p>
<h1>Esta propiedad ya no está disponible</h1>
<p>El anuncio fue retirado. Revisa otras opciones publicadas o cuéntame qué buscas y te ayudo a encontrar algo parecido.</p>
<a class="btn" href="/propiedades">Ver propiedades disponibles</a>
${items ? `<h2>Te pueden interesar</h2><ul>${items}</ul>` : ""}
<p style="margin-top:40px"><a class="more" href="${esc(site.bookingHref)}">${site.funnelHref ? "Agenda una cita" : "Escríbeme"} ›</a></p>
</main>
</body>
</html>`;

  return new Response(html, {
    status: 410,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
