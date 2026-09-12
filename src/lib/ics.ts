import type { Booking, User } from "@prisma/client";

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * A calendar invite the guest can import anywhere. Used as the fallback when
 * the host has not connected Google Calendar, and offered as a download on the
 * confirmation page either way.
 */
export function buildICS(user: User, booking: Booking): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//meeting//booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${booking.id}@meeting`,
    `DTSTAMP:${toICSDate(booking.createdAt)}`,
    `DTSTART:${toICSDate(booking.startUtc)}`,
    `DTEND:${toICSDate(booking.endUtc)}`,
    `SUMMARY:${escapeText(`${user.eventTitle} — ${user.name} & ${booking.guestName}`)}`,
    `DESCRIPTION:${escapeText(
      [user.eventDescription, booking.guestNotes && `Notes: ${booking.guestNotes}`]
        .filter(Boolean)
        .join("\n\n"),
    )}`,
    `LOCATION:${escapeText(booking.googleMeetUrl ?? user.eventLocation)}`,
    `ORGANIZER;CN=${escapeText(user.name)}:mailto:${user.googleEmail ?? user.email}`,
    `ATTENDEE;CN=${escapeText(booking.guestName)};RSVP=TRUE:mailto:${booking.guestEmail}`,
    booking.status === "CANCELLED" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}
