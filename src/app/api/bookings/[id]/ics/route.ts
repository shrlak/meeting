import { prisma } from "@/lib/db";
import { buildICS } from "@/lib/ics";

type Context = { params: Promise<{ id: string }> };

/** Downloadable calendar invite for a booking. */
export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { user: true } });

  if (!booking) {
    return new Response("Booking not found.", { status: 404 });
  }

  return new Response(buildICS(booking.user, booking), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="meeting-${booking.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
