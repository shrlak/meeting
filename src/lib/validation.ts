import { z } from "zod";

import { MINUTES_IN_DAY } from "@/lib/availability";
import { isValidTimezone } from "@/lib/time";

/** Reserved words that would collide with application routes. */
export const RESERVED_USERNAMES = new Set([
  "api",
  "login",
  "signup",
  "logout",
  "dashboard",
  "settings",
  "availability",
  "booking",
  "bookings",
  "admin",
  "about",
  "help",
  "support",
  "terms",
  "privacy",
  "static",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters.")
  .max(32, "Username must be 32 characters or fewer.")
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    "Use lowercase letters, numbers and hyphens (not at the start or end).",
  )
  .refine((value) => !RESERVED_USERNAMES.has(value), "That username is reserved.");

export const timezoneSchema = z
  .string()
  .trim()
  .refine(isValidTimezone, "Unknown timezone.");

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  username: usernameSchema,
  timezone: timezoneSchema.optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const intervalSchema = z
  .object({
    start: z.number().int().min(0).max(MINUTES_IN_DAY),
    end: z.number().int().min(0).max(MINUTES_IN_DAY),
  })
  .refine((i) => i.start < i.end, "End time must be after start time.");

export const weeklyAvailabilitySchema = z.object({
  rules: z
    .array(
      intervalSchema.and(z.object({ weekday: z.number().int().min(0).max(6) })),
    )
    .max(70, "Too many availability blocks."),
});

export const dateOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
  blocked: z.boolean(),
  intervals: z.array(intervalSchema).max(12, "Too many blocks for one day."),
});

export const settingsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  username: usernameSchema,
  timezone: timezoneSchema,
  eventTitle: z.string().trim().min(1, "Give your meeting a title.").max(120),
  eventDescription: z.string().trim().max(2000),
  eventLocation: z.string().trim().max(200),
  durationMinutes: z.number().int().min(5).max(480),
  bufferMinutes: z.number().int().min(0).max(240),
  slotIntervalMins: z.number().int().min(5).max(240),
  minNoticeMinutes: z.number().int().min(0).max(60 * 24 * 30),
  maxDaysAhead: z.number().int().min(1).max(365),
});

export const bookingSchema = z.object({
  startUtc: z.string().datetime({ offset: true }),
  guestName: z.string().trim().min(1, "Your name is required.").max(80),
  guestEmail: z.string().trim().toLowerCase().email("Enter a valid email address."),
  guestNotes: z.string().trim().max(2000).optional().default(""),
  guestTz: z.string().trim().optional(),
});

/** Turns a ZodError into a single readable sentence. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request.";
}
