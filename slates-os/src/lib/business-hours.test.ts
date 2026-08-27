import { describe, it, expect } from "vitest";
import { formatBusinessHoursSummary } from "./business-hours";
import type { Database } from "./database.types";

type BusinessHoursRow = Database["public"]["Tables"]["business_hours"]["Row"];

function hours(dayOfWeek: number, isOpen: boolean, openTime: string | null, closeTime: string | null): BusinessHoursRow {
  return {
    id: `row-${dayOfWeek}`,
    organization_id: "org-1",
    day_of_week: dayOfWeek,
    is_open: isOpen,
    open_time: openTime,
    close_time: closeTime,
  };
}

describe("formatBusinessHoursSummary", () => {
  it("reports 'Hours not set' for an empty list", () => {
    expect(formatBusinessHoursSummary([])).toBe("Hours not set");
  });

  it("reports 'Hours not set' when every day is closed", () => {
    const rows = [0, 1, 2, 3, 4, 5, 6].map((d) => hours(d, false, null, null));
    expect(formatBusinessHoursSummary(rows)).toBe("Hours not set");
  });

  it("formats a single open day with no range to collapse", () => {
    expect(formatBusinessHoursSummary([hours(3, true, "09:00", "17:00")])).toBe("Wed 9AM–5PM");
  });

  it("groups consecutive days that share identical hours", () => {
    const weekdays = [1, 2, 3, 4, 5].map((d) => hours(d, true, "09:00", "17:00"));
    expect(formatBusinessHoursSummary(weekdays)).toBe("Mon–Fri 9AM–5PM");
  });

  it("keeps a day with different hours as its own group", () => {
    const rows = [
      ...[1, 2, 3, 4, 5].map((d) => hours(d, true, "09:00", "17:00")),
      hours(6, true, "10:00", "14:00"),
    ];
    expect(formatBusinessHoursSummary(rows)).toBe("Mon–Fri 9AM–5PM, Sat 10AM–2PM");
  });

  it("skips closed days entirely, even mid-week", () => {
    const rows = [
      hours(1, true, "09:00", "17:00"),
      hours(2, false, null, null),
      hours(3, true, "09:00", "17:00"),
    ];
    // Tuesday is closed, so Monday and Wednesday cannot merge into one group.
    expect(formatBusinessHoursSummary(rows)).toBe("Mon 9AM–5PM, Wed 9AM–5PM");
  });

  it("formats midnight and noon correctly", () => {
    expect(formatBusinessHoursSummary([hours(0, true, "00:00", "12:00")])).toBe("Sun 12AM–12PM");
  });

  it("formats a half-hour boundary", () => {
    expect(formatBusinessHoursSummary([hours(2, true, "08:30", "17:30")])).toBe("Tue 8:30AM–5:30PM");
  });
});
