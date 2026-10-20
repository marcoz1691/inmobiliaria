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
body{margin:0;background:#f7f5f0;color:#15171a;font:16px/1.6 ui-sans-serif,system-ui,sans-serif}
header,main{max-width:48rem;margin:0 auto;padding:0 20px}
header{padding-top:20px;padding-bottom:20px;border-bottom:1px solid #ddd7cc}
header a{font:400 1.25rem/1 Georgia,ui-serif,serif;color:#15171a;text-decoration:none;display:inline-flex;min-height:44px;align-items:center}
main{padding-top:48px;padding-bottom:64px}
.eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#9a4527;font-weight:500;margin:0}
h1{font:400 clamp(2rem,1.4rem + 2.4vw,3.25rem)/1.08 Georgia,ui-serif,serif;letter-spacing:-.015em;margin:12px 0 16px}
p{color:#585c63;max-width:36rem}
.btn{display:inline-flex;align-items:center;min-height:48px;padding:0 24px;border-radius:999px;background:#1b2a41;color:#fff;text-decoration:none;font-weight:500;margin-top:16px}
.btn:hover{background:#2a3d5c}
h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#9a4527;font-weight:500;margin:56px 0 0}
ul{list-style:none;padding:0;margin:12px 0 0;border-top:1px solid #ddd7cc}
li{border-bottom:1px solid #ddd7cc;padding:12px 0;display:flex;flex-direction:column}
li a{font:400 1.25rem/1.3 Georgia,ui-serif,serif;color:#15171a;min-height:44px;display:inline-flex;align-items:center}
li span{font-size:14px;color:#585c63}
a:focus-visible{outline:2px solid #1b2a41;outline-offset:3px}
</style>
</head>
<body>
<header><a href="/">${esc(site.name)}</a></header>
<main id="contenido">
<p class="eyebrow">Propiedad retirada</p>
<h1>Esta propiedad ya no está disponible</h1>
<p>El anuncio fue retirado. Revisa otras opciones publicadas o cuéntame qué buscas y te ayudo a encontrar algo parecido.</p>
<a class="btn" href="/propiedades">Ver propiedades disponibles</a>
${items ? `<h2>Te pueden interesar</h2><ul>${items}</ul>` : ""}
<p style="margin-top:40px"><a href="${esc(site.bookingHref)}" style="color:#15171a">${site.funnelHref ? "Agenda una cita" : "Escríbeme"}</a></p>
</main>
</body>
</html>`;

  return new Response(html, {
    status: 410,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
