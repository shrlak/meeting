import { NextResponse } from "next/server";

import { jsonError, readJson, route } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";

export const POST = route(async (request: Request) => {
  const input = loginSchema.parse(await readJson(request));

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Compare against a dummy hash when the user is missing so that response
  // timing doesn't reveal which emails have accounts.
  const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
  const valid = await verifyPassword(input.password, hash);

  if (!user || !valid) {
    return jsonError("Incorrect email or password.", 401);
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true, username: user.username });
});
