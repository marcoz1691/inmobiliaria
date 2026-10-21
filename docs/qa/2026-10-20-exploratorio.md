# QA exploratorio — 2026-10-20

- **Rama:** `r3/qa` (snapshot de `main` en `7fbe338`).
- **Entorno:** `next dev -p 3305`, PGlite propio (`.data/pglite-qa`), seed con `SEED_E2E_FIXTURES=1`, sin credenciales de integraciones.
- **Herramientas:** Playwright (Chromium, 1440 px) con scripts en `qa-scripts/`, más `curl` para las requests HTTP directas.
- **Evidencia:** capturas en `qa-scripts/shots/` y volcados en `qa-scripts/drafts/` (no se commitean).
- **Limitación del entorno:** el servidor de desarrollo fue muy lento. El primer render de cada ruta tardó entre 2 y 6 min, y el proceso se cayó dos veces durante la sesión. Por eso la cobertura de embudo, agenda, prospectos, móvil y a11y quedó **pendiente** (ver "No cubierto").

## Resumen de bugs

| ID | Sev. | Área | Título |
|---|---|---|---|
| QA-01 | P0 | Privacidad / almacenamiento | El PDF original de cada importación se descarga sin sesión desde una URL pública y predecible |
| QA-02 | P1 | Privacidad / importación | El importador copia la dirección exacta en la **descripción** (campo público) aunque la ubicación sea "Aproximada" |
| QA-03 | P2 | Panel / a11y | Error de hidratación en `PhotoManager` (dnd-kit): `aria-describedby` apunta a un id inexistente |
| QA-04 | P2 | Seguridad / cabeceras | Sin CSP; se expone `X-Powered-By`; HSTS con `preload; includeSubDomains` en dominios de clientes |
| QA-05 | P2 | Panel / reglas de publicación | Una propiedad ya publicada puede quedarse sin foto o sin precio: las reglas de publicación no se revalidan |
| QA-06 | P3 | Sitio público / copy | "La dirección exacta se comparte al agendar la visita": ningún flujo lo hace |
| QA-07 | P3 | Importación / copy | Un PDF sin fichas reconocibles solo dice "No se encontraron propiedades", sin indicar qué hacer |
| QA-08 | P3 | Importación / copy | El rechazo del `.pptx` es correcto, pero no sugiere exportarlo a PDF |
| QA-09 | P3 | SEO / multi-tenant | `siteOrigin` usa `x-forwarded-host` y el tenant usa `host`: canonical, OG y sitemap pueden divergir detrás de un proxy |

---

## QA-01 · P0 · El PDF original de la importación es público

**Área:** privacidad, almacenamiento de medios.

**Pasos:**
1. En `/panel/importar`, importa `CASA CONDADO COUNTRY - QUITO.pdf`.
2. Abre cualquier propiedad pública y copia el `tenantId` de la URL de una foto (aparece en el HTML, en el JSON-LD y en `og:image`): `/media/tenants/<tenantId>/properties/...`.
3. Calcula el SHA-256 del PDF y, **sin sesión**, pide `GET /media/tenants/<tenantId>/imports/<sha256>.pdf`.

**Esperado:** 401/404. El PDF fuente contiene linderos, el código catastral (`1300107007001001007`) y nombres, celulares y correos de empleados del banco. Solo debería verlo un miembro del tenant (para eso existe `/api/panel/imports/[id]/pdf`, que sí exige sesión).

**Obtenido:**
```
GET /media/tenants/61be74f9-…/imports/<sha256>.pdf   (sin cookies)
200 application/pdf 916785B   → empieza con "%PDF-"
```
En producción es peor: `SupabaseStorage.url()` devuelve `…/storage/v1/object/public/<bucket>/tenants/<id>/imports/<sha>.pdf`, o sea que los PDFs están en el **bucket público**. Además, `readImportPdf` los lee justamente por esa URL pública. La clave es determinista (el hash del archivo) y el `tenantId` es público: cualquiera que tenga o reciba el PDF del banco puede confirmar que existe y descargarlo. Si en algún momento se activa el listado del bucket, quedan expuestos todos.

