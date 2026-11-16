import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { FilterForm } from "./FilterForm";
import { selectClass } from "./fields";
import { LocationSelects } from "./LocationSelects";

type Option = { value: string; label: string };

type HeroSearchProps = {
  /** Operations and types that have live listings; a selector with one option is not shown. */
  operations: Option[];
  types: Option[];
  className?: string;
};

const labelClass = "block text-left text-sm font-medium text-ink";

/**
 * Property search for the home page: a plain GET form to /propiedades (works without JavaScript).
 * Operation and type only offer what is in stock; places cover the whole country.
 */
export function HeroSearch({ operations, types, className }: HeroSearchProps) {
  const fields = [
    operations.length > 1 ? { name: "operation", label: "Quiero", all: "Comprar o alquilar", options: operations } : null,
    types.length > 1 ? { name: "type", label: "Tipo de propiedad", all: "Todos los tipos", options: types } : null,
  ].filter((f) => f !== null);

  return (
    <FilterForm
      action="/propiedades"
      label="Buscar propiedades"
      className={cn("@container rounded-lg bg-sand p-4 text-left sm:p-5", className)}
    >
      <div className="grid gap-3 @min-[30rem]:grid-cols-2 @min-[52rem]:flex @min-[52rem]:items-end">
        {fields.map((f) => (
          <div key={f.name} className="@min-[52rem]:min-w-0 @min-[52rem]:flex-1">
            <label htmlFor={`buscar-${f.name}`} className={labelClass}>
              {f.label}
            </label>
            <select id={`buscar-${f.name}`} name={f.name} defaultValue="" className={selectClass}>
              <option value="">{f.all}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        {/* Every province and canton of Ecuador, whether or not there is stock there yet. */}
        <LocationSelects
          idPrefix="buscar"
          selectClassName={selectClass}
          labelClassName={labelClass}
          fieldClassName="@min-[52rem]:min-w-0 @min-[52rem]:flex-1"
        />
        <Button type="submit" size="lg" className="w-full @min-[30rem]:col-span-2 @min-[52rem]:w-auto @min-[52rem]:shrink-0">
          Buscar
        </Button>
      </div>
    </FilterForm>
  );
}
