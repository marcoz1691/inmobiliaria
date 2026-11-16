"use client";

import { useEffect, useRef, useState } from "react";
import { CANTONS, PROVINCES } from "@/modules/geo/ecuador";

type Props = {
  idPrefix: string;
  defaultProvince?: string;
  defaultCity?: string;
  selectClassName: string;
  labelClassName: string;
  /** Wrapper of each label + select pair. */
  fieldClassName?: string;
  provinceLabel?: string;
  cityLabel?: string;
  anyProvince?: string;
  anyCity?: string;
};

const BY_PROVINCE = PROVINCES.map((p) => ({ province: p, cantons: CANTONS.filter((c) => c.province.slug === p.slug) }));

/**
 * Province and city (canton) of Ecuador, all 24 and 223. Plain selects submitted by GET, so they
 * work without JavaScript (cities grouped by province); with it, the city list narrows to the
 * chosen province. Values are slugs, matched against listings in src/modules/properties/landing.ts.
 */
export function LocationSelects({
  idPrefix,
  defaultProvince = "",
  defaultCity = "",
  selectClassName,
  labelClassName,
  fieldClassName,
  provinceLabel = "Provincia",
  cityLabel = "Ciudad",
  anyProvince = "Todas las provincias",
  anyCity = "Todas las ciudades",
}: Props) {
  const initialCity = CANTONS.find((c) => c.slug === defaultCity);
  const initialProvince = defaultProvince || initialCity?.province.slug || "";
  // Uncontrolled selects: a choice made before hydration is kept, and read back on mount.
  const provinceRef = useRef<HTMLSelectElement>(null);
  const cityRef = useRef<HTMLSelectElement>(null);
  const [province, setProvince] = useState(initialProvince);
  useEffect(() => {
    if (provinceRef.current) setProvince(provinceRef.current.value);
  }, []);
  const groups = province ? BY_PROVINCE.filter((g) => g.province.slug === province) : BY_PROVINCE;

  return (
    <>
      <div className={fieldClassName}>
        <label htmlFor={`${idPrefix}-province`} className={labelClassName}>
          {provinceLabel}
        </label>
        <select
          id={`${idPrefix}-province`}
          name="province"
          ref={provinceRef}
          defaultValue={initialProvince}
          onChange={(e) => {
            const next = e.target.value;
            setProvince(next);
            const city = cityRef.current;
            if (city?.value && next && !CANTONS.some((c) => c.slug === city.value && c.province.slug === next)) city.value = "";
          }}
          className={selectClassName}
        >
          <option value="">{anyProvince}</option>
          {PROVINCES.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className={fieldClassName}>
        <label htmlFor={`${idPrefix}-city`} className={labelClassName}>
          {cityLabel}
        </label>
        <select id={`${idPrefix}-city`} name="city" ref={cityRef} defaultValue={initialCity?.slug ?? ""} className={selectClassName}>
          <option value="">{anyCity}</option>
          {groups.length === 1
            ? groups[0]!.cantons.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))
            : groups.map((g) => (
                <optgroup key={g.province.slug} label={g.province.name}>
                  {g.cantons.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
        </select>
      </div>
    </>
  );
}
