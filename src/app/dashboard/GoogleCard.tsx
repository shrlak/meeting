"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_MESSAGES: Record<string, { tone: string; text: string }> = {
  connected: { tone: "alert-success", text: "Google Calendar connected." },
  denied: { tone: "alert-warning", text: "Google access was declined, so nothing was connected." },
  error: {
    tone: "alert-error",
    text: "Something went wrong talking to Google. Please try connecting again.",
  },
  unconfigured: {
    tone: "alert-warning",
    text: "This deployment has no Google OAuth credentials configured yet.",
  },
};

export default function GoogleCard({
  connected,
  googleEmail,
  configured,
  status,
}: {
  connected: boolean;
  googleEmail: string | null;
  configured: boolean;
  status: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const message = status ? STATUS_MESSAGES[status] : undefined;

  async function disconnect() {
    if (!window.confirm("Disconnect Google Calendar? New bookings will stop sending invites.")) {
      return;
    }
    setBusy(true);
    await fetch("/api/google/disconnect", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      {message && <div className={`alert ${message.tone}`}>{message.text}</div>}

      <div className="row-between">
        <div>
          <h2 style={{ marginBottom: 4, fontSize: "1.05rem" }}>
            Google Calendar{" "}
            {connected ? (
              <span className="badge badge-success">Connected</span>
            ) : (
              <span className="badge">Not connected</span>
            )}
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            {connected
              ? `Bookings are added to ${googleEmail ?? "your calendar"} and invites are emailed to you and your guest. Events already on your calendar block those times automatically.`
              : "Connect your Google account so every booking creates a calendar event with a Meet link and emails the invite to both sides."}
          </p>
        </div>

        <div className="row">
          {connected ? (
            <>
              <a className="btn btn-secondary btn-sm" href="/api/google/connect">
                Reconnect
              </a>
              <button className="btn btn-danger btn-sm" onClick={disconnect} disabled={busy}>
                Disconnect
              </button>
            </>
          ) : (
            <a
              className="btn btn-sm"
              href="/api/google/connect"
              aria-disabled={!configured}
              title={configured ? undefined : "Google OAuth credentials are not configured."}
            >
              Connect Google Calendar
            </a>
          )}
        </div>
      </div>

      {!configured && !connected && (
        <p className="faint" style={{ marginTop: 12, marginBottom: 0 }}>
          Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in your
          environment to enable this. Bookings still work without it — guests get a downloadable
          calendar file instead.
        </p>
      )}
    </div>
  );
}