**Causa probable:**
- `src/modules/imports/service.ts:101`: `storageKey = tenants/${tenantId}/imports/${sha}.pdf` se guarda con `getStorage().put` en el mismo almacenamiento público que las fotos.
- `src/modules/media/storage.ts:58`: la URL es pública.
- `src/app/media/[...key]/route.ts`: sirve cualquier clave, con `application/pdf` incluido en `TYPES`.

**Sugerencia:** guardar los PDFs en un bucket privado (o con prefijo privado) y leerlos con service role o URL firmada. Que `/media` rechace `*/imports/*` y `.pdf`. Usar una clave aleatoria en vez del hash.

## QA-02 · P1 · Dirección exacta dentro de la descripción pública

**Área:** privacidad, importación de catálogos.

**Pasos:**
1. Importa `PRESENTACIÓN BIENES MAYO 2026 (1).pdf` (catálogo del banco, 21 borradores).
2. Abre el borrador "Terreno en Santa Lucia, Cumbayá" en el paso **Detalles**.

**Esperado:** la dirección va solo en el campo `Dirección` (que no se publica con privacidad "Aproximada") y la descripción no contiene calle, lote ni intersección.

**Obtenido:**
```
Descripción = "Lote # 3, barrio Santa Lucia, calle Chimborazo y Pasaje González. Área de Terreno: 5.418,91 m2 y construcción interna tipo vivienda de 2 plantas de 216,00 m2."
Dirección   = "Lote # 3, barrio Santa Lucia, calle Chimborazo y Pasaje González."
Ubicación   = Aproximada (recomendado) — "la dirección no se publica"
```
`toPublic` publica `description` tal cual, y la ficha la muestra en la página, en el JSON-LD (`description`) y en `og:description`. Cuando el agente confirme el precio (hoy lo bloquea el avalúo) y publique, la dirección exacta queda en línea pese a la promesa de la UI.

**Evidencia:** `qa-scripts/shots/04-santalucia-detalles.png`, `qa-scripts/drafts/publish.json`.

**Causa probable:** `src/modules/imports/catalog.ts` arma la descripción a partir del bloque `DIRECCIÓN:` del catálogo. En las fichas individuales (Condado, Palmeras, Pomasqui, Fernández, Radisson) la descripción fue solo "Uso residencial/comercial." y la dirección quedó en su campo.

**Sugerencia:** no incluir el bloque de dirección en `description`. Revisar los 21 borradores del catálogo.

## QA-03 · P2 · Error de hidratación en el gestor de fotos

**Área:** panel, accesibilidad.

**Pasos:** abre `/panel/propiedades/<id>` de cualquier propiedad con fotos y mira la consola o el indicador "1 issue" de Next.

**Obtenido** (log del servidor de desarrollo):
```
<button … aria-roledescription="sortable"
+  aria-describedby="DndDescribedBy-0"
-  aria-describedby="DndDescribedBy-135"
   aria-label="Mover foto 5 de 6">
```
React avisa que no corrige el atributo: las instrucciones para lector de pantalla del arrastre con teclado apuntan a un id que no existe. Pasa en todas las páginas del asistente, porque `PhotoManager` queda montado aunque esté oculto.

**Causa probable:** `src/components/admin/wizard/PhotoManager.tsx`: `<DndContext>` sin `id` estable. **Sugerencia:** `id={useId()}`.

## QA-04 · P2 · Cabeceras de seguridad incompletas

**Obtenido** (`curl -I /` y `/panel/ingresar`): `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` y `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` están presentes, pero:
- no hay `Content-Security-Policy` (el sitio público renderiza texto del agente e importado, mapas e imágenes de terceros);
- se envía `X-Powered-By: Next.js`;
- `includeSubDomains; preload` se envía en **todos** los dominios de los tenants. En un dominio propio del agente, eso fuerza HTTPS en todos sus subdominios y lo habilita para la lista de preload sin que el agente lo haya decidido.

