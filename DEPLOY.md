# Deploying

This app needs a **Node.js server** — it signs users in, writes to a database, and calls the
Google Calendar API. GitHub Pages cannot run it. Vercel, Render, Railway, Fly.io, or any VPS can.

The walkthrough below uses **Vercel + Postgres**, which is free for a project this size. There is a
Render alternative at the end.

Total time: about 20 minutes, most of it waiting on Google's consent screen form.

---

## 1. Create the database

Serverless platforms wipe the filesystem between requests, so SQLite cannot be used in production.
Any hosted Postgres works — [Neon](https://neon.tech), [Supabase](https://supabase.com), or
Vercel's own Postgres (which is Neon underneath).

You need **two** connection strings from your provider:

| | Used for | Looks like |
| --- | --- | --- |
| **Pooled** | the running app | `...-pooler.region.neon.tech/...` or Supabase port `6543` |
| **Direct** | creating the tables, once | the plain host, Supabase port `5432` |

Serverless functions open and close connections constantly, which exhausts a plain Postgres
connection limit — that is what the pooled URL is for. Schema changes need the direct one.

### Create the tables

From your local clone, once:

```bash
DATABASE_PROVIDER=postgresql \
DATABASE_URL="<your DIRECT connection string>" \
npx prisma db push
```

You should see `Your database is now in sync with your Prisma schema`. Re-run this after any future
change to `prisma/schema.prisma`.

> `DATABASE_PROVIDER` rewrites the provider line in `prisma/schema.prisma` for you (see
> `scripts/set-db-provider.mjs`); you never have to hand-edit the schema. Leave it unset locally and
> you are back on SQLite.

---

## 2. Deploy to Vercel

1. Sign in at [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New → Project →** import `shrlak/meeting`. Next.js is detected automatically; leave the
   build and output settings alone.
3. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | your **pooled** connection string |
   | `DATABASE_PROVIDER` | `postgresql` |
   | `SESSION_SECRET` | see below |
   | `GOOGLE_CLIENT_ID` | from step 3 (add it after, if you prefer) |
   | `GOOGLE_CLIENT_SECRET` | from step 3 |

   Generate the session secret locally and paste the output:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   This signs login cookies. Keep it secret, and don't change it later unless you want to log
   everyone out.

4. **Deploy.** You'll get a URL like `https://meeting-xyz.vercel.app`.
5. Add one more environment variable, now that you know the domain, and redeploy:

   | Name | Value |
   | --- | --- |
   | `APP_URL` | `https://meeting-xyz.vercel.app` (no trailing slash) |

   The app falls back to Vercel's production domain if you skip this, but set it explicitly —
   especially once you add a custom domain, because Google matches the OAuth redirect URI exactly.

Your booking pages are now live at `https://meeting-xyz.vercel.app/<username>`.

---

## 3. Set up Google OAuth credentials

This is what makes calendar invites actually send. Everything happens in the
[Google Cloud Console](https://console.cloud.google.com/).

### 3a. Project and API

1. Top-left project dropdown → **New Project** → name it something like `meeting-app` → **Create**.
   (An existing project is fine too.)
2. Make sure the new project is selected in that dropdown.
3. **APIs & Services → Library →** search **Google Calendar API** → **Enable**.

### 3b. OAuth consent screen

**APIs & Services → OAuth consent screen**

1. **User type: External** → Create.
   (*Internal* only exists if you're inside a Google Workspace organisation. A `@andrew.cmu.edu`
   account may offer it — Internal is simpler, since it skips test users and verification entirely,
   but then only people in that organisation can connect.)
2. **App information:** app name (e.g. `Meeting`), your email as user support email, your email
   again at the bottom as developer contact. Everything else can stay blank.
3. **Scopes →** *Add or remove scopes*. Search for and tick:

   | Scope | Why the app needs it |
   | --- | --- |
   | `.../auth/calendar.events` | create and cancel the meeting events |
   | `.../auth/calendar.readonly` | read your busy times so it never offers a slot you're not free |
   | `.../auth/userinfo.email` | label which Google account is connected |

   `calendar.events` and `calendar.readonly` are *sensitive* scopes — that matters in step 3d.
4. **Test users →** *Add users* → add **every Google account that will host meetings**, including
   your own. Accounts not on this list get "access blocked" when they try to connect.
5. Save.

### 3c. Create the client ID

**APIs & Services → Credentials → Create credentials → OAuth client ID**

1. **Application type: Web application.** Name it anything.
2. **Authorised redirect URIs → Add URI.** Add both of these, exactly:

   ```
   https://meeting-xyz.vercel.app/api/google/callback
   http://localhost:3000/api/google/callback
   ```

   Substitute your real Vercel domain. The path is `/api/google/callback`. This must match
   `APP_URL` character for character — no trailing slash, `https` not `http` in production, and if
   you later add a custom domain, add that URI too.

   (*Authorised JavaScript origins* can stay empty; this app does the OAuth handshake server-side.)
3. **Create.** Copy the **Client ID** and **Client secret**.
4. Paste them into Vercel as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then **redeploy** —
   environment variable changes only take effect on a new deployment.
5. For local development, put the same two values in your `.env`.

### 3d. Publishing status — read this one

While the app is in **Testing** (the default):

- only the test users you listed can connect;
- **refresh tokens expire after 7 days**, so hosts have to click *Reconnect* on the dashboard about
  once a week. Bookings and availability are unaffected — only invite-sending stops until you
  reconnect;
- you'll see a **"Google hasn't verified this app"** warning when connecting. Click **Advanced → Go
  to Meeting (unsafe)**. It's your own app; this is expected.

Switching to **Production** (OAuth consent screen → *Publish app*) removes the 7-day expiry and the
test-user list. Because this app uses sensitive calendar scopes, Google asks for verification — a
review that wants a privacy policy URL, a demo video, and typically a few weeks.

**For personal use, stay in Testing and click Reconnect when it asks.** Only go through
verification if you're opening this up to strangers.

### 3e. Connect and confirm

1. Open `https://your-domain/dashboard` and click **Connect Google Calendar**.
2. Pick your account, click through the unverified-app warning, and grant calendar access.
3. The card should flip to **Connected** with your Gmail address.
4. Book a test meeting on your own page with a second email address. Within a few seconds both
   inboxes get a real Google Calendar invitation, and the event — with a Meet link — appears on your
   calendar.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Error 400: redirect_uri_mismatch` | The redirect URI doesn't exactly match | Compare `APP_URL` + `/api/google/callback` against the URI in Credentials. Watch for `http` vs `https` and trailing slashes |
| `Error 403: access_denied` | That Google account isn't a test user | Add it under OAuth consent screen → Test users |
| Dashboard says "not configured" | Env vars missing or not deployed | Set both Google variables in Vercel **and redeploy** |
| Bookings say "Invite failed" | Calendar API disabled, or the connection expired | Re-check the API is enabled; click Reconnect |
| Invites stop after about a week | Testing-mode refresh token expiry | Click Reconnect (see 3d) |
| `Can't reach database server` | Wrong or unpooled connection string | Use the **pooled** URL for `DATABASE_URL` |
| `The table \`main.User\` does not exist` | Tables were never created | Run the `prisma db push` from step 1 against the **direct** URL |
| Build fails on `SESSION_SECRET` | It isn't set in the host's environment | Add it, then redeploy |

---

## Alternative: Render

Render runs a persistent container, which means a persistent disk — so you can keep SQLite and skip
the database step entirely for a personal deployment.

1. **New → Web Service →** connect `shrlak/meeting`.
2. Build command `npm install && npm run build`, start command `npm start`.
3. Add a **Disk** mounted at `/data`.
4. Environment: `DATABASE_URL=file:/data/prod.db`, `SESSION_SECRET`, `APP_URL`, and the two Google
   variables. Leave `DATABASE_PROVIDER` unset.
5. After the first deploy, run `npx prisma db push` once from the Render shell.

Google OAuth setup is identical — just use your `onrender.com` URL in the redirect URI.

---

## Keeping it running

- **Deploys:** every push to `main` redeploys automatically. Pull requests get their own preview
  URL; OAuth won't work on preview URLs unless you add each one as a redirect URI, so test Google
  flows against production.
- **Schema changes:** re-run `prisma db push` against the direct URL after editing
  `prisma/schema.prisma`.
- **Backups:** your Postgres provider handles these — Neon and Supabase both keep point-in-time
  backups on the free tier.
- **Secrets:** Google refresh tokens are stored in the database in plain text. Fine for personal
  use; encrypt at rest before letting other people sign up.
