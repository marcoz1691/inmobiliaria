import { slugify } from "@/modules/properties/domain";

/**
 * Provinces and cantons of Ecuador (24 provinces, 223 cantons, including Borbón, created in 2026).
 * Source: "Anexo:Cantones de Ecuador", es.wikipedia.org (table of cantons and their seats), Nov 2026.
 * Each canton is `[name]` or `[name, seat]` when the seat (cabecera cantonal) has another name,
 * e.g. Rumiñahui → Sangolquí. Quito is listed by the city's name instead of "Distrito Metropolitano".
 */
const DATA: [province: string, cantons: ([string] | [string, string])[]][] = [
  ["Azuay", [["Camilo Ponce Enríquez"], ["Chordeleg"], ["Cuenca"], ["El Pan"], ["Girón"], ["Guachapala"], ["Gualaceo"], ["Nabón"], ["Oña"], ["Paute"], ["Pucará"], ["San Fernando"], ["Santa Isabel"], ["Sevilla de Oro"], ["Sígsig"]]],
  ["Bolívar", [["Caluma"], ["Chillanes"], ["Chimbo", "San José de Chimbo"], ["Echeandía"], ["Guaranda"], ["Las Naves"], ["San Miguel"]]],
  ["Carchi", [["Bolívar"], ["Espejo", "El Ángel"], ["Mira"], ["Montúfar", "San Gabriel"], ["San Pedro de Huaca", "Huaca"], ["Tulcán"]]],
  ["Cañar", [["Azogues"], ["Biblián"], ["Cañar"], ["Déleg"], ["El Tambo"], ["La Troncal"], ["Suscal"]]],
  ["Chimborazo", [["Alausí"], ["Chambo"], ["Chunchi"], ["Colta", "Cajabamba"], ["Cumandá"], ["Guamote"], ["Guano"], ["Pallatanga"], ["Penipe"], ["Riobamba"]]],
  ["Cotopaxi", [["La Maná"], ["Latacunga"], ["Pangua", "El Corazón"], ["Pujilí"], ["Salcedo", "San Miguel"], ["Saquisilí"], ["Sigchos"]]],
  ["El Oro", [["Arenillas"], ["Atahualpa", "Paccha"], ["Balsas"], ["Chilla"], ["El Guabo"], ["Huaquillas"], ["Las Lajas", "La Victoria"], ["Machala"], ["Marcabelí"], ["Pasaje"], ["Piñas"], ["Portovelo"], ["Santa Rosa"], ["Zaruma"]]],
  ["Esmeraldas", [["Atacames"], ["Borbón"], ["Eloy Alfaro", "Valdéz"], ["Esmeraldas"], ["Muisne"], ["Quinindé", "Rosa Zárate"], ["Rioverde"], ["San Lorenzo"]]],
  ["Galápagos", [["Isabela", "Puerto Villamil"], ["San Cristóbal", "Puerto Baquerizo Moreno"], ["Santa Cruz", "Puerto Ayora"]]],
  ["Guayas", [["Alfredo Baquerizo Moreno", "Alfredo Baquerizo Moreno (Jujan)"], ["Balao"], ["Balzar"], ["Colimes"], ["Coronel Marcelino Maridueña"], ["Daule"], ["Durán", "Eloy Alfaro"], ["El Empalme", "Velasco Ibarra"], ["El Triunfo"], ["General Antonio Elizalde", "General Antonio Elizalde (Bucay)"], ["Guayaquil"], ["Isidro Ayora"], ["Lomas de Sargentillo"], ["Milagro"], ["Naranjal"], ["Naranjito"], ["Nobol", "Narcisa de Jesús"], ["Palestina"], ["Pedro Carbo"], ["Playas", "General Villamil"], ["Salitre"], ["Samborondón"], ["San Jacinto de Yaguachi", "Yaguachi"], ["Santa Lucía"], ["Simón Bolívar"]]],
  ["Imbabura", [["Antonio Ante", "Atuntaqui"], ["Cotacachi"], ["Ibarra"], ["Otavalo"], ["Pimampiro"], ["San Miguel de Urcuquí", "Urcuquí"]]],
  ["Loja", [["Calvas", "Cariamanga"], ["Catamayo"], ["Celica"], ["Chaguarpamba"], ["Espíndola", "Amaluza"], ["Gonzanamá"], ["Loja"], ["Macará"], ["Olmedo"], ["Paltas", "Catacocha"], ["Pindal"], ["Puyango", "Alamor"], ["Quilanga"], ["Saraguro"], ["Sozoranga"], ["Zapotillo"]]],
  ["Los Ríos", [["Baba"], ["Babahoyo"], ["Buena Fe"], ["Mocache"], ["Montalvo"], ["Palenque"], ["Puebloviejo"], ["Quevedo"], ["Quinsaloma"], ["Urdaneta", "Catarama"], ["Valencia"], ["Ventanas"], ["Vinces"]]],
  ["Manabí", [["Bolívar", "Calceta"], ["Chone"], ["El Carmen"], ["Flavio Alfaro"], ["Jama"], ["Jaramijó"], ["Jipijapa"], ["Junín"], ["Manta"], ["Montecristi"], ["Olmedo"], ["Paján"], ["Pedernales"], ["Pichincha"], ["Portoviejo"], ["Puerto López"], ["Rocafuerte"], ["San Vicente"], ["Santa Ana"], ["Sucre", "Bahía de Caráquez"], ["Tosagua"], ["Veinticuatro de Mayo", "Sucre"]]],
  ["Morona Santiago", [["Gualaquiza"], ["Huamboya"], ["Limón Indanza", "General Leonidas Plaza Gutiérrez"], ["Logroño"], ["Morona", "Macas"], ["Pablo Sexto"], ["Palora"], ["San Juan Bosco"], ["Santiago", "Santiago de Méndez"], ["Sevilla Don Bosco"], ["Sucúa"], ["Taisha"], ["Tiwintza", "Santiago"]]],
  ["Napo", [["Archidona"], ["Carlos Julio Arosemena Tola"], ["El Chaco"], ["Quijos", "Baeza"], ["Tena"]]],
  ["Orellana", [["Aguarico", "Tiputini"], ["Francisco de Orellana", "El Coca"], ["La Joya de los Sachas"], ["Loreto"]]],
  ["Pastaza", [["Arajuno"], ["Mera"], ["Pastaza", "Puyo"], ["Santa Clara"]]],
  ["Pichincha", [["Cayambe"], ["Mejía", "Machachi"], ["Pedro Moncayo", "Tabacundo"], ["Pedro Vicente Maldonado"], ["Puerto Quito"], ["Quito"], ["Rumiñahui", "Sangolquí"], ["San Miguel de Los Bancos"]]],
  ["Santa Elena", [["La Libertad"], ["Salinas"], ["Santa Elena"]]],
  ["Santo Domingo de los Tsáchilas", [["La Concordia"], ["Santo Domingo"]]],
  ["Sucumbíos", [["Cascales", "El Dorado de Cascales"], ["Cuyabeno", "Tarapoa"], ["Gonzalo Pizarro", "Lumbaquí"], ["Lago Agrio", "Nueva Loja"], ["Putumayo", "Puerto El Carmen de Putumayo"], ["Shushufindi"], ["Sucumbíos", "La Bonita"]]],
  ["Tungurahua", [["Ambato"], ["Baños de Agua Santa", "Baños"], ["Cevallos"], ["Mocha"], ["Patate"], ["Quero"], ["San Pedro de Pelileo", "Pelileo"], ["Santiago de Píllaro", "Píllaro"], ["Tisaleo"]]],
  ["Zamora Chinchipe", [["Centinela del Cóndor", "Zumbi"], ["Chinchipe", "Zumba"], ["El Pangui"], ["Nangaritza", "Guayzimi"], ["Palanda"], ["Paquisha"], ["Yacuambi", "28 de Mayo"], ["Yantzaza"], ["Zamora"]]]
];

