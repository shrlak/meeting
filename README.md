# Meeting

A self-hosted scheduling app in the spirit of Calendly, wired straight into Google Calendar.

Each person signs up with an email and password, picks a username, and gets their own public
booking page at `your-domain.com/<username>`. Guests pick a time, enter their name and email, and
the booking immediately:

1. creates an event on the host's Google Calendar (with a Google Meet link),
2. emails a calendar invite to **both** the host and the guest, and
3. disappears from the booking page so nobody can take the same slot twice.

Hosts control availability two ways: **weekly hours** that repeat every week, and a **month
calendar** where any single date can be blocked off or given its own hours.

---

## Screens

| Page | What it does |
| --- | --- |
| `/` | Landing page |
| `/signup`, `/login` | Email + password accounts |
| `/dashboard` | Weekly hours, per-date exceptions, bookings, meeting settings, Google connection |
| `/<username>` | The public booking page you share |
| `/booking/<id>` | Confirmation page with a Meet link, `.ics` download, and cancel button |

---

## Quick start

```bash
git clone https://github.com/shrlak/meeting.git
cd meeting
npm install

cp .env.example .env          # then edit it (see below)
npx prisma db push            # creates the SQLite database

npm run dev                   # http://localhost:3000
```

Sign up, set your weekly hours, then open `http://localhost:3000/<your-username>` in a private
window to see what guests see.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | `file:./dev.db` for SQLite, or a Postgres connection string |
| `APP_URL` | yes | Public base URL, no trailing slash. Used for booking links and the OAuth redirect |
| `SESSION_SECRET` | yes in production | Signs the login cookie. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GOOGLE_CLIENT_ID` | optional | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | optional | Google OAuth client secret |

Without the Google variables the app still works end to end — bookings are stored and slots are
blocked — but no invite email goes out. The confirmation page offers a downloadable `.ics` file
instead, and the dashboard shows the booking as "No calendar".

---

## Connecting Google Calendar

1. In the [Google Cloud Console](https://console.cloud.google.com/), create (or pick) a project.
2. **APIs & Services → Library →** enable the **Google Calendar API**.
3. **APIs & Services → OAuth consent screen →** configure it. While the app is in *Testing*, add
   every host's Google account under **Test users**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorised redirect URI: `{APP_URL}/api/google/callback`
     (e.g. `http://localhost:3000/api/google/callback`)
5. Copy the client ID and secret into `.env`, restart the server.
6. In the dashboard, click **Connect Google Calendar** and grant access.

Once connected:

- every booking creates an event on the host's primary calendar with the guest as an attendee, and
  Google sends the invitation emails (`sendUpdates: "all"`);
- a Google Meet link is attached whenever the meeting location mentions "Meet";
- anything already on the host's calendar is treated as busy, so the booking page never offers a
  time the host is not actually free;
- cancelling from the dashboard (or from the guest's confirmation link) deletes the event and
  notifies both sides.

Tokens are refreshed automatically and the new ones are written back to the database.

---

## How availability is decided

For any date, the open slots are:

```
weekly hours for that weekday
  ─ replaced entirely by a date override, if one exists for that date
  ─ sliced into slots of `durationMinutes`, starting every `slotIntervalMins`
  ─ minus existing confirmed bookings, padded by `bufferMinutes` on each side
  ─ minus busy time from the host's Google Calendar
  ─ minus anything sooner than `minNoticeMinutes` from now
  ─ minus anything past `maxDaysAhead`
```

Everything is stored in UTC and rendered in whichever timezone the viewer picks; the host's weekly
hours are interpreted in the host's own timezone, and slot math is done with Luxon so DST changes
keep their local clock time.

Two guests submitting the same slot at the same moment cannot both win: the booking row holds the
slot in a unique `(userId, activeSlot)` index, so the loser gets "Someone just booked that time."
Cancelling clears that column and releases the slot again.

---

## Project layout

```
prisma/schema.prisma          Users, weekly rules, date overrides, bookings
src/lib/availability.ts       Pure slot-generation logic (unit tested)
src/lib/scheduling.ts         Loads rules + bookings + Google busy time for a date window
src/lib/google.ts             OAuth, free/busy, event create + cancel
src/lib/auth.ts               Password hashing, JWT session cookie
src/app/api/…                 REST endpoints
src/app/[username]/           Public booking page
src/app/dashboard/            Host dashboard
```

### Commands

```bash
npm run dev         # development server
npm run build       # production build
npm start           # run the production build
npm test            # unit tests for the scheduling logic
npm run typecheck   # tsc --noEmit
npm run db:studio   # browse the database
```

---

## Deploying

This app needs a **Node.js server** — it signs in users, talks to the Google Calendar API, and
writes to a database, none of which a static host can do. GitHub Pages will not run it. Vercel,
Render, Railway, Fly.io, or any VPS will.

On Vercel (or similar):

1. Push this repository and import it.
2. Set `DATABASE_URL`, `APP_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
3. Serverless hosts have an ephemeral filesystem, so use Postgres rather than SQLite: change
   `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma` and point
   `DATABASE_URL` at your database (Neon, Supabase, RDS — anything Postgres).
4. Run `npx prisma db push` against the production database once.
5. Add `{APP_URL}/api/google/callback` to the OAuth client's authorised redirect URIs.

`{APP_URL}/<username>` is then the link each host shares.

---

## Security notes

- Passwords are hashed with bcrypt (cost 12); the login endpoint compares against a dummy hash for
  unknown emails so response timing doesn't leak which addresses have accounts.
- Sessions are stateless JWTs in an `httpOnly`, `sameSite=lax` cookie, marked `secure` in
  production.
- The Google OAuth `state` parameter is a short-lived signed token, so the callback can't be
  replayed against another account.
- Booking and cancel links are unguessable ids/tokens — anyone holding the confirmation link can
  cancel that meeting, which is what lets guests cancel without an account.
- Google refresh tokens are stored in the database in plain text. If you run this for more than
  yourself, put it behind encryption at rest.
