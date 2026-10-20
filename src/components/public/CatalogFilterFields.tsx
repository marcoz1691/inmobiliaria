import { OPERATION_LABEL, OPERATIONS, PROPERTY_TYPES, TYPE_LABEL, type CatalogFilters } from "@/modules/properties/domain";
import { Button } from "@/components/ui/Button";
import { inputClass as field, selectClass as select } from "./fields";

type Props = { filters: CatalogFilters; idPrefix: string };

const labelClass = "block text-sm font-medium text-ink";

/** Catalog filter inputs. Rendered twice (mobile disclosure, desktop sidebar), hence `idPrefix`. */
export function CatalogFilterFields({ filters: f, idPrefix }: Props) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label htmlFor={id("q")} className={labelClass}>
          Sector o ciudad
        </label>
        <input id={id("q")} name="q" type="search" defaultValue={f.q ?? ""} maxLength={80} placeholder="Ej.: Cumbayá" className={field} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={id("operation")} className={labelClass}>
            Operación
          </label>
          <select id={id("operation")} name="operation" defaultValue={f.operation ?? ""} className={select}>
            <option value="">Todas</option>
            {OPERATIONS.map((o) => (
              <option key={o} value={o}>
                {OPERATION_LABEL[o]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("type")} className={labelClass}>
            Tipo
          </label>
          <select id={id("type")} name="type" defaultValue={f.type ?? ""} className={select}>
            <option value="">Todos</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>Precio (US$)</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={id("minPrice")} className="sr-only">
              Precio mínimo
            </label>
            <input id={id("minPrice")} name="minPrice" type="number" inputMode="numeric" min={0} step={1000} placeholder="Mínimo" defaultValue={f.minPrice ?? ""} className={field} />
          </div>
          <div>
            <label htmlFor={id("maxPrice")} className="sr-only">
              Precio máximo
            </label>
            <input id={id("maxPrice")} name="maxPrice" type="number" inputMode="numeric" min={0} step={1000} placeholder="Máximo" defaultValue={f.maxPrice ?? ""} className={field} />
          </div>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={id("bedrooms")} className={labelClass}>
            Dormitorios
          </label>
          <select id={id("bedrooms")} name="bedrooms" defaultValue={f.bedrooms ?? ""} className={select}>
            <option value="">Cualquiera</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} o más
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("bathrooms")} className={labelClass}>
            Baños
          </label>
          <select id={id("bathrooms")} name="bathrooms" defaultValue={f.bathrooms ?? ""} className={select}>
            <option value="">Cualquiera</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} o más
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={id("minArea")} className={labelClass}>
          Área mínima (m²)
        </label>
        <input id={id("minArea")} name="minArea" type="number" inputMode="numeric" min={0} step={10} defaultValue={f.minArea ?? ""} className={field} />
      </div>

      <div>
        <label htmlFor={id("sort")} className={labelClass}>
          Ordenar por
        </label>
        <select id={id("sort")} name="sort" defaultValue={f.sort ?? ""} className={select}>
          <option value="">Más recientes</option>
          <option value="price_asc">Precio: menor a mayor</option>
          <option value="price_desc">Precio: mayor a menor</option>
        </select>
      </div>

      <Button type="submit" size="lg" className="w-full">
        Ver resultados
      </Button>
    </div>
  );
}