**Causa:** `next.config.ts` (`securityHeaders`, falta `poweredByHeader: false`).

## QA-05 · P2 · Las reglas de publicación no se revalidan después de publicar

**Fuente:** lectura de código. No reproducido en la UI por falta de tiempo.
- `src/modules/properties/service.ts` `updateDraft` (l. 84-114) acepta `price: null` o `priceKind: "appraisal"` en una propiedad `published` sin volver a ejecutar `publishProblems`.
- `removePhoto` (l. 282) deja borrar la última foto de una propiedad publicada.

**Resultado esperado del bug:** una ficha pública sin foto ni precio, o un avalúo mostrado como "Precio a consultar".

**Pasos para confirmar:** publica una propiedad, borra el precio en Básicos y mira la ficha pública. Luego elimina todas las fotos.

## QA-06 · P3 · Promesa de copy no implementada

La ficha con ubicación aproximada dice "La dirección exacta se comparte al agendar la visita." (`src/app/(public)/(site)/propiedades/[slug]/page.tsx:211`). Ni las plantillas de confirmación (`docs/integrations.md`, `templates.ts`) ni `/cita/[token]` incluyen la dirección. Sugerencia: "El asesor te comparte la dirección exacta antes de la visita."

## QA-07 · P3 · PDF sin fichas: mensaje sin salida

`folleto de ventas corregido.pdf` (16 páginas de planos de "Terrazas del Valle", Cumbayá) termina en "No se encontraron propiedades en el PDF." Correcto no inventar nada, pero falta el siguiente paso, por ejemplo: "Crea la propiedad a mano y sube las fotos" con un enlace a `/panel/propiedades/nueva`. Archivo: `src/components/admin/PdfImporter.tsx:19`.

## QA-08 · P3 · Rechazo del .pptx

`BODEGA PELILEO.pptx` se rechaza en el cliente con "Solo se aceptan archivos PDF." (correcto; el servidor además valida la firma `%PDF-`). Sugerencia: "Solo se aceptan PDF. Si es una presentación, expórtala como PDF e inténtalo de nuevo."

## QA-09 · P3 · Origen público distinto del host del tenant

`src/app/(public)/_lib/site.ts:14` arma canonical, OG, sitemap y `robots` con `x-forwarded-host ?? host`, mientras que `getCurrentTenant` (`src/server/tenant.ts`) usa solo `host`. Detrás de un proxy que reenvíe un `X-Forwarded-Host` del cliente, el sitemap de un tenant podría anunciar URLs de otro dominio. En Vercel la cabecera la fija la plataforma: riesgo bajo, pero conviene usar la misma fuente.

---

## Cobertura: probado y correcto

**Acceso y seguridad HTTP**
- Sin sesión, `/panel`, `/panel/propiedades`, `/panel/prospectos`, `/panel/integraciones`, `/panel/propiedades/nueva` y `/panel/importar` responden 307 a `/panel/ingresar`.
- Sin sesión, `POST /api/panel/imports`, `GET /api/panel/imports/<id>/pdf`, `POST /api/panel/properties/<id>/photos` y `POST /api/panel/profile/photo` responden 401 con mensaje en español.
- `/api/cron/jobs` responde 401 sin `CRON_SECRET`, con `Bearer undefined` y con `Bearer ` vacío.
- `/api/webhooks/meta` responde 503 ("Webhook de Meta no configurado") en GET y POST sin credenciales, como define `docs/integrations.md`.
- Path traversal en `/media` (`..%2f`, `--path-as-is ../../.data/dev-secret`) → 404. `resolveLocal` valida el prefijo.
- `/cita/<token inválido>` y `/cita/<token>/ics` → 404. `/api/opt-out?t=abc` → 400.
- `POST /api/chat` sin `ANTHROPIC_API_KEY` → `{"status":"unavailable"}`.
- `/dev/design` hace `notFound()` en producción y está en `disallow` de `robots`.

