# Dirección visual — sitio público del agente

**Concepto: "ficha editorial".** El sitio se lee como una revista de arquitectura sobria: la foto manda, el texto acompaña con tipografía serif grande, y la información técnica se ordena como una hoja de especificaciones con filetes finos, no como tarjetas. Persona primero (retrato real del agente), propiedad después, siempre con una sola acción principal visible.

**Tipografías** (`next/font/google`, variables en `src/app/layout.tsx`)
- *Newsreader* (`font-display`): serif editorial con tamaños ópticos; da voz humana y confiable a titulares, precios destacados y cifras. Acentos del español completos.
- *Schibsted Grotesk* (`font-sans`): grotesca diseñada para prensa; muy legible en móvil y ajena al "Inter por defecto". Sin `tabular-nums` (en esta fuente separa la puntuación).

**Paleta (tokens `@theme` en `globals.css`; contraste WCAG calculado)**

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `paper` | #F7F5F0 | fondo | — |
| `sand` | #EDE8DF | secciones hundidas, placeholders | — |
| `ink` | #15171A | texto | 16,48:1 sobre paper |
| `ink-muted` | #585C63 | texto secundario | 6,17 paper · 5,51 sand · 6,72 blanco |
| `navy` / `navy-hover` | #1B2A41 / #2A3D5C | acción primaria, foco | blanco encima 14,44 / 10,93 |
| `clay` | #9A4527 | acento, antetítulos | 5,92 paper · 5,29 sand |
| `line` / `line-strong` | #DDD7CC / #8A8478 | filetes decorativos / bordes de UI | — / 3,41 paper |
| `paper-muted` | #B9B4AA | texto secundario en pie oscuro | 8,70 sobre ink |
| estados | available #1E5236/#E2EEE5 · reserved #7A4A00/#F5EAD3 · sold #7E2626/#F3E1DE · rented #25446A/#E1E8F1 | `Badge` | 7,60 · 6,27 · 7,59 · 8,05 |

Los estados nunca dependen solo del color: el badge lleva texto ("Disponible", "Reservada", "Vendida", "Alquilada").

**Escala tipográfica:** `text-display-xl` clamp(40→76px, lh 1,02) solo para el h1; `display-lg` clamp(32→52px) títulos de sección; `display-md` clamp(24→32px) precio y destacados; cuerpo `text-base/lg` (16/18px, lh 1,6); `text-eyebrow` 13px versalitas +0,08em; apoyo `text-sm` 14px.

**Espaciado y grid:** escala Tailwind de 4px. Contenedor `max-w-7xl`, márgenes 20/32/48px (móvil/tablet/desktop). Grid de 12 columnas en desktop: hero 7+5, destacadas 6+3+3, ficha 8+4 con columna de precio *sticky*. Secciones 64px (móvil) / 96px (desktop), separadas por filete, no por cajas.

**Radios:** 2px (badges), 4px (fotos), 8px (reservado). Píldora completa solo para acciones: así un botón se distingue de un contenido.

**Motion:** solo con propósito — cambio de color 150ms en controles, zoom de foto 1,02–1,03 / 500ms `ease-out-quart` al pasar el cursor (señala que es clicable), shimmer en esqueletos. `prefers-reduced-motion: reduce` anula animaciones y transiciones globalmente.

**Accesibilidad:** foco visible 2px `navy` con offset 3px (blanco en fondos oscuros); objetivos táctiles ≥44px (`min-h-11`); enlace "Saltar al contenido"; nav móvil como *disclosure* (`aria-expanded`, Escape devuelve el foco); lightbox con `<dialog>` nativo (foco atrapado, Escape, flechas, contador `aria-live`); una sola parada de tabulación por tarjeta (enlace estirado); enlaces externos anuncian "se abre en una pestaña nueva".

**Estados** (`EmptyState`, `Skeleton`): *carga* = esqueleto con la forma real del contenido + `aria-busy` y texto para lector; *vacío* = qué pasó + un siguiente paso; *error* = causa probable + "Reintentar" (`role="alert"`); *confirmación* = qué sigue, sin acción obligatoria. Filete superior de color por tono + icono de línea, nunca solo color.

**Evitar:** gradientes morados, glassmorphism/blur, sombras difusas, cuadrículas de tarjetas con íconos, hero centrado genérico, emojis, fotos de stock, el logo de WhatsApp o de cualquier franquicia (se usa un ícono genérico de chat), precios de avalúo en público, y cualquier dato no provisto (testimonios, años, cifras).
