import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { UnauthorizedError } from "@/lib/auth";
import { firstIssue } from "@/lib/validation";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Wraps a route handler so validation and auth failures become clean JSON
 * instead of a 500 with a stack trace.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ZodError) return jsonError(firstIssue(error), 422);
      if (error instanceof UnauthorizedError) return jsonError(error.message, 401);
      console.error("[api] unhandled error:", error);
      return jsonError("Something went wrong. Please try again.", 500);
    }
  };
}

/** Parses a JSON request body, tolerating an empty one. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
