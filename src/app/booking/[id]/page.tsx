import Link from "next/link";
import { notFound } from "next/navigation";

import CancelBookingButton from "@/app/booking/[id]/CancelBookingButton";
import TopBar from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatSlotRange } from "@/lib/time";

type Props = { params: Promise<{ id: string }> };

export const metadata = { title: "Booking confirmed" };

export default async function BookingConfirmationPage({ params }: Props) {
  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!booking) notFound();

  const viewer = await getCurrentUser();
  const host = booking.user;
  const cancelled = booking.status === "CANCELLED";

  return (
    <>
      <TopBar user={viewer} />
      <main className="page-narrow">
        <div className="card">
          <h1 style={{ fontSize: "1.4rem" }}>
            {cancelled ? "Booking cancelled" : "You're booked"}
          </h1>
          <p className="muted">
            {cancelled
              ? "This meeting has been cancelled and removed from the calendar."
              : booking.calendarSync === "SENT"
                ? `A calendar invite is on its way to ${booking.guestEmail}.`
                : `The time is reserved for ${booking.guestEmail}.`}
          </p>

          <ul className="meta-list" style={{ marginTop: 20 }}>
            <li>
              <span className="meta-icon" aria-hidden>
                📅
              </span>
              <strong>{formatSlotRange(booking.startUtc, booking.endUtc, booking.guestTz)}</strong>
            </li>
            <li>
              <span className="meta-icon" aria-hidden>
                👤
              </span>
              {host.name} &amp; {booking.guestName}
            </li>
            <li>
              <span className="meta-icon" aria-hidden>
                ⏱
              </span>
              {host.eventTitle} · {host.durationMinutes} minutes
            </li>
            {booking.googleMeetUrl ? (
              <li>
                <span className="meta-icon" aria-hidden>
                  🔗
                </span>
                <a href={booking.googleMeetUrl} target="_blank" rel="noreferrer">
                  Join with Google Meet
                </a>
              </li>
            ) : (
              host.eventLocation && (
                <li>
                  <span className="meta-icon" aria-hidden>
                    📍
                  </span>
                  {host.eventLocation}
                </li>
              )
            )}
          </ul>

          {!cancelled && booking.calendarSync !== "SENT" && (
            <div className="alert alert-warning" style={{ marginTop: 18 }}>
              {booking.calendarSync === "SKIPPED"
                ? "The host hasn't connected Google Calendar yet, so no invite email was sent. Add the meeting to your own calendar with the file below."
                : "The time is reserved, but the Google Calendar invite could not be created. Use the calendar file below, and the host will follow up."}
            </div>
          )}

          <div className="row" style={{ marginTop: 20 }}>
            <a className="btn btn-secondary btn-sm" href={`/api/bookings/${booking.id}/ics`}>
              Download calendar file
            </a>
            {!cancelled && (
              <CancelBookingButton bookingId={booking.id} token={booking.cancelToken} />
            )}
          </div>
        </div>

        <p className="faint" style={{ marginTop: 16, textAlign: "center" }}>
          Need a different time? <Link href={`/${host.username}`}>Book again with {host.name}</Link>
        </p>
      </main>
    </>
  );
}