export type Province = { slug: string; name: string };
export type Canton = {
  /** Unique across the country: "bolivar-carchi" and "bolivar-manabi" when a name repeats. */
  slug: string;
  name: string;
  /** Seat of the canton when its name differs ("Sangolquí" for Rumiñahui). */
  seat: string | null;
  /** "Rumiñahui (Sangolquí)": what selectors show. */
  label: string;
  province: Province;
};

export const PROVINCES: Province[] = DATA.map(([name]) => ({ slug: slugify(name), name }));

const nameCount = new Map<string, number>();
for (const [, cantons] of DATA) for (const [name] of cantons) nameCount.set(slugify(name), (nameCount.get(slugify(name)) ?? 0) + 1);

export const CANTONS: Canton[] = DATA.flatMap(([provinceName, cantons]) => {
  const province = PROVINCES.find((p) => p.name === provinceName)!;
  return cantons.map(([name, rawSeat]) => {
    // "Alfredo Baquerizo Moreno (Jujan)": the seat repeats the name; keep the short local name.
    const paren = rawSeat?.match(/^(.*) \((.+)\)$/);
    const seat = paren ? (paren[1] === name ? paren[2]! : rawSeat!) : (rawSeat ?? null);
    const base = slugify(name);
    return {
      slug: nameCount.get(base)! > 1 ? `${base}-${province.slug}` : base,
      name,
      seat,
      label: seat ? `${name} (${seat})` : name,
      province,
    };
  });
});

const provinceBySlug = new Map(PROVINCES.map((p) => [p.slug, p]));
const cantonBySlug = new Map(CANTONS.map((c) => [c.slug, c]));

/**
 * Every spelling that points to one canton: its name and, when it does not clash with another
 * canton's name, its seat ("sangolqui" → Rumiñahui, but "sucre" stays the canton Sucre).
 */
const aliases = new Map<string, Canton[]>();
const addAlias = (key: string, c: Canton) => aliases.set(key, [...(aliases.get(key) ?? []), c]);
for (const c of CANTONS) {
  addAlias(slugify(c.name), c);
  if (c.slug !== slugify(c.name)) addAlias(c.slug, c);
}
for (const c of CANTONS) if (c.seat && !aliases.has(slugify(c.seat))) addAlias(slugify(c.seat), c);

export function getProvince(slug: string | null | undefined): Province | null {
  return slug ? (provinceBySlug.get(slug) ?? null) : null;
}

export function getCanton(slug: string | null | undefined): Canton | null {
  return slug ? (cantonBySlug.get(slug) ?? null) : null;
}

/** Province named in free text: "Pichincha", "pichincha", "Provincia del Guayas". */
export function findProvince(text: string | null | undefined): Province | null {
  if (!text?.trim()) return null;
  return provinceBySlug.get(slugify(text).replace(/^provincia-del?-/, "")) ?? null;
}

/**
 * Canton a listing's free-text city refers to ("Quito", "sangolquí", "Bolívar" + "Manabí").
 * Ambiguous names are settled by the province; without one, an ambiguous name resolves to null.
 */
export function findCanton(city: string | null | undefined, province?: string | null): Canton | null {
  if (!city?.trim()) return null;
  const candidates = aliases.get(slugify(city)) ?? [];
  if (candidates.length === 1) return candidates[0]!;
  const p = findProvince(province);
  return (p && candidates.find((c) => c.province.slug === p.slug)) || null;
}

export function cantonsOf(provinceSlug: string): Canton[] {
  return CANTONS.filter((c) => c.province.slug === provinceSlug);
}
