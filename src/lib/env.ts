/** Centralised access to runtime configuration. */

/**
 * Public base URL of this deployment, used for booking links and the Google
 * OAuth redirect.
 *
 * VERCEL_PROJECT_PRODUCTION_URL is the project's stable production domain, so
 * a Vercel deploy works before APP_URL is set. Deployment-specific URLs
 * (VERCEL_URL) are deliberately not used: they change on every push and would
 * never match the redirect URI registered with Google.
 */
function resolveAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

export const APP_URL = resolveAppUrl().replace(/\/+$/, "");

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
