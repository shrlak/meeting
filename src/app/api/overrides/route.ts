import { NextResponse } from "next/server";

import { jsonError, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { mergeIntervals } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { dateOverrideSchema } from "@/lib/validation";

/** Overrides within a date window, e.g. the month shown in the calendar. */
export const GET = route(async (request: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "0000-01-01";
  const to = searchParams.get("to") ?? "9999-12-31";

  const overrides = await prisma.dateOverride.findMany({
    where: { userId: user.id, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ overrides });
});

/** Creates or replaces the override for a single date. */
export const PUT = route(async (request: Request) => {
  const user = await requireUser();
  const input = dateOverrideSchema.parse(await readJson(request));

  if (!input.blocked && input.intervals.length === 0) {
    return jsonError("Add at least one time block, or mark the day unavailable.", 422);
  }

  const intervals = input.blocked ? [] : mergeIntervals(input.intervals);

  const override = await prisma.dateOverride.upsert({
    where: { userId_date: { userId: user.id, date: input.date } },
    create: {
      userId: user.id,
      date: input.date,
      blocked: input.blocked,
      intervals: JSON.stringify(intervals),
    },
    update: {
      blocked: input.blocked,
      intervals: JSON.stringify(intervals),
    },
  });

  return NextResponse.json({ ok: true, override });
});

/** Removes the override so the date falls back to the weekly schedule. */
export const DELETE = route(async (request: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonError("A date (YYYY-MM-DD) is required.", 422);
  }

  await prisma.dateOverride.deleteMany({ where: { userId: user.id, date } });
  return NextResponse.json({ ok: true });
});
