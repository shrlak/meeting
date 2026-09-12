import Link from "next/link";

import TopBar from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth";
import { APP_URL } from "@/lib/env";

export default async function HomePage() {
  const user = await getCurrentUser();
  const host = APP_URL.replace(/^https?:\/\//, "");

  return (
    <>
      <TopBar user={user} />

      <main className="page">
        <section className="hero">
          <h1>One link. No back-and-forth.</h1>
          <p>
            Publish your availability, share <code>{host}/your-name</code>, and let people pick a
            time. Every booking lands on your Google Calendar with an invite sent to both sides.
          </p>
          <div className="row" style={{ justifyContent: "center" }}>
            {user ? (
              <Link className="btn" href="/dashboard">
                Go to your dashboard
              </Link>
            ) : (
              <>
                <Link className="btn" href="/signup">
                  Create your booking page
                </Link>
                <Link className="btn btn-secondary" href="/login">
                  Log in
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="feature-grid">
          <article className="card">
            <h3>Weekly hours</h3>
            <p className="muted">
              Set the hours you are normally free, day by day. Add as many blocks per day as you
              need — mornings before lab, evenings after class.
            </p>
          </article>
          <article className="card">
            <h3>Month-by-month exceptions</h3>
            <p className="muted">
              Click any date on the calendar to block it off entirely or replace it with custom
              hours, without touching your weekly pattern.
            </p>
          </article>
          <article className="card">
            <h3>Google Calendar invites</h3>
            <p className="muted">
              Connect your Google account once. Each booking creates a calendar event with a Meet
              link and emails the invite to you and your guest.
            </p>
          </article>
          <article className="card">
            <h3>No double bookings</h3>
            <p className="muted">
              Booked slots disappear immediately, and anything already on your Google Calendar is
              treated as busy time.
            </p>
          </article>
        </section>
      </main>
    </>
  );
}
