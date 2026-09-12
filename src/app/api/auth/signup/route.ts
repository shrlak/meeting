import { NextResponse } from "next/server";

import { jsonError, readJson, route } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { signupSchema } from "@/lib/validation";

/** Default weekly hours for a brand new account: weekdays, 9am–5pm. */
const DEFAULT_RULES = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
}));

export const POST = route(async (request: Request) => {
  const input = signupSchema.parse(await readJson(request));

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
    select: { email: true, username: true },
  });

  if (existing?.email === input.email) {
    return jsonError("An account with that email already exists.", 409);
  }
  if (existing) {
    return jsonError("That username is already taken.", 409);
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      username: input.username,
      passwordHash: await hashPassword(input.password),
      timezone: input.timezone ?? "America/New_York",
      eventTitle: "30 Minute Meeting",
      eventDescription: `Book time with ${input.name}.`,
      availability: { create: DEFAULT_RULES },
    },
  });

  await createSession(user.id);

  return NextResponse.json({ ok: true, username: user.username }, { status: 201 });
});
