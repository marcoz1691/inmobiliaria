import type { PublicImage, PublicProperty } from "@/components/public/types";

/**
 * Demo-only data. Every value is fictitious and marked "[Ejemplo]".
 * Images are flat tonal blocks (inline SVG), not stock photography.
 */

type Tone = { sky: string; mass: string; accent: string; ground: string };

const TONES: Record<string, Tone> = {
  stone: { sky: "#e4ddd1", mass: "#c9bfae", accent: "#b3a690", ground: "#a89a83" },
  sage: { sky: "#dfe3da", mass: "#bcc5b5", accent: "#a3ae9a", ground: "#8f9a86" },
  clay: { sky: "#ecdcd0", mass: "#d4b9a5", accent: "#c09e86", ground: "#a9876f" },
  slate: { sky: "#dde1e6", mass: "#b9c0c9", accent: "#9fa8b4", ground: "#87909c" },
  sand: { sky: "#efe8dc", mass: "#dccfba", accent: "#c8b89e", ground: "#b6a487" },
};

type Composition = "facade" | "interior" | "land" | "detail";

function svg(tone: Tone, composition: Composition): string {
  const shapes: Record<Composition, string> = {
    facade: `<rect x="300" y="420" width="760" height="520" fill="${tone.mass}"/><rect x="1060" y="560" width="300" height="380" fill="${tone.accent}"/><rect x="420" y="560" width="200" height="240" fill="${tone.sky}"/><rect x="700" y="560" width="260" height="380" fill="${tone.accent}"/>`,
    interior: `<rect x="0" y="0" width="1600" height="900" fill="${tone.mass}"/><rect x="180" y="160" width="520" height="620" fill="${tone.sky}"/><rect x="900" y="560" width="520" height="220" fill="${tone.accent}"/>`,
    land: `<path d="M0 760 C400 700 900 720 1600 660 L1600 1200 L0 1200 Z" fill="${tone.mass}"/><path d="M0 880 C500 840 1100 860 1600 820 L1600 1200 L0 1200 Z" fill="${tone.accent}"/>`,
    detail: `<rect x="520" y="200" width="560" height="740" fill="${tone.mass}"/><rect x="600" y="280" width="400" height="520" fill="${tone.accent}"/>`,
  };
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" preserveAspectRatio="xMidYMid slice">` +
    `<rect width="1600" height="1200" fill="${tone.sky}"/>${shapes[composition]}` +
    `<rect y="940" width="1600" height="260" fill="${tone.ground}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(markup)}`;
}

function placeholder(tone: keyof typeof TONES, composition: Composition, alt: string): PublicImage {
  const t = TONES[tone] ?? TONES.stone!;
  return { src: svg(t, composition), alt: `[Ejemplo] ${alt}`, width: 1600, height: 1200 };
}

const casaImages: PublicImage[] = [
  placeholder("stone", "facade", "Fachada de la casa desde el jardín"),
  placeholder("sand", "interior", "Sala con ventanales hacia el jardín"),
  placeholder("sage", "land", "Jardín posterior"),
  placeholder("clay", "interior", "Cocina abierta"),
  placeholder("slate", "detail", "Dormitorio principal"),
  placeholder("stone", "detail", "Baño principal"),
  placeholder("sage", "facade", "Vista lateral y parqueaderos"),
];

export const demoProperties: PublicProperty[] = [
  {
    slug: "ejemplo-casa-cumbaya",
    title: "[Ejemplo] Casa con jardín y luz de tarde",
    status: "available",
    operation: "sale",
    propertyType: "Casa",
    price: 385000,
    priceKind: "sale",
    currency: "USD",
    city: "Quito",
    sector: "Cumbayá",
    landArea: 650,
    builtArea: 320,
    bedrooms: 4,
    bathrooms: 3.5,
    parking: 3,
    amenities: [
      "[Ejemplo] Jardín privado",
      "Chimenea",
      "Estudio independiente",
      "Bodega",
      "Calentador solar",
      "Guardianía 24 horas",
    ],
    highlights: [
      "[Ejemplo] Sala y comedor abiertos al jardín, con sol de la tarde.",
      "Dormitorio principal en planta baja.",
      "A pocos minutos de colegios y centros comerciales.",
    ],
    cover: casaImages[0]!,
    images: casaImages,
  },
  {
    slug: "ejemplo-departamento-carolina",
    title: "[Ejemplo] Departamento con terraza",
    status: "reserved",
    operation: "rent",
    propertyType: "Departamento",
    price: 1200,
    priceKind: "rent",
    currency: "USD",
    city: "Quito",
    sector: "La Carolina",
    landArea: null,
    builtArea: 140,
    bedrooms: 3,
    bathrooms: 2,
    parking: 2,
    amenities: ["[Ejemplo] Terraza", "Gimnasio", "Ascensor"],
    highlights: [],
    cover: placeholder("slate", "interior", "Sala del departamento con terraza"),
    images: [],
  },
  {
    slug: "ejemplo-terreno-tumbaco",
    title: "[Ejemplo] Terreno plano con vista",
    status: "sold",
    operation: "sale",
    propertyType: "Terreno",
    price: 110000,
    priceKind: "sale",
    currency: "USD",
    city: "Quito",
    sector: "Tumbaco",
    landArea: 1200,
    builtArea: null,
    bedrooms: null,
    bathrooms: null,
    parking: null,
    amenities: [],
    highlights: [],
    cover: placeholder("sage", "land", "Terreno plano con vista a la montaña"),
    images: [],
  },
];
