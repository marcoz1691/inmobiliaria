import { describe, expect, it } from "vitest";
import { computeSlots, isSlotAvailable, localParts, zonedToUtc } from "./slots";

const base = {
  rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }],
  busy: [],
  timezone: "America/Guayaquil",
  durationMinutes: 30,
  bufferMinutes: 0,
  minNoticeHours: 0,
  maxDaysAhead: 7,
};

describe("slots", () => {
  it("converts Guayaquil wall time to UTC (UTC-5)", () => {
    expect(zonedToUtc(2026, 10, 19, 9 * 60, "America/Guayaquil").toISOString()).toBe("2026-10-19T14:00:00.000Z");
  });

  it("handles DST zones", () => {
    // New York: EDT (UTC-4) in October, EST (UTC-5) in December.
    expect(zonedToUtc(2026, 10, 19, 9 * 60, "America/New_York").toISOString()).toBe("2026-10-19T13:00:00.000Z");
    expect(zonedToUtc(2026, 12, 14, 9 * 60, "America/New_York").toISOString()).toBe("2026-12-14T14:00:00.000Z");
  });

  it("offers Monday 09:00–11:30 local slots", () => {
    const now = new Date("2026-10-18T12:00:00Z"); // Sunday
    const slots = computeSlots({ ...base, now });
    expect(slots[0]!.toISOString()).toBe("2026-10-19T14:00:00.000Z");
    expect(slots.filter((s) => localParts(s, base.timezone).day === 19)).toHaveLength(6);
  });

  it("respects minimum notice, busy intervals and buffers", () => {
    const now = new Date("2026-10-19T13:00:00Z"); // Monday 08:00 local
    const busy = [{ start: new Date("2026-10-19T15:00:00Z"), end: new Date("2026-10-19T15:30:00Z") }]; // 10:00–10:30
    const slots = computeSlots({ ...base, now, minNoticeHours: 2, busy, bufferMinutes: 15, maxDaysAhead: 0 }).map((s) => s.toISOString());
    // Notice pushes start to 10:00; busy+buffer blocks 09:45–10:45 → 10:00 and 10:30 removed.
    expect(slots).toEqual(["2026-10-19T16:00:00.000Z", "2026-10-19T16:30:00.000Z"]);
  });

  it("re-validates a requested slot", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    expect(isSlotAvailable({ ...base, now }, new Date("2026-10-19T14:00:00Z"))).toBe(true);
    expect(isSlotAvailable({ ...base, now }, new Date("2026-10-19T14:10:00Z"))).toBe(false);
  });
});
