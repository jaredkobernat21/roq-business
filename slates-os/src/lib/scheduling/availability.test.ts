import { describe, it, expect } from "vitest";
import { getOpenInterval, subtractBusy, getFreeIntervals, getBookableSlots, type DayHours, type Interval } from "./availability";

const DATE = new Date(2026, 7, 26);
const DOW = DATE.getDay();

function openHours(overrides: Partial<DayHours> = {}): DayHours[] {
  return [{ day_of_week: DOW, is_open: true, open_time: "09:00", close_time: "17:00", ...overrides }];
}

function at(hour: number, minute = 0): Date {
  const d = new Date(DATE);
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe("getOpenInterval", () => {
  it("returns null when there's no hours row for that day", () => {
    expect(getOpenInterval([], DATE)).toBeNull();
  });

  it("returns null when the day is marked closed", () => {
    expect(getOpenInterval(openHours({ is_open: false }), DATE)).toBeNull();
  });

  it("returns null when open or close time is missing", () => {
    expect(getOpenInterval(openHours({ open_time: null }), DATE)).toBeNull();
    expect(getOpenInterval(openHours({ close_time: null }), DATE)).toBeNull();
  });

  it("returns the open interval for a normal open day", () => {
    const interval = getOpenInterval(openHours(), DATE)!;
    expect(interval.start.getTime()).toBe(at(9).getTime());
    expect(interval.end.getTime()).toBe(at(17).getTime());
  });
});

describe("subtractBusy", () => {
  const open: Interval = { start: at(9), end: at(17) };

  it("returns the whole open interval when nothing is busy", () => {
    expect(subtractBusy(open, [])).toEqual([open]);
  });

  it("carves a single gap out of the middle", () => {
    const busy = [{ start: at(12), end: at(13) }];
    expect(subtractBusy(open, busy)).toEqual([
      { start: at(9), end: at(12) },
      { start: at(13), end: at(17) },
    ]);
  });

  it("merges overlapping busy intervals into one gap", () => {
    const busy = [
      { start: at(10), end: at(12) },
      { start: at(11), end: at(13) },
    ];
    expect(subtractBusy(open, busy)).toEqual([
      { start: at(9), end: at(10) },
      { start: at(13), end: at(17) },
    ]);
  });

  it("clamps a busy interval that starts before opening", () => {
    const busy = [{ start: at(7), end: at(10) }];
    expect(subtractBusy(open, busy)).toEqual([{ start: at(10), end: at(17) }]);
  });

  it("drops a busy interval that falls entirely outside the open range", () => {
    const busy = [{ start: at(18), end: at(19) }];
    expect(subtractBusy(open, busy)).toEqual([open]);
  });

  it("returns no free time when a busy interval covers the whole open range", () => {
    const busy = [{ start: at(8), end: at(18) }];
    expect(subtractBusy(open, busy)).toEqual([]);
  });
});

describe("getFreeIntervals", () => {
  it("returns [] when the day is closed", () => {
    expect(getFreeIntervals([], DATE, [])).toEqual([]);
  });

  it("combines getOpenInterval and subtractBusy", () => {
    const busy = [{ start: at(12), end: at(13) }];
    expect(getFreeIntervals(openHours(), DATE, busy)).toEqual([
      { start: at(9), end: at(12) },
      { start: at(13), end: at(17) },
    ]);
  });
});

describe("getBookableSlots", () => {
  it("produces slots at the requested step that fit the job duration", () => {
    const free = [{ start: at(9), end: at(10) }];
    expect(getBookableSlots(free, 30, 30)).toEqual([at(9, 0), at(9, 30)]);
  });

  it("produces no slots when the interval is shorter than the job duration", () => {
    const free = [{ start: at(9), end: at(9, 45) }];
    expect(getBookableSlots(free, 60, 30)).toEqual([]);
  });

  it("fits exactly one slot when duration equals the interval length", () => {
    const free = [{ start: at(9), end: at(10) }];
    expect(getBookableSlots(free, 60, 30)).toEqual([at(9, 0)]);
  });

  it("uses a default 30-minute step when none is given", () => {
    const free = [{ start: at(9), end: at(10, 30) }];
    expect(getBookableSlots(free, 60)).toEqual([at(9, 0), at(9, 30)]);
  });

  it("spans multiple free intervals independently", () => {
    const free = [
      { start: at(9), end: at(9, 30) },
      { start: at(13), end: at(13, 30) },
    ];
    expect(getBookableSlots(free, 30, 30)).toEqual([at(9, 0), at(13, 0)]);
  });
});
