"use client";

import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import MonthCalendar from "@/components/MonthCalendar";
import { guessBrowserTimezone, listTimezones } from "@/lib/time";

export type PublicHost = {
  name: string;
  username: string;
  timezone: string;
  eventTitle: string;
  eventDescription: string;
  eventLocation: string;
  durationMinutes: number;
  maxDaysAhead: number;
};

type SlotResponse = {
  days?: Record<string, { startUtc: string; endUtc: string }[]>;
  error?: string;
};

export default function BookingWidget({ host }: { host: PublicHost }) {
  const router = useRouter();

  const [guestTz, setGuestTz] = useState(host.timezone);
  const [monthISO, setMonthISO] = useState(
    () => DateTime.now().setZone(host.timezone).startOf("month").toISODate() as string,
  );
  const [starts, setStarts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setGuestTz(guessBrowserTimezone());
  }, []);

  const todayInGuestTz = DateTime.now().setZone(guestTz).toISODate() as string;

  // Fetch a one-day margin around the month so slots that fall on a different
  // calendar day in the guest's timezone are still available to group.
  const loadMonth = useCallback(
    async (iso: string) => {
      setLoading(true);
      setLoadError(null);

      const month = DateTime.fromISO(iso).startOf("month");
      const from = month.minus({ days: 1 }).toISODate() as string;
      const to = month.endOf("month").plus({ days: 1 }).toISODate() as string;

      try {
        const response = await fetch(
          `/api/public/${encodeURIComponent(host.username)}/slots?from=${from}&to=${to}`,
          { cache: "no-store" },
        );
        const data: SlotResponse = await response.json();

        if (!response.ok) {
          setLoadError(data.error ?? "Could not load available times.");
          setStarts([]);
          return;
        }

        setStarts(
          Object.values(data.days ?? {})
            .flat()
            .map((slot) => slot.startUtc),
        );
      } catch {
        setLoadError("Could not reach the server. Please try again.");
        setStarts([]);
      } finally {
        setLoading(false);
      }
    },
    [host.username],
  );

  useEffect(() => {
    void loadMonth(monthISO);
  }, [monthISO, loadMonth]);

  /** Slot start times grouped by calendar day in the guest's timezone. */
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    for (const startUtc of starts) {
      const local = DateTime.fromISO(startUtc, { zone: "utc" }).setZone(guestTz);
      const key = local.toISODate() as string;
      (grouped[key] ??= []).push(startUtc);
    }
    for (const list of Object.values(grouped)) list.sort();
    return grouped;
  }, [starts, guestTz]);

  // Keep the selected day valid when the month or timezone changes.
  useEffect(() => {
    if (selectedDate && !slotsByDate[selectedDate]) {
      setSelectedDate(null);
      setSelectedSlot(null);
    }
  }, [slotsByDate, selectedDate]);

  const maxDate = DateTime.now()
    .setZone(host.timezone)
    .plus({ days: host.maxDaysAhead })
    .toISODate() as string;

  async function submitBooking(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedSlot) return;

    setSubmitError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`/api/public/${encodeURIComponent(host.username)}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUtc: selectedSlot,
          guestName,
          guestEmail,
          guestNotes,
          guestTz,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setSubmitError(data.error ?? "Could not book that time.");
        if (response.status === 409) {
          // Someone took the slot — refresh so it disappears from the list.
          setSelectedSlot(null);
          void loadMonth(monthISO);
        }
        return;
      }

      router.push(data.redirect as string);
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedSlotLabel = selectedSlot
    ? DateTime.fromISO(selectedSlot, { zone: "utc" })
        .setZone(guestTz)
        .toFormat("cccc, LLLL d, yyyy 'at' h:mm a")
    : null;

  return (
    <div className="booking-shell">
      <aside className="booking-aside">
        <p className="faint" style={{ margin: 0 }}>
          {host.name}
        </p>
        <h1 style={{ fontSize: "1.5rem", marginTop: 4 }}>{host.eventTitle}</h1>

        <ul className="meta-list">
          <li>
            <span className="meta-icon" aria-hidden>
              ⏱
            </span>
            {host.durationMinutes} minutes
          </li>
          {host.eventLocation && (
            <li>
              <span className="meta-icon" aria-hidden>
                📍
              </span>
              {host.eventLocation}
            </li>
          )}
          <li>
            <span className="meta-icon" aria-hidden>
              🌐
            </span>
            {guestTz.replace(/_/g, " ")}
          </li>
          {selectedSlotLabel && (
            <li>
              <span className="meta-icon" aria-hidden>
                📅
              </span>
              <strong>{selectedSlotLabel}</strong>
            </li>
          )}
        </ul>

        {host.eventDescription && (
          <p className="muted" style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>
            {host.eventDescription}
          </p>
        )}

        <div className="field" style={{ marginTop: 20 }}>
          <label htmlFor="guest-tz">Time zone</label>
          <select id="guest-tz" value={guestTz} onChange={(e) => setGuestTz(e.target.value)}>
            {[...new Set([guestTz, host.timezone, ...listTimezones()])].map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </aside>

      <section className="booking-main">
        {selectedSlot ? (
          <form onSubmit={submitBooking} noValidate>
            <div className="row-between" style={{ marginBottom: 14 }}>
              <h2 style={{ margin: 0 }}>Confirm your details</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedSlot(null)}
              >
                ‹ Pick another time
              </button>
            </div>

            {submitError && <div className="alert alert-error">{submitError}</div>}

            <div className="field">
              <label htmlFor="guest-name">Your name</label>
              <input
                id="guest-name"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="guest-email">Your email</label>
              <input
                id="guest-email"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <p className="field-hint">The calendar invite is sent here.</p>
            </div>

            <div className="field">
              <label htmlFor="guest-notes">What is this about? (optional)</label>
              <textarea
                id="guest-notes"
                value={guestNotes}
                onChange={(e) => setGuestNotes(e.target.value)}
              />
            </div>

            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "Booking…" : "Confirm booking"}
            </button>
          </form>
        ) : (
          <div className="grid-2" style={{ alignItems: "start" }}>
            <div>
              <h2 style={{ fontSize: "1.05rem" }}>Select a date</h2>
              <MonthCalendar
                monthISO={monthISO}
                onMonthChange={(iso) => {
                  setMonthISO(iso);
                  setSelectedDate(null);
                }}
                selected={selectedDate}
                onSelectDate={(iso) => setSelectedDate(iso)}
                dayState={(iso) => (slotsByDate[iso]?.length ? "available" : "unavailable")}
                minDate={todayInGuestTz}
                maxDate={maxDate}
                todayISO={todayInGuestTz}
                busy={loading}
              />
              {loadError && (
                <div className="alert alert-error" style={{ marginTop: 12 }}>
                  {loadError}
                </div>
              )}
            </div>

            <div>
              <h2 style={{ fontSize: "1.05rem" }}>
                {selectedDate
                  ? DateTime.fromISO(selectedDate).toFormat("cccc, LLLL d")
                  : "Available times"}
              </h2>

              {!selectedDate && (
                <p className="muted">
                  {loading
                    ? "Loading available days…"
                    : Object.keys(slotsByDate).length === 0
                      ? "No times are open this month. Try the next month."
                      : "Pick a highlighted day to see open times."}
                </p>
              )}

              {selectedDate && (
                <div className="slot-list">
                  {(slotsByDate[selectedDate] ?? []).map((startUtc) => (
                    <button
                      key={startUtc}
                      type="button"
                      className="slot"
                      aria-pressed={selectedSlot === startUtc}
                      onClick={() => setSelectedSlot(startUtc)}
                    >
                      {DateTime.fromISO(startUtc, { zone: "utc" })
                        .setZone(guestTz)
                        .toFormat("h:mm a")}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
