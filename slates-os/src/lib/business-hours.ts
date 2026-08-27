import type { Database } from "@/lib/database.types";

type BusinessHoursRow = Database["public"]["Tables"]["business_hours"]["Row"];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(time: string): string {
  const [hoursStr, minutesStr] = time.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${displayHour}${period}` : `${displayHour}:${String(minutes).padStart(2, "0")}${period}`;
}

/** Compact one-line summary, e.g. "Mon–Fri 8AM–5PM, Sat 9AM–1PM". */
export function formatBusinessHoursSummary(rows: BusinessHoursRow[]): string {
  const openDays = [...rows]
    .filter((row) => row.is_open && row.open_time && row.close_time)
    .sort((a, b) => a.day_of_week - b.day_of_week);

  if (openDays.length === 0) return "Hours not set";

  const groups: { start: number; end: number; open: string; close: string }[] = [];
  for (const day of openDays) {
    const last = groups[groups.length - 1];
    if (last && last.end === day.day_of_week - 1 && last.open === day.open_time && last.close === day.close_time) {
      last.end = day.day_of_week;
    } else {
      groups.push({ start: day.day_of_week, end: day.day_of_week, open: day.open_time!, close: day.close_time! });
    }
  }

  return groups
    .map((group) => {
      const dayLabel =
        group.start === group.end ? DAY_LABELS[group.start] : `${DAY_LABELS[group.start]}–${DAY_LABELS[group.end]}`;
      return `${dayLabel} ${formatTime(group.open)}–${formatTime(group.close)}`;
    })
    .join(", ");
}
