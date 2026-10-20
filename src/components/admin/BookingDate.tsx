const TZ = "America/Guayaquil";
const weekday = new Intl.DateTimeFormat("es-EC", { weekday: "short", timeZone: TZ });
const day = new Intl.DateTimeFormat("es-EC", { day: "numeric", timeZone: TZ });
const time = new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const full = new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ });

export const KIND_LABEL: Record<string, string> = { video: "Videollamada", phone: "Llamada", in_person: "Presencial" };

export const bookingTime = (d: Date) => time.format(d);
export const bookingFull = (d: Date) => full.format(d);

/** Calendar-app style date chip: short weekday over the day number. Decorative next to readable text. */
export function BookingDate({ date }: { date: Date }) {
  return (
    <span aria-hidden="true" className="flex w-[1.875rem] shrink-0 flex-col items-center leading-none">
      <span className="text-[0.625rem] font-semibold tracking-[0.04em] text-sold uppercase">{weekday.format(date).replace(".", "")}</span>
      <span className="mt-0.5 text-[1.25rem] font-semibold tracking-[-0.02em] text-ink tabular-nums">{day.format(date)}</span>
    </span>
  );
}
