"use client";

import { useCallback, useEffect, useState } from "react";

import { formatSlotRange } from "@/lib/time";

type Booking = {
  id: string;
  guestName: string;
  guestEmail: string;
  guestNotes: string;
  startUtc: string;
  endUtc: string;
  status: string;
  calendarSync: string;
  googleMeetUrl: string | null;
};

const SCOPES = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
] as const;

export default function BookingsList({ hostTimezone }: { hostTimezone: string }) {
  const [scope, setScope] = useState<(typeof SCOPES)[number]["id"]>("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings?scope=${scope}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not load your bookings.");
        return;
      }
      setBookings(data.bookings ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(booking: Booking) {
    if (!window.confirm(`Cancel the meeting with ${booking.guestName}?`)) return;
    const response = await fetch(`/api/bookings/${booking.id}/cancel`, { method: "POST" });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Could not cancel that booking.");
      return;
    }
    void load();
  }

  return (
    <div className="card">
      <div className="card-header row-between">
        <div>
          <h2>Bookings</h2>
          <p>Times are shown in {hostTimezone.replace(/_/g, " ")}.</p>
        </div>
        <div className="row">
          {SCOPES.map((entry) => (
            <button
              key={entry.id}
              className={`btn btn-sm ${scope === entry.id ? "" : "btn-secondary"}`}
              onClick={() => setScope(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="empty">
          <span className="spinner" /> Loading…
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty">Nothing here yet. Share your link to get your first booking.</div>
      ) : (
        <div className="list">
          {bookings.map((booking) => {
            const cancelled = booking.status === "CANCELLED";
            return (
              <div
                className={`list-item ${cancelled ? "list-item-cancelled" : ""}`}
                key={booking.id}
              >
                <div style={{ minWidth: 0 }}>
                  <strong>{formatSlotRange(booking.startUtc, booking.endUtc, hostTimezone)}</strong>
                  <div className="faint">
                    {booking.guestName} · {booking.guestEmail}
                  </div>
                  {booking.guestNotes && (
                    <div className="faint" style={{ whiteSpace: "pre-wrap" }}>
                      “{booking.guestNotes}”
                    </div>
                  )}
                </div>

                <div className="row">
                  {cancelled ? (
                    <span className="badge badge-danger">Cancelled</span>
                  ) : booking.calendarSync === "SENT" ? (
                    <span className="badge badge-success">Invite sent</span>
                  ) : booking.calendarSync === "SKIPPED" ? (
                    <span className="badge">No calendar</span>
                  ) : (
                    <span className="badge badge-warning">Invite failed</span>
                  )}

                  {booking.googleMeetUrl && (
                    <a
                      className="btn btn-ghost btn-sm"
                      href={booking.googleMeetUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Meet ↗
                    </a>
                  )}

                  {!cancelled && (
                    <button className="btn btn-danger btn-sm" onClick={() => cancel(booking)}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
