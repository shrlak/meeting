import { NextResponse } from "next/server";
import { DateTime } from "luxon";

import { jsonError, route } from "@/lib/api";
import { generateSlotsForRange } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { loadSchedulingContext } from "@/lib/scheduling";

type Context = { params: Promise<{ username: string }> };

/**
 * Public slot feed for a host's booking page.
 * GET /api/public/{username}/slots?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const GET = route(async (request: Request, context: Context) => {
  const { username } = await context.params;
  const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!user) return jsonError("No booking page found for that username.", 404);

  const { searchParams } = new URL(request.url);
  const zone = user.timezone;
  const today = DateTime.now().setZone(zone).startOf("day");

  const from = searchParams.get("from") ?? (today.toISODate() as string);
  const requestedTo = searchParams.get("to");
  const horizon = today.plus({ days: user.maxDaysAhead });

  let to = requestedTo ?? (horizon.toISODate() as string);
  // Never generate beyond the host's booking horizon.
  if (DateTime.fromISO(to, { zone }) > horizon) to = horizon.toISODate() as string;

  if (!DateTime.fromISO(from, { zone }).isValid || !DateTime.fromISO(to, { zone }).isValid) {
    return jsonError("Invalid date range.", 422);
  }
  if (DateTime.fromISO(to, { zone }) < DateTime.fromISO(from, { zone })) {
    return NextResponse.json({ days: {} });
  }

  const scheduling = await loadSchedulingContext(user, from, to);
  const days = generateSlotsForRange({
    fromISO: from,
    toISO: to,
    settings: scheduling.settings,
    weeklyRules: scheduling.weeklyRules,
    overrides: scheduling.overrides,
    busy: scheduling.busy,
  });

  return NextResponse.json({
    host: {
      name: user.name,
      username: user.username,
      timezone: user.timezone,
      eventTitle: user.eventTitle,
      eventDescription: user.eventDescription,
      eventLocation: user.eventLocation,
      durationMinutes: user.durationMinutes,
    },
    range: { from, to },
    days,
  });
});
