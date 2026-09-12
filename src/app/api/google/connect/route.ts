import { NextResponse } from "next/server";
import { SignJWT } from "jose";

import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { APP_URL, googleConfigured, sessionSecretKey } from "@/lib/env";
import { buildConsentUrl } from "@/lib/google";

/** Starts the Google Calendar OAuth flow for the signed-in host. */
export const GET = route(async () => {
  const user = await requireUser();

  if (!googleConfigured) {
    return NextResponse.redirect(`${APP_URL}/dashboard?google=unconfigured`);
  }

  // The state is a short-lived signed token, so the callback can trust which
  // account it belongs to and reject forged redirects.
  const state = await new SignJWT({ sub: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(sessionSecretKey());

  return NextResponse.redirect(buildConsentUrl(state));
});
