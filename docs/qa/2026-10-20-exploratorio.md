# QA exploratorio — 2026-10-20

- **Rama:** `r3/qa` (snapshot de `main` @ `7fbe338`).
- **Entorno:** `next dev -p 3305`, PGlite propia (`.data/pglite-qa`), seed con `SEED_E2E_FIXTURES=1`, sin credenciales de integraciones. Navegador: Playwright Chromium, 1440 px y Pixel 7, `es-EC`, `America/Guayaquil`.
- **Evidencia:** capturas en `qa-scripts/shots/`, volcados en `qa-scripts/drafts/` (no se commitean; son reproducibles con los scripts de `qa-scripts/`).
- **Criterios de aceptación:** reglas de `AGENTS.md`, `docs/adr/0001-arquitectura.md` y `docs/integrations.md`.
- **Nota de entorno:** la máquina estuvo muy cargada (primer render de una ruta: 10–120 s). Lo que no se pudo confirmar se marca **no verificado**.

## Resumen

| ID | Sev. | Área | Título |
|---|---|---|---|
| QA-01 | P0 | Privacidad / importación | El importador de catálogos copia la dirección exacta en la **descripción pública** |
| QA-02 | P0 | Seguridad / privacidad | Los PDF originales (linderos, catastro, contactos del banco) se descargan sin sesión desde `/media/…` |
| QA-03 | P2 | Panel / a11y | Error de hidratación en el gestor de fotos: `aria-describedby` de arrastre apunta a un id inexistente |
| QA-04 | P2 | Panel / reglas de publicación | Una propiedad publicada puede quedar sin precio o sin fotos (no se revalida al editar) |
| QA-05 | P2 | Seguridad (hardening) | Sin Content-Security-Policy; `X-Powered-By` expuesto; HSTS `preload` para dominios de clientes |
| QA-06 | P3 | Panel / UX | «Marcar revisión completa» no muestra estado pendiente ni se desactiva |
| QA-07 | P3 | Copy / sitio público | La ficha promete «La dirección exacta se comparte al agendar la visita», pero ningún flujo la comparte |
| QA-08 | P3 | Copy / importación | Rechazo del .pptx y PDF sin fichas: mensajes poco accionables |
| QA-09 | P3 | Sitio público | La búsqueda del catálogo no escapa `%` y `_` en `ilike` |

---

## Hallazgos

### QA-01 · P0 · El importador de catálogos copia la dirección exacta en la descripción pública

- **Área:** importación de PDF → contenido público.
- **Pasos:**
  1. Panel → Importar PDF → subir `PRESENTACIÓN BIENES MAYO 2026 (1).pdf` (catálogo del Banco del Austro, 21 fichas).
  2. Abrir el borrador «Terreno en Santa Lucia, Cumbayá» → paso «Detalles».
- **Esperado:** con privacidad «Aproximada (recomendado)» la dirección no se publica (AGENTS.md: «Ubicación pública aproximada por defecto»; ADR §9: «la dirección no se muestra»). El campo `address` queda privado y ningún campo publicable debe contener la calle/lote.
- **Obtenido:** el campo **Descripción** (público) contiene la dirección literal del bloque `DIRECCIÓN:` del PDF:
  `Descripción = "Lote # 3, barrio Santa Lucia, calle Chimborazo y Pasaje González. Área de Terreno: 5.418,91 m2 y construcción interna tipo vivienda de 2 plantas de 216,00 m2."`
  y a la vez `Dirección = "Lote # 3, barrio Santa Lucia, calle Chimborazo y Pasaje González."` con privacidad «Aproximada».
  La descripción se renderiza en la ficha, en `<meta name="description">`, OpenGraph/Twitter (`summary()` en la página) y en el JSON-LD (`description`). Es decir, al publicar se filtra la dirección exacta por cuatro vías aunque el mapa la oculte. El aviso de revisión no lo advierte (solo avisa de avalúo y contactos de terceros), así que un agente que confía en «Aproximada» la publicará.
