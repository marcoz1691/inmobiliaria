/** Pure availability engine. All instants are UTC `Date`s; rules are in the agent's local time zone. */

export type AvailabilityRule = { weekday: number; startMinute: number; endMinute: number };
export type Interval = { start: Date; end: Date };

export type SlotQuery = {
  rules: AvailabilityRule[];
  busy: Interval[];
  timezone: string;
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  now: Date;
  stepMinutes?: number;
};

const MINUTE = 60_000;

/** Local calendar parts of an instant in `timeZone`. weekday: 0 = Sunday. */
export function localParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday!);
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), weekday };
}

function offsetMinutes(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(date.getTime() / MINUTE) * MINUTE) / MINUTE);
}

/** UTC instant for a local wall-clock time. Handles DST by re-checking the offset at the result. */
export function zonedToUtc(year: number, month: number, day: number, minuteOfDay: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  let result = new Date(guess - offsetMinutes(new Date(guess), timeZone) * MINUTE);
  const corrected = new Date(guess - offsetMinutes(result, timeZone) * MINUTE);
  if (corrected.getTime() !== result.getTime()) result = corrected;
  return result;
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export function computeSlots(q: SlotQuery): Date[] {
  const step = q.stepMinutes ?? Math.max(15, Math.min(q.durationMinutes, 60));
  const earliest = new Date(q.now.getTime() + q.minNoticeHours * 60 * MINUTE);
  const padded = q.busy.map((b) => ({
    start: new Date(b.start.getTime() - q.bufferMinutes * MINUTE),
    end: new Date(b.end.getTime() + q.bufferMinutes * MINUTE),
  }));
  const today = localParts(q.now, q.timezone);
  const slots: Date[] = [];
  for (let i = 0; i <= q.maxDaysAhead; i++) {
    // Walk local calendar days; noon UTC of the local date avoids DST edge cases when stepping.
    const dayRef = new Date(Date.UTC(today.year, today.month - 1, today.day + i, 12));
    const y = dayRef.getUTCFullYear();
    const mo = dayRef.getUTCMonth() + 1;
    const d = dayRef.getUTCDate();
    const weekday = dayRef.getUTCDay();
    for (const rule of q.rules.filter((r) => r.weekday === weekday)) {
      for (let m = rule.startMinute; m + q.durationMinutes <= rule.endMinute; m += step) {
        const start = zonedToUtc(y, mo, d, m, q.timezone);
        const slot = { start, end: new Date(start.getTime() + q.durationMinutes * MINUTE) };
        if (start < earliest) continue;
        if (padded.some((b) => overlaps(slot, b))) continue;
        slots.push(start);
      }
    }
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}

/** True when `start` is one of the slots the engine would offer (server-side re-validation on booking). */
export function isSlotAvailable(q: SlotQuery, start: Date): boolean {
  return computeSlots(q).some((s) => s.getTime() === start.getTime());
}
