"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelBookingButton({
  bookingId,
  token,
}: {
  bookingId: string;
  token: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm("Cancel this meeting? Everyone invited will be notified.")) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/bookings/${bookingId}/cancel?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Could not cancel this booking.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-danger btn-sm" onClick={cancel} disabled={busy}>
        {busy ? "Cancelling…" : "Cancel meeting"}
      </button>
      {error && (
        <span className="alert alert-error" style={{ margin: 0 }}>
          {error}
        </span>
      )}
    </>
  );
}