- **Alcance:** afecta a las fichas de catálogo (el parser `catalog.ts`). En las fichas individuales (Condado, Pomasqui, Las Palmeras, Fernández, Radisson) la descripción quedó limpia (`Uso residencial.` / distribución), la dirección solo fue al campo privado `address`.
- **Evidencia:** `qa-scripts/drafts/publish.json` (clave `santalucia`), captura `qa-scripts/shots/04-santalucia-detalles.png`.
- **Causa probable:** `src/modules/imports/catalog.ts` líneas ~288–295: `address` se arma con las primeras líneas de `desc`, pero `description` se fija con `text` completo (que incluye esas mismas líneas):
  ```
  setField(l, "address", collapseSpaces(addressLines.join(" ")) || null, "low");
  setField(l, "description", text || null, "high");
  ```
- **Sugerencia:** construir la descripción sin las líneas de dirección (y marcarla `low` para que aparezca «Verifica este dato»); añadir un test en `imports/extract.test.ts` que verifique que `description` no contiene `address`.

### QA-02 · P0 · Los PDF originales se descargan sin sesión desde `/media/…`

- **Área:** seguridad / privacidad de documentos fuente.
- **Pasos (reproducido):**
  1. Importar cualquier PDF desde el panel (p. ej. `CASA CONDADO COUNTRY - QUITO.pdf`).
  2. Sin cookies, abrir el catálogo público `/propiedades`: el HTML expone el id del tenant en cada foto (`/media/tenants/61be74f9-e6da-42e8-9f17-2b71ae6ddabf/properties/…`).
  3. `curl http://localhost:3305/media/tenants/<tenantId>/imports/<sha256 del PDF>.pdf` **sin sesión**.
- **Esperado:** el PDF original solo es accesible por la ruta autenticada `/api/panel/imports/[id]/pdf` (así lo documenta el propio código: «Source PDF of an import, only for signed-in members of the tenant»). Esos PDF contienen linderos, códigos catastrales, nombres, celulares y correos de empleados de bancos (Banco Guayaquil, Banco del Austro) y coordenadas exactas: nada de eso puede ser público (AGENTS.md).
- **Obtenido:**
  ```
  200 application/pdf 916785
  %PDF-1.7
  ```
  En producción es peor: `SupabaseStorage.url()` devuelve `…/storage/v1/object/public/<bucket>/tenants/<id>/imports/<sha>.pdf` y `readImportPdf()` lee el PDF **por esa URL pública**, o sea que el bucket debe ser público para que funcione la vista del panel. La clave es determinista (SHA-256 del archivo): cualquiera que tenga el folleto (circulan por WhatsApp) puede confirmar y descargar la copia, y la clave no se rota.
- **Causa probable:**
  - `src/modules/imports/service.ts:101` guarda en `tenants/${tenantId}/imports/${sha}.pdf` con el mismo `getStorage()` que las fotos públicas.
  - `src/app/media/[...key]/route.ts` sirve cualquier clave bajo `.data/media` sin autenticación y además mapea `pdf → application/pdf`.
  - `src/modules/imports/service.ts:224-229` (`readImportPdf`) usa la URL pública en Supabase.
- **Sugerencia:** bucket privado separado para `imports/` (descarga con service role o URL firmada de corta vida), clave aleatoria en vez del SHA, y que `/media` rechace todo lo que no sea `tenants/*/properties|agents/*.webp`.

### QA-03 · P2 · Error de hidratación en el gestor de fotos (dnd-kit)

- **Área:** panel → asistente de propiedad → Fotos; accesibilidad.
- **Pasos:** abrir cualquier borrador con fotos (`/panel/propiedades/<id>`), consola del navegador / log de `next dev`.
- **Esperado:** sin errores de hidratación.
- **Obtenido:** «A tree hydrated but some attributes of the server rendered HTML didn't match…» con
  ```
  +  aria-describedby="DndDescribedBy-0"
  -  aria-describedby="DndDescribedBy-135"
  ```
  en cada botón «Mover foto N de M». React no corrige atributos en la hidratación, así que el botón queda apuntando a un id que no existe: el lector de pantalla no anuncia las instrucciones de arrastre con teclado. Next muestra además el globo «1 issue» en dev (`qa-scripts/shots/03-draft-0.png`).
