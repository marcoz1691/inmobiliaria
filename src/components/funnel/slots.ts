/** A bookable time, ready to render: ISO instant plus its label in the tenant's time zone. */
export type SlotOption = { iso: string; time: string };
export type SlotDay = { key: string; weekday: string; date: string; label: string; slots: SlotOption[] };

/**
 * Groups UTC slot instants by local calendar day in `timeZone`, with es-EC labels
 * ("lunes", "20 de octubre", "09:30"). Days keep chronological order.
 */
export function groupSlotsByDay(slots: Date[], timeZone: string, locale = "es-EC"): SlotDay[] {
  const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const weekdayFmt = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long" });
  const dateFmt = new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "long" });
  const timeFmt = new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const days = new Map<string, SlotDay>();
  for (const s of [...slots].sort((a, b) => a.getTime() - b.getTime())) {
    const key = keyFmt.format(s);
    let day = days.get(key);
    if (!day) {
      const weekday = weekdayFmt.format(s);
      const date = dateFmt.format(s);
      day = { key, weekday, date, label: `${weekday} ${date}`, slots: [] };
      days.set(key, day);
    }
    day.slots.push({ iso: s.toISOString(), time: timeFmt.format(s) });
  }
  return [...days.values()];
}

/** "martes 21 de octubre, 10:00" in the tenant's time zone. */
export function formatAppointment(date: Date, timeZone: string, locale = "es-EC"): string {
  const day = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long", day: "numeric", month: "long" }).format(date);
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return `${day.replace(",", "")}, ${time}`;
}