**Integraciones:** `/panel/integraciones` muestra los 8 canales como "No conectado", con las variables que faltan y sin valores. "No hay tareas en espera."

**Importación de los 12 archivos de `assets-input/pdfs/`**
- Las 10 fichas individuales generaron 1 borrador cada una; el catálogo del Banco del Austro, 21 borradores; el folleto, 0. El `.pptx` se rechazó.
- Linderos, código catastral/predio y contactos de terceros (Banco Guayaquil y Banco del Austro) **no** se copiaron a campos publicables, y cada borrador lo avisa.
- Los valores "VALOR AVALUO" quedaron como `appraisal`, se muestran como "Avalúo US$…" en la revisión y **bloquean** la publicación.
- El precio por m² (Tobachiri-Chico) no se fijó como precio. La "provincia Tena" (inexistente) quedó vacía, con aviso. La página 11 del catálogo, sin bloque "DIRECCIÓN:", quedó señalada para revisión manual.
- Todos los borradores nacen con `needsReview` y no se pueden publicar hasta marcar la revisión.

**Publicación y ficha pública** (Condado Country, publicada desde el asistente)
- En el HTML de `/propiedades/casa-no-7-conj-condado-country-quito` no aparecen la calle (Juan Procel, OE-340, Rio Picuno), los parqueaderos 13/14, las coordenadas exactas (−0.1083910, −78.5079437), el código catastral, los nombres, teléfonos ni correos del banco, la palabra "linderos", ni la marca eXp (las 5 coincidencias de "exp" son subcadenas de otras palabras).
- El mapa usa −0.11, −78.51 (≈1 km).
- El JSON-LD no incluye `streetAddress` ni `geo`. `og:description` = "Casa en venta en Mena del Hierro, Quito. Uso de suelo residencial."
- El RSC payload no incluye `reviewNotes`, `fieldConfidence`, `sourceImportId` ni `createdBy`.
- El sitemap lista solo las publicadas (2 fixtures + Condado) y el embudo activo.

**Medios:** `processImage` valida por contenido con sharp y reencoda a WebP sin `withMetadata`, así que se eliminan EXIF y GPS. Revisado en código; falta subir una foto con GPS real (ver abajo).

## No cubierto en esta sesión (pendiente)

Lo dejo explícito para que el orquestador lo reasigne o lo cubra el SDET con e2e:
1. **Embudo y agenda:** calificado vs. descalificado, doble reserva concurrente, franjas pasadas, America/Guayaquil, cancelar/re-reservar, `.ics` real, cambios del horario semanal, embudo pausado.
2. **Prospectos:** mover etapa, notas, tareas, motivo de pérdida. **Perfil:** foto, redes, WhatsApp y su reflejo en el sitio.
3. **Asistente:** autosave con red caída, validaciones numéricas en la UI, duplicar/pausar/archivar, reordenar fotos y cambiar portada.
4. **Subidas:** foto con EXIF/GPS (verificar con `exiftool` la variante 1600), tipo falso, >15 MB.
5. **IDOR entre tenants** (requiere un segundo tenant y dominio en el seed), rate limit del chat (30/10 min por IP), opt-out completo (GET de confirmación + POST).
6. **Móvil (Pixel 7) y a11y:** teclado, foco, tab bar, objetivos táctiles. Lo cubre en parte el SDET con axe.
7. **Rate limit de login:** desactivado fuera de producción por diseño (`src/server/auth.ts`). Hay que probarlo en un preview.
8. **Mensaje de contraseña incorrecta:** a los 4 s el botón seguía en "Ingresando…" (`qa-scripts/shots/01-login-wrong.png`). No pude confirmar si luego aparece un error, por la lentitud del servidor. Volver a probar con más espera.
