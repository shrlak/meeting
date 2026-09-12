import { NextResponse } from "next/server";

import { readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { mergeIntervals } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { weeklyAvailabilitySchema } from "@/lib/validation";

export const GET = route(async () => {
  const user = await requireUser();
  const rules = await prisma.availabilityRule.findMany({
    where: { userId: user.id },
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
  });
  return NextResponse.json({ rules });
});

/** Replaces the whole weekly schedule in one shot. */
export const PUT = route(async (request: Request) => {
  const user = await requireUser();
  const { rules } = weeklyAvailabilitySchema.parse(await readJson(request));

  // Normalise per weekday so overlapping blocks can't produce duplicate slots.
  const byWeekday = new Map<number, { start: number; end: number }[]>();
  for (const rule of rules) {
    const list = byWeekday.get(rule.weekday) ?? [];
    list.push({ start: rule.start, end: rule.end });
    byWeekday.set(rule.weekday, list);
  }

  const normalised = [...byWeekday.entries()].flatMap(([weekday, intervals]) =>
    mergeIntervals(intervals).map((interval) => ({
      userId: user.id,
      weekday,
      startMinute: interval.start,
      endMinute: interval.end,
    })),
  );

  await prisma.$transaction([
    prisma.availabilityRule.deleteMany({ where: { userId: user.id } }),
    ...normalised.map((data) => prisma.availabilityRule.create({ data })),
  ]);

  return NextResponse.json({ ok: true, count: normalised.length });
});
