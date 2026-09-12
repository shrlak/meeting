import { DateTime } from "luxon";
import type { User } from "@prisma/client";

import { prisma } from "@/lib/db";
import { fetchGoogleBusy } from "@/lib/google";
import type {
  BusySpan,
  OverrideRecord,
  SchedulingSettings,
  WeeklyRule,
} from "@/lib/availability";

export type SchedulingContext = {
  settings: SchedulingSettings;
  weeklyRules: WeeklyRule[];
  overrides: OverrideRecord[];
  busy: BusySpan[];
};

export function settingsFor(user: User): SchedulingSettings {
  return {
    timezone: user.timezone,
    durationMinutes: user.durationMinutes,
    bufferMinutes: user.bufferMinutes,
    slotIntervalMins: user.slotIntervalMins,
    minNoticeMinutes: user.minNoticeMinutes,
    maxDaysAhead: user.maxDaysAhead,
  };
}

/**
 * Everything the slot generator needs for a host over a date window:
 * weekly rules, per-date overrides, confirmed bookings and Google busy time.
 */
export async function loadSchedulingContext(
  user: User,
  fromISO: string,
  toISO: string,
  options: { includeGoogle?: boolean } = {},
): Promise<SchedulingContext> {
  const zone = user.timezone;
  const windowStart = DateTime.fromISO(fromISO, { zone }).startOf("day");
  const windowEnd = DateTime.fromISO(toISO, { zone }).endOf("day");

  const [rules, overrides, bookings] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { userId: user.id } }),
    prisma.dateOverride.findMany({
      where: { userId: user.id, date: { gte: fromISO, lte: toISO } },
    }),
    prisma.booking.findMany({
      where: {
        userId: user.id,
        status: "CONFIRMED",
        startUtc: { lt: windowEnd.toJSDate() },
        endUtc: { gt: windowStart.toJSDate() },
      },
      select: { startUtc: true, endUtc: true },
    }),
  ]);

  const busy: BusySpan[] = bookings.map((booking) => ({
    start: booking.startUtc.getTime(),
    end: booking.endUtc.getTime(),
  }));

  if (options.includeGoogle !== false) {
    const googleBusy = await fetchGoogleBusy(
      user,
      windowStart.toUTC().toISO() as string,
      windowEnd.toUTC().toISO() as string,
    );
    busy.push(...googleBusy);
  }

  return {
    settings: settingsFor(user),
    weeklyRules: rules.map((rule) => ({
      weekday: rule.weekday,
      startMinute: rule.startMinute,
      endMinute: rule.endMinute,
    })),
    overrides: overrides.map((override) => ({
      date: override.date,
      blocked: override.blocked,
      intervals: override.intervals,
    })),
    busy,
  };
}
