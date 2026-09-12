import { NextResponse } from "next/server";

import { jsonError, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelCalendarInvite } from "@/lib/google";

type Context = { params: Promise<{ id: string }> };

/**
 * Cancels a booking. Authorised either by the host's session or by the
 * booking's cancel token (the link the guest gets on the confirmation page).
 */
export const POST = route(async (request: Request, context: Context) => {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!booking) return jsonError("Booking not found.", 404);

  const currentUser = await getCurrentUser();
  const isHost = currentUser?.id === booking.userId;
  const hasToken = Boolean(token) && token === booking.cancelToken;
  if (!isHost && !hasToken) return jsonError("You are not allowed to cancel this booking.", 403);

  if (booking.status === "CANCELLED") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  if (booking.googleEventId) {
    await cancelCalendarInvite(booking.user, booking.googleEventId);
  }

  await prisma.booking.update({
    where: { id: booking.id },
    // Clearing activeSlot releases the unique hold so the time is bookable again.
    data: { status: "CANCELLED", activeSlot: null },
  });

  return NextResponse.json({ ok: true });
});
