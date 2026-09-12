import { google } from "googleapis";
import type { Credentials, OAuth2Client } from "google-auth-library";
import type { Booking, User } from "@prisma/client";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/db";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  googleConfigured,
} from "@/lib/env";
import type { BusySpan } from "@/lib/availability";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export function buildConsentUrl(state: string): string {
  return createOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<{
  tokens: Credentials;
  email: string | null;
}> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  let email: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const profile = await oauth2.userinfo.get();
    email = profile.data.email ?? null;
  } catch {
    // Email is a nice-to-have label only.
  }

  return { tokens, email };
}

/**
 * An authorised client for the host, or null when they have not connected
 * Google Calendar. Refreshed tokens are written back to the database.
 */
function authorizedClient(user: User): OAuth2Client | null {
  if (!googleConfigured || !user.googleRefreshToken) return null;

  const client = createOAuthClient();
  client.setCredentials({
    access_token: user.googleAccessToken ?? undefined,
    refresh_token: user.googleRefreshToken,
    expiry_date: user.googleTokenExpiry ? user.googleTokenExpiry.getTime() : undefined,
  });

  client.on("tokens", (tokens) => {
    void prisma.user
      .update({
        where: { id: user.id },
        data: {
          googleAccessToken: tokens.access_token ?? user.googleAccessToken,
          googleRefreshToken: tokens.refresh_token ?? user.googleRefreshToken,
          googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        },
      })
      .catch(() => {
        /* refreshing again next request is cheap; don't break the booking */
      });
  });

  return client;
}

export function isGoogleConnected(user: User): boolean {
  return googleConfigured && Boolean(user.googleRefreshToken);
}

/** Busy spans from the host's Google Calendar. Returns [] when unavailable. */
export async function fetchGoogleBusy(
  user: User,
  fromUtcISO: string,
  toUtcISO: string,
): Promise<BusySpan[]> {
  const auth = authorizedClient(user);
  if (!auth) return [];

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: fromUtcISO,
        timeMax: toUtcISO,
        timeZone: "UTC",
        items: [{ id: user.googleCalendarId || "primary" }],
      },
    });

    const calendars = response.data.calendars ?? {};
    const spans: BusySpan[] = [];
    for (const entry of Object.values(calendars)) {
      for (const period of entry.busy ?? []) {
        if (!period.start || !period.end) continue;
        spans.push({
          start: new Date(period.start).getTime(),
          end: new Date(period.end).getTime(),
        });
      }
    }
    return spans;
  } catch (error) {
    console.error("[google] free/busy lookup failed:", error);
    // Degrade gracefully: local bookings still block their slots.
    return [];
  }
}

export type CalendarSyncResult =
  | { status: "SENT"; eventId: string; meetUrl: string | null }
  | { status: "SKIPPED" }
  | { status: "FAILED"; message: string };

/**
 * Creates the meeting on the host's Google Calendar with the guest as an
 * attendee. Google emails the invitation to both sides (`sendUpdates: "all"`).
 */
export async function createCalendarInvite(
  user: User,
  booking: Booking,
): Promise<CalendarSyncResult> {
  const auth = authorizedClient(user);
  if (!auth) return { status: "SKIPPED" };

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const wantsMeet = /meet/i.test(user.eventLocation);

    const response = await calendar.events.insert({
      calendarId: user.googleCalendarId || "primary",
      sendUpdates: "all",
      conferenceDataVersion: wantsMeet ? 1 : 0,
      requestBody: {
        summary: `${user.eventTitle} — ${user.name} & ${booking.guestName}`,
        description: [
          user.eventDescription,
          booking.guestNotes && `Notes from ${booking.guestName}:\n${booking.guestNotes}`,
          `Booked via ${user.username}'s meeting page.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
        location: wantsMeet ? undefined : user.eventLocation || undefined,
        start: { dateTime: booking.startUtc.toISOString(), timeZone: "UTC" },
        end: { dateTime: booking.endUtc.toISOString(), timeZone: "UTC" },
        attendees: [
          { email: user.googleEmail ?? user.email, organizer: true, responseStatus: "accepted" },
          { email: booking.guestEmail, displayName: booking.guestName },
        ],
        guestsCanModify: false,
        reminders: { useDefault: true },
        conferenceData: wantsMeet
          ? {
              createRequest: {
                requestId: `meeting-${booking.id}-${randomUUID()}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            }
          : undefined,
      },
    });

    const eventId = response.data.id;
    if (!eventId) return { status: "FAILED", message: "Google did not return an event id." };

    return {
      status: "SENT",
      eventId,
      meetUrl: response.data.hangoutLink ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Google Calendar error";
    console.error("[google] event creation failed:", error);
    return { status: "FAILED", message };
  }
}

/** Cancels the calendar event and notifies attendees. */
export async function cancelCalendarInvite(user: User, eventId: string): Promise<boolean> {
  const auth = authorizedClient(user);
  if (!auth) return false;

  try {
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.delete({
      calendarId: user.googleCalendarId || "primary",
      eventId,
      sendUpdates: "all",
    });
    return true;
  } catch (error) {
    console.error("[google] event cancellation failed:", error);
    return false;
  }
}
