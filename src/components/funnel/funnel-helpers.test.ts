import { describe, expect, it } from "vitest";
import { formatAppointment, groupSlotsByDay } from "./slots";
import { readTracking } from "./tracking";

describe("groupSlotsByDay", () => {
  it("groups by local day in the tenant time zone with es-EC labels", () => {
    // 2026-10-20 23:30 UTC is still Tuesday 18:30 in Guayaquil (UTC-5).
    const slots = [new Date("2026-10-21T14:00:00Z"), new Date("2026-10-20T23:30:00Z"), new Date("2026-10-20T14:00:00Z")];
    const days = groupSlotsByDay(slots, "America/Guayaquil");
    expect(days.map((d) => d.key)).toEqual(["2026-10-20", "2026-10-21"]);
    expect(days[0]!.weekday).toBe("martes");
    expect(days[0]!.date).toBe("20 de octubre");
    expect(days[0]!.slots.map((s) => s.time)).toEqual(["09:00", "18:30"]);
    expect(days[1]!.slots[0]!.iso).toBe("2026-10-21T14:00:00.000Z");
  });

  it("returns no days for no slots", () => {
    expect(groupSlotsByDay([], "America/Guayaquil")).toEqual([]);
  });

  it("formats an appointment in the tenant zone", () => {
    expect(formatAppointment(new Date("2026-10-21T15:00:00Z"), "America/Guayaquil")).toBe("miércoles 21 de octubre, 10:00");
  });
});

describe("readTracking", () => {
  it("captures utm params and derives fbc from fbclid", () => {
    const t = readTracking(new URLSearchParams("utm_source=facebook&utm_campaign=c1&fbclid=abc&other=x"), "", 1_700_000_000_000);
    expect(t).toEqual({ utm: { utm_source: "facebook", utm_campaign: "c1" }, fbclid: "abc", fbc: "fb.1.1700000000000.abc" });
  });

  it("prefers the _fbc cookie and reads _fbp", () => {
    const t = readTracking(new URLSearchParams("fbclid=new"), "a=1; _fbc=fb.1.123.old; _fbp=fb.1.456.789", 1);
    expect(t.fbc).toBe("fb.1.123.old");
    expect(t.fbp).toBe("fb.1.456.789");
  });

  it("returns only empty utm without ad params", () => {
    expect(readTracking(new URLSearchParams(""), "")).toEqual({ utm: {} });
  });
});
