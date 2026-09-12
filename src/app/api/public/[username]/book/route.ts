import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { Prisma } from "@prisma/client";

import { jsonError, readJson, route } from "@/lib/api";
import { isSlotBookable } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { createCalendarInvite } from "@/lib/google";
import { loadSchedulingContext } from "@/lib/scheduling";
import { isValidTimezone } from "@/lib/time";
import { bookingSchema } from "@/lib/validation";

type Context = { params: Promise<{ username: string }> };

/** POST /api/public/{username}/book — books a slot and sends the invites. */
export const POST = route(async (request: Request, context: Context) => {
  const { username } = await context.params;
  const input = bookingSchema.parse(await readJson(request));

  const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!user) return jsonError("No booking page found for that username.", 404);

  const start = DateTime.fromISO(input.startUtc, { zone: "utc" });
  if (!start.isValid) return jsonError("Invalid meeting time.", 422);
  const end = start.plus({ minutes: user.durationMinutes });

  // Re-check availability server-side: the page may have been open for a while.
  const dateISO = start.setZone(user.timezone).toISODate() as string;
  const scheduling = await loadSchedulingContext(user, dateISO, dateISO);
  const bookable = isSlotBookable({
    startUtc: start.toISO() as string,
    settings: scheduling.settings,
    weeklyRules: scheduling.weeklyRules,
    overrides: scheduling.overrides,
    busy: scheduling.busy,
  });

  if (!bookable) {
    return jsonError("That time is no longer available. Please pick another slot.", 409);
  }

  const guestTz =
    input.guestTz && isValidTimezone(input.guestTz) ? input.guestTz : user.timezone;

  let booking;
  try {
    booking = await prisma.booking.create({
      data: {
        userId: user.id,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        guestNotes: input.guestNotes ?? "",
        guestTz,
        startUtc: start.toJSDate(),
        endUtc: end.toJSDate(),
        // Holding the slot in a unique column makes double-booking impossible
        // even if two guests submit at the same moment.
        activeSlot: start.toUTC().toISO() as string,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("Someone just booked that time. Please pick another slot.", 409);
    }
    throw error;
  }

  // Send the Google Calendar invite to host + guest. A calendar failure must
  // not lose the booking, so it is recorded on the row instead of thrown.
  const sync = await createCalendarInvite(user, booking);
  booking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      calendarSync: sync.status,
      googleEventId: sync.status === "SENT" ? sync.eventId : null,
      googleMeetUrl: sync.status === "SENT" ? sync.meetUrl : null,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      bookingId: booking.id,
      calendarSync: booking.calendarSync,
      redirect: `/booking/${booking.id}`,
    },
    { status: 201 },
  );
});
