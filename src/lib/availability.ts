import { DateTime } from "luxon";

import { luxonWeekdayToIndex } from "@/lib/time";

/** A span of minutes within a single day, measured from midnight. */
export type Interval = { start: number; end: number };

/** A span of absolute time, in epoch milliseconds. */
export type BusySpan = { start: number; end: number };

export type WeeklyRule = { weekday: number; startMinute: number; endMinute: number };

export type OverrideRecord = { date: string; blocked: boolean; intervals: string };

export type SchedulingSettings = {
  timezone: string;
  durationMinutes: number;
  bufferMinutes: number;
  slotIntervalMins: number;
  minNoticeMinutes: number;
  maxDaysAhead: number;
};

export type Slot = { startUtc: string; endUtc: string };

export const MINUTES_IN_DAY = 24 * 60;

/** Safely parse the JSON blob stored on a DateOverride. */
export function parseIntervals(json: string): Interval[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const record = item as Partial<Interval>;
        return { start: Number(record?.start), end: Number(record?.end) };
      })
      .filter(
        (i) =>
          Number.isFinite(i.start) &&
          Number.isFinite(i.end) &&
          i.start >= 0 &&
          i.end <= MINUTES_IN_DAY &&
          i.start < i.end,
      );
  } catch {
    return [];
  }
}

/** Sorts and unions overlapping/adjacent intervals. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals]
    .filter((i) => i.start < i.end)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

/**
 * Working intervals for one calendar day in the host's timezone.
 * A date override always replaces the weekly rules for that day.
 */
export function intervalsForDate(
  dateISO: string,
  weeklyRules: WeeklyRule[],
  override: OverrideRecord | null | undefined,
  zone: string,
): Interval[] {
  if (override) {
    if (override.blocked) return [];
    return mergeIntervals(parseIntervals(override.intervals));
  }

  const day = DateTime.fromISO(dateISO, { zone });
  if (!day.isValid) return [];
  const weekdayIndex = luxonWeekdayToIndex(day.weekday);
  return mergeIntervals(
    weeklyRules
      .filter((rule) => rule.weekday === weekdayIndex)
      .map((rule) => ({ start: rule.startMinute, end: rule.endMinute })),
  );
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Bookable slots for a single date, already filtered against busy time,
 * minimum notice and the booking horizon. Returned times are UTC ISO strings.
 */
export function generateSlotsForDate(params: {
  dateISO: string;
  settings: SchedulingSettings;
  weeklyRules: WeeklyRule[];
  override?: OverrideRecord | null;
  busy?: BusySpan[];
  now?: DateTime;
}): Slot[] {
  const { dateISO, settings, weeklyRules, override, busy = [] } = params;
  const zone = settings.timezone;
  const now = params.now ?? DateTime.now();

  const dayStart = DateTime.fromISO(dateISO, { zone }).startOf("day");
  if (!dayStart.isValid) return [];

  // Booking horizon: today through maxDaysAhead (inclusive), host-local.
  const today = now.setZone(zone).startOf("day");
  const horizon = today.plus({ days: settings.maxDaysAhead });
  if (dayStart < today || dayStart > horizon) return [];

  const earliestStart = now.plus({ minutes: settings.minNoticeMinutes });
  const step = Math.max(5, settings.slotIntervalMins);
  const duration = settings.durationMinutes;
  const buffer = settings.bufferMinutes;

  // Expand busy spans by the buffer so back-to-back meetings keep breathing room.
  const blocked = busy.map((span) => ({
    start: span.start - buffer * 60_000,
    end: span.end + buffer * 60_000,
  }));

  const slots: Slot[] = [];
  for (const interval of intervalsForDate(dateISO, weeklyRules, override, zone)) {
    for (let minute = interval.start; minute + duration <= interval.end; minute += step) {
      // Adding minutes to the day start (rather than setting the clock time)
      // keeps DST transitions correct.
      const start = dayStart.plus({ minutes: minute });
      const end = start.plus({ minutes: duration });

      if (start < earliestStart) continue;

      const startMs = start.toMillis();
      const endMs = end.toMillis();
      if (blocked.some((span) => overlaps(startMs, endMs, span.start, span.end))) continue;

      slots.push({
        startUtc: start.toUTC().toISO() as string,
        endUtc: end.toUTC().toISO() as string,
      });
    }
  }

  return slots;
}

/** Inclusive list of ISO dates between two ISO dates. */
export function datesBetween(fromISO: string, toISO: string, zone: string): string[] {
  const start = DateTime.fromISO(fromISO, { zone }).startOf("day");
  const end = DateTime.fromISO(toISO, { zone }).startOf("day");
  if (!start.isValid || !end.isValid || end < start) return [];

  const dates: string[] = [];
  let cursor = start;
  // Guard against pathological ranges.
  while (cursor <= end && dates.length < 400) {
    dates.push(cursor.toISODate() as string);
    cursor = cursor.plus({ days: 1 });
  }
  return dates;
}

/** Slots for every date in a range, keyed by ISO date. Empty days are omitted. */
export function generateSlotsForRange(params: {
  fromISO: string;
  toISO: string;
  settings: SchedulingSettings;
  weeklyRules: WeeklyRule[];
  overrides?: OverrideRecord[];
  busy?: BusySpan[];
  now?: DateTime;
}): Record<string, Slot[]> {
  const overrideByDate = new Map((params.overrides ?? []).map((o) => [o.date, o]));
  const result: Record<string, Slot[]> = {};

  for (const dateISO of datesBetween(params.fromISO, params.toISO, params.settings.timezone)) {
    const slots = generateSlotsForDate({
      dateISO,
      settings: params.settings,
      weeklyRules: params.weeklyRules,
      override: overrideByDate.get(dateISO) ?? null,
      busy: params.busy,
      now: params.now,
    });
    if (slots.length > 0) result[dateISO] = slots;
  }

  return result;
}

/** True when the requested span is still bookable for this host. */
export function isSlotBookable(params: {
  startUtc: string;
  settings: SchedulingSettings;
  weeklyRules: WeeklyRule[];
  overrides?: OverrideRecord[];
  busy?: BusySpan[];
  now?: DateTime;
}): boolean {
  const start = DateTime.fromISO(params.startUtc, { zone: "utc" });
  if (!start.isValid) return false;

  const dateISO = start.setZone(params.settings.timezone).toISODate() as string;
  const overrideByDate = new Map((params.overrides ?? []).map((o) => [o.date, o]));

  const slots = generateSlotsForDate({
    dateISO,
    settings: params.settings,
    weeklyRules: params.weeklyRules,
    override: overrideByDate.get(dateISO) ?? null,
    busy: params.busy,
    now: params.now,
  });

  return slots.some((slot) => DateTime.fromISO(slot.startUtc).toMillis() === start.toMillis());
}