- **Causa probable:** `src/components/admin/wizard/PhotoManager.tsx`: `DndContext` sin prop `id` estable (dnd-kit genera ids con un contador global distinto en servidor y cliente). Pasar `id={useId()}` o renderizar el sortable solo en cliente.

### QA-04 · P2 · Una propiedad publicada puede quedar sin precio o sin fotos

- **Área:** panel → reglas de publicación. **Detectado leyendo el código; no verificado en la UI.**
- **Pasos:** con una propiedad publicada, borrar el precio en «Básicos» (autosave) o eliminar todas sus fotos.
- **Esperado:** las mismas reglas de `publishProblems` aplican mientras la propiedad está en línea, o la edición se bloquea / se pausa con aviso.
- **Obtenido (código):** `updateDraft()` (`src/modules/properties/service.ts:84`) y `removePhoto()` (`:282`) no revalidan nada si el estado es `published`; `publishProblems` solo se evalúa en `changeStatus(..., "published")`. El sitio mostraría una ficha publicada sin foto ni precio.

### QA-05 · P2 · Cabeceras de seguridad incompletas

- **Pasos:** `curl -sI http://localhost:3305/` y `/panel/ingresar`.
- **Obtenido:** hay `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` y HSTS, pero:
  - no hay `Content-Security-Policy` (el sitio inyecta JSON-LD y, con el Pixel, scripts de terceros; el panel maneja datos personales);
  - `X-Powered-By: Next.js` (`poweredByHeader: false` en `next.config.ts`);
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` se envía en **todos** los hosts, también en dominios propios de cada agente. `preload` + `includeSubDomains` sobre un dominio de cliente puede romper subdominios que no tengan HTTPS y es difícil de revertir; debería decidirlo cada tenant.
- **Causa:** `next.config.ts` (`securityHeaders`).

### QA-06 · P3 · «Marcar revisión completa» sin estado pendiente

- **Pasos:** abrir un borrador importado y pulsar «Marcar revisión completa» con el servidor lento.
- **Esperado:** botón desactivado con «Guardando…» hasta la respuesta.
- **Obtenido:** el botón sigue activo varios segundos sin feedback; si el agente pasa a «Revisar y publicar» antes de la respuesta, ve «Revisa los datos importados…» como problema aunque ya pulsó. Al recargar la revisión sí aparece completa.
- **Causa:** `src/components/admin/wizard/PropertyWizard.tsx` `completeReview()` sin estado `pending`.

### QA-07 · P3 · Promesa de compartir la dirección al agendar

- **Dónde:** ficha pública con ubicación aproximada: «Zona aproximada en … La dirección exacta se comparte al agendar la visita.» (`src/app/(public)/(site)/propiedades/[slug]/page.tsx:211`).
- **Problema:** ni la confirmación de cita, ni el .ics, ni las plantillas de `docs/integrations.md` incluyen la dirección de la propiedad. La frase promete algo que el producto no hace. Sugerencia: «Te comparto la dirección exacta cuando coordinemos la visita.»

### QA-08 · P3 · Mensajes de importación poco accionables

- `BODEGA PELILEO.pptx` → «Solo se aceptan archivos PDF.» Correcto (se rechaza en cliente), pero no dice qué hacer. Sugerencia: «Solo se aceptan PDF. Exporta la presentación como PDF e inténtalo de nuevo.» (`src/components/admin/PdfImporter.tsx:40`). El rechazo en servidor (`El archivo no es un PDF válido.`, por firma `%PDF-`) existe en código; **no verificado** por HTTP todavía.
- `folleto de ventas corregido.pdf` (16 págs., planos del proyecto «Terrazas del Valle», Cumbayá) → «No se encontraron propiedades en el PDF.» Sin pista de por qué ni de qué hacer (crear la ficha a mano). Sugerencia: «No encontramos fichas con precio y dirección. Puedes crear la propiedad a mano y adjuntar fotos.»

### QA-09 · P3 · Búsqueda del catálogo sin escapar comodines

- `q` se usa como `ilike '%${q}%'` sin escapar `%`/`_` (`src/modules/properties/service.ts` `catalogWhere`; también `listForPanel`). `q=%` o `q=_` devuelven todo. Sin riesgo de inyección (parámetros enlazados), solo resultados inesperados.

---

## Cobertura: qué se probó y salió bien

**Importación de los 11 PDF + 1 .pptx (desde la UI del panel, en lote)**
- 10 PDF de ficha + 1 catálogo procesados en ~2 min; el catálogo generó 21 borradores y avisó «Página 11: tiene valores pero no un bloque "DIRECCIÓN:"; no se generó borrador».
- El .pptx se rechaza antes de subir.
- **Linderos:** omitidos en todos los borradores, con aviso «Se omitieron los linderos del PDF: no se copian a campos publicables».
- **Códigos catastrales / predio** (`10108003009`, `1300107007001001007`, `3644265`, `10220027004002…`, `048-015-021`): omitidos, con aviso.
- **Contactos de bancos** (Banco Guayaquil: nombres, celulares, correos; Banco del Austro: administradores, teléfonos, extensiones): omitidos de todos los campos de texto, con aviso.
- **Avalúo:** las 20 fichas con «VALOR AVALUO» quedan `priceKind = appraisal`, se muestran «Avalúo US$…» en la revisión, la vista previa dice «Precio a consultar» y `publishProblems` bloquea la publicación hasta confirmar el precio. El JSON-LD omite `offers` cuando es avalúo (código).
- Precio por m² («VALOR DE PRE-VENTA: $60,00 M2»): no se inventa precio total; queda en nota y se avisa.
- Provincia inválida («provincia Tena»): se deja vacía y se avisa. Campos ausentes quedan vacíos (no inventados).
- Coordenadas exactas del PDF: van a `lat/lng` con privacidad «Aproximada» por defecto (redondeo a 2 decimales ≈ 1 km en `toPublic`).
- Todo borrador importado queda `needsReview` y no se puede publicar hasta «Marcar revisión completa».
- Marca eXp: no aparece en el texto de ningún PDF ni en los borradores.

**Seguridad (sin sesión)**
- `/panel`, `/panel/propiedades`, `/panel/prospectos`, `/panel/integraciones`, `/panel/propiedades/nueva`, `/panel/importar` → 307 a `/panel/ingresar`.
- `POST /api/panel/imports`, `POST /api/panel/properties/<id>/photos`, `POST /api/panel/profile/photo`, `GET /api/panel/imports/<id>/pdf` → 401 con mensaje en español.
- `GET /api/cron/jobs` sin header, con `Bearer undefined` y con `Bearer ` vacío → 401 (sin `CRON_SECRET` nunca autoriza).
- `GET/POST /api/webhooks/meta` sin `META_APP_SECRET` → 503 «Webhook de Meta no configurado» (comportamiento esperado según `docs/integrations.md`).
- `/dev/design` responde 200 en dev pero tiene `notFound()` en producción y `noindex`.
- Fotos: `processImage` valida por contenido con sharp y no copia metadatos (sin `withMetadata`), lo que elimina EXIF/GPS (código; prueba con imagen real pendiente).

**Panel**
- Login correcto redirige a `/panel`; todas las secciones cargan (200).
- `/panel/integraciones`: los 8 canales muestran «No conectado» con las variables que faltan; «Tareas en espera… No hay tareas en espera». Honesto, conforme a AGENTS.md.
- Inicio: «Completa tu perfil — Falta: titular, biografía, WhatsApp, correo. Tu sitio oculta lo que no has llenado.»

## No verificado (hasta este commit)

- Publicación real de borradores importados y su revisión en ficha pública, HTML, JSON-LD, OpenGraph y sitemap (el flujo se interrumpió por la lentitud del servidor; QA-01 se confirmó en el borrador).
- Respuestas del chat (sin API key).
- Mensaje de contraseña incorrecta (a los 4 s seguía «Ingresando…»).
