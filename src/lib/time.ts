import { DateTime } from "luxon";

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "9:00 AM" from minutes-since-midnight. */
export function minutesToLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "09:00" (value for an <input type="time">) from minutes-since-midnight. */
export function minutesToTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Inverse of minutesToTimeInput. Returns null for malformed input. */
export function timeInputToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Luxon uses 1=Monday..7=Sunday; the app stores 0=Sunday..6=Saturday. */
export function luxonWeekdayToIndex(weekday: number): number {
  return weekday % 7;
}

export function todayISO(zone: string): string {
  return DateTime.now().setZone(zone).toISODate() as string;
}

/** All timezones the browser/Node ICU knows about, with a sane fallback. */
export function listTimezones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
    .supportedValuesOf;
  if (typeof supported === "function") {
    try {
      return supported("timeZone");
    } catch {
      /* fall through */
    }
  }
  return [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Berlin",
    "Asia/Seoul",
    "Asia/Tokyo",
    "UTC",
  ];
}

export function guessBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function isValidTimezone(zone: string): boolean {
  return DateTime.now().setZone(zone).isValid;
}

/** e.g. "Tuesday, September 15, 2026" */
export function formatLongDate(isoDate: string, zone = "UTC"): string {
  return DateTime.fromISO(isoDate, { zone }).toFormat("cccc, LLLL d, yyyy");
}

/** e.g. "Tue, Sep 15 · 2:30 PM – 3:00 PM EDT" */
export function formatSlotRange(
  startUtc: string | Date,
  endUtc: string | Date,
  zone: string,
): string {
  const start =
    typeof startUtc === "string"
      ? DateTime.fromISO(startUtc, { zone: "utc" })
      : DateTime.fromJSDate(startUtc);
  const end =
    typeof endUtc === "string"
      ? DateTime.fromISO(endUtc, { zone: "utc" })
      : DateTime.fromJSDate(endUtc);
  const s = start.setZone(zone);
  const e = end.setZone(zone);
  return `${s.toFormat("ccc, LLL d")} · ${s.toFormat("h:mm a")} – ${e.toFormat("h:mm a ZZZZ")}`;
}
