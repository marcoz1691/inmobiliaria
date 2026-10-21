# Dirección visual — sitio público del agente

**Concepto: "presentación de producto".** El sitio se lee como una página de producto de apple.com: titulares enormes y apretados, mucho aire, fotos protagonistas con esquinas grandes y bandas a sangre que alternan blanco, gris claro (#f5f5f7) y negro. La propiedad es el producto; la persona (retrato real del agente) abre el inicio como "foto de producto". Siempre una sola acción principal visible (píldora azul) y, como secundaria, un enlace de texto "Ver más ›".

**Tipografía** (pila en `globals.css`, Inter vía `next/font` en `src/app/layout.tsx`)
- *SF Pro Display / SF Pro Text* (fuente del sistema en dispositivos Apple) con *Inter* como alternativa abierta en Android y Windows, que es donde cae la mayoría del tráfico de Meta Ads. Ambas tienen acentos completos.
- Titulares en negrita (600–700) con tracking negativo; cuerpo de 17px con tracking −0,011em.

**Paleta (tokens `@theme` en `globals.css`; contraste WCAG calculado)**

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `paper` | #FFFFFF | fondo | — |
| `sand` | #F5F5F7 | bandas claras alternas, tarjetas sobre blanco, pie | — |
| `mist` | #E8E8ED | chips, control segmentado, burbujas del asistente | — |
| `night` | #000000 | bandas oscuras a sangre (destacada, CTA) | — |
| `ink` | #1D1D1F | texto | 16,83 blanco · 15,46 sand |
| `ink-muted` | #6E6E73 | texto secundario | 5,07 blanco · 4,66 sand |
| `paper-muted` | #A1A1A6 | texto secundario sobre oscuro | 8,16 night · 6,54 ink |
| `navy` / `navy-hover` | #0071E3 / #0062C4 | píldora primaria, foco | blanco encima 4,70 / 5,93 · foco 4,47 sobre night |
| `link` / `link-dark` | #0066CC / #2997FF | enlaces "Ver más ›" | 5,57 blanco · 5,11 sand / 6,96 night |
| `clay` / `clay-bright` | #B64400 / #F56300 | antetítulos | 5,50 blanco · 5,05 sand / 6,67 night |
| `line` / `line-strong` | #D2D2D7 / #86868B | filetes decorativos / bordes de campos | — / 3,62 blanco · 3,33 sand |
| estados | available #1E5236/#E2EEE5 · reserved #7A4A00/#F5EAD3 · sold #7E2626/#F3E1DE · rented #25446A/#E1E8F1 | `Badge` | 7,60 · 6,27 · 7,59 · 8,05 |

Los estados nunca dependen solo del color: el badge lleva texto ("Disponible", "Reservada"…) y, sobre fotos, va en una píldora blanca esmerilada con punto de color.

**Escala tipográfica** (fluida de 390 a 1440px): `text-display-xl` 48→96px (lh 1,02, −0,032em, 700) solo para h1 de portada; `display-lg` 36→64px títulos de página y sección; `display-md` 26→40px precio y subtítulos; `text-headline` 20→24px (600) títulos de tarjeta y paneles; `text-lead` 19→24px texto de apoyo bajo un titular; `text-eyebrow` 15px (600) antetítulo en `clay`, sin versalitas. Titulares de sección en dos tonos cuando ayuda: "Propiedades. <span muted>Encuentra la tuya.</span>".

**Espaciado y grid:** escala Tailwind de 4px. Contenedor `max-w-7xl`, márgenes 20/32/48px. Bandas de 80px (móvil) / 112px (desktop). Inicio: héroe centrado → destacadas sobre gris (en móvil, carrusel con la siguiente tarjeta asomando) → destacada en negro con foto fija y datos que avanzan → CTA. Catálogo: filtros rápidos arriba, resultados en tarjetas blancas sobre gris, filtros completos en panel lateral. Ficha: galería en mosaico, columna de precio *sticky* en un panel gris.

**Radios:** `xs` 8px (badges, controles pequeños), `sm` 14px (campos, opciones del embudo), `md` 22px (tarjetas, paneles, galería), `lg` 32px (foto del héroe, paneles grandes). Píldora completa para acciones, chips y control segmentado.

**Componentes clave:** `Button` (primary · secondary · ghost · `inverse` para fondos oscuros), `MoreLink` ("Ver más ›", tono claro u oscuro), `PropertyCard` (tarjeta redondeada; `surface` blanca o gris), `PropertySpotlight`, `SegmentedLinks` / `ChipLinks` (filtros rápidos como enlaces GET, funcionan sin JS, `aria-current`), `StickyActionBar` (barra inferior móvil con precio y acción), `Reveal`, `EmptyState` (`surface`).

**Efectos y motion** (curva `ease-apple` = cubic-bezier(0.28, 0.11, 0.32, 1))
- Navegación *sticky* translucida (`glass`: blanco 72% + `backdrop-filter: saturate(180%) blur(20px)`, sólida donde no hay soporte). Es el único uso de glassmorphism permitido: barras de navegación, barra de acción móvil, lanzador del asistente y badges sobre fotos.
- `Reveal`: fundido + desplazamiento de 40px al entrar en pantalla, escalonado 80–90ms por tarjeta. Solo oculta lo que empieza bajo el pliegue y solo tras hidratar: sin parpadeo, sin CLS, sin retrasar el LCP.
- Scroll-driven (`animation-timeline: view()`, con `@supports`): retrato del héroe que crece al entrar y deriva dentro de su marco (parallax sutil); foto de la destacada que se aleja mientras se leen sus datos. Sin soporte, quedan estáticas.
- Héroe: el retrato se asienta (escala 1,06→1) al cargar; el h1 nunca se anima (es el LCP en móvil).
- Hover: tarjetas se elevan 4px con sombra suave y la foto hace zoom 1,05 en 1,2s; píldoras se oscurecen y se comprimen al pulsar (0,97).
- Menú móvil a pantalla completa con enlaces que suben uno tras otro; pasos del embudo entran con un leve ascenso.
- `prefers-reduced-motion: reduce` anula animaciones, transiciones y efectos de scroll globalmente; `Reveal` no oculta nada.

**Rendimiento:** la primera foto visible usa `loading="eager"` + `fetchPriority="high"` (o `preload` en el retrato del héroe). La galería es un único árbol de imágenes para carrusel y mosaico, así que la foto principal se descarga una sola vez. Sin librerías de animación.

**Accesibilidad:** foco visible 2px `navy` con offset 3px (también legible sobre negro); objetivos táctiles ≥44px (`min-h-11`); enlace "Saltar al contenido"; nav móvil como *disclosure* (`aria-expanded`, Escape devuelve el foco, bloquea el scroll); lightbox con `<dialog>` nativo; una sola parada de tabulación por tarjeta (enlace estirado); la barra de acción móvil es `inert` mientras está oculta; enlaces externos anuncian "se abre en una pestaña nueva".

**Estados** (`EmptyState`, `Skeleton`): *carga* = esqueleto con la forma real + `aria-busy` y texto para lector; *vacío* = qué pasó + un siguiente paso; *error* = causa probable + "Reintentar" (`role="alert"`); *confirmación* = qué sigue. Panel redondeado con ícono en un disco de color; la forma del ícono cambia por tono, nunca solo el color.

**Evitar:** gradientes morados, glassmorphism fuera de la navegación y los elementos flotantes, sombras pesadas en reposo, cuadrículas de tarjetas con íconos, emojis, fotos de stock, el logo de WhatsApp o de cualquier franquicia (se usa un ícono genérico de chat), precios de avalúo en público y cualquier dato no provisto (testimonios, años, cifras).
