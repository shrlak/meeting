import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

import { route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { APP_URL, sessionSecretKey } from "@/lib/env";
import { exchangeCodeForTokens } from "@/lib/google";

/** OAuth redirect target — stores the host's Google Calendar tokens. */
export const GET = route(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) return NextResponse.redirect(`${APP_URL}/dashboard?google=denied`);
  if (!code || !state) return NextResponse.redirect(`${APP_URL}/dashboard?google=error`);

  let userId: string;
  try {
    const { payload } = await jwtVerify(state, sessionSecretKey());
    if (typeof payload.sub !== "string") throw new Error("bad state");
    userId = payload.sub;
  } catch {
    return NextResponse.redirect(`${APP_URL}/dashboard?google=error`);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  try {
    const { tokens, email } = await exchangeCodeForTokens(code);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleEmail: email,
        googleAccessToken: tokens.access_token ?? null,
        // Google only returns a refresh token on first consent; keep the old
        // one if this round didn't include a new one.
        googleRefreshToken: tokens.refresh_token ?? user.googleRefreshToken,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleCalendarId: user.googleCalendarId ?? "primary",
      },
    });

    return NextResponse.redirect(`${APP_URL}/dashboard?google=connected`);
  } catch (err) {
    console.error("[google] token exchange failed:", err);
    return NextResponse.redirect(`${APP_URL}/dashboard?google=error`);
  }
});
