/**
 * Pure availability math — no Supabase, no fetching. Both the internal
 * Schedule page and the future public booking page (Phase 2B-3) call this
 * with plain data (business hours, existing busy spans) so the slot logic
 * only has to be written and tested once. See docs note in the
 * add_availability migration.
 */

export interface DayHours {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

export interface Interval {
  start: Date;
  end: Date;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** The single open interval for `date`, or null if closed that day / no hours configured. */
export function getOpenInterval(businessHours: DayHours[], date: Date): Interval | null {
  const hours = businessHours.find((h) => h.day_of_week === date.getDay());
  if (!hours || !hours.is_open || !hours.open_time || !hours.close_time) return null;

  const openMinutes = timeToMinutes(hours.open_time);
  const closeMinutes = timeToMinutes(hours.close_time);

  const start = new Date(date);
  start.setHours(0, openMinutes, 0, 0);
  const end = new Date(date);
  end.setHours(0, closeMinutes, 0, 0);

  return { start, end };
}

/** Subtracts (possibly overlapping) busy intervals from one open interval, returning the free gaps. */
export function subtractBusy(open: Interval, busy: Interval[]): Interval[] {
  const clamped = busy
    .map((b) => ({
      start: b.start < open.start ? open.start : b.start,
      end: b.end > open.end ? open.end : b.end,
    }))
    .filter((b) => b.start < b.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const free: Interval[] = [];
  let cursor = open.start;

  for (const b of clamped) {
    if (b.start > cursor) free.push({ start: cursor, end: b.start });
    if (b.end > cursor) cursor = b.end;
  }
  if (cursor < open.end) free.push({ start: cursor, end: open.end });

  return free;
}

/** Free time on `date`, given business hours and a list of already-busy spans (jobs, blocks). */
export function getFreeIntervals(businessHours: DayHours[], date: Date, busy: Interval[]): Interval[] {
  const open = getOpenInterval(businessHours, date);
  if (!open) return [];
  return subtractBusy(open, busy);
}

/** Splits free intervals into bookable start times at `slotMinutes` steps that fit `durationMinutes`. */
export function getBookableSlots(free: Interval[], durationMinutes: number, slotMinutes = 30): Date[] {
  const slots: Date[] = [];
  for (const interval of free) {
    let cursor = new Date(interval.start);
    while (cursor.getTime() + durationMinutes * 60_000 <= interval.end.getTime()) {
      slots.push(new Date(cursor));
      cursor = new Date(cursor.getTime() + slotMinutes * 60_000);
    }
  }
  return slots;
}
