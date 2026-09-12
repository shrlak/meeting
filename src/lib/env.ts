/** Centralised access to runtime configuration. */

export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const FALLBACK_SECRET = "development-only-insecure-session-secret-change-me";

/**
 * Signing key for session cookies and OAuth state.
 *
 * Resolved per request rather than at module load: a build must not fail (or
 * silently bake in a default) just because the secret is only present in the
 * runtime environment.
 */
export function sessionSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production. See .env.example.");
    }
    return new TextEncoder().encode(FALLBACK_SECRET);
  }

  return new TextEncoder().encode(secret);
}

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

/** Google Calendar sync is only attempted when OAuth credentials are configured. */
export const googleConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

export const GOOGLE_REDIRECT_URI = `${APP_URL}/api/google/callback`;
