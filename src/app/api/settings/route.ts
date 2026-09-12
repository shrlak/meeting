import { NextResponse } from "next/server";

import { jsonError, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { settingsSchema } from "@/lib/validation";

export const PUT = route(async (request: Request) => {
  const user = await requireUser();
  const input = settingsSchema.parse(await readJson(request));

  if (input.username !== user.username) {
    const taken = await prisma.user.findUnique({
      where: { username: input.username },
      select: { id: true },
    });
    if (taken && taken.id !== user.id) {
      return jsonError("That username is already taken.", 409);
    }
  }

  if (input.slotIntervalMins > input.durationMinutes) {
    // Not fatal, but a start-time increment larger than the meeting itself
    // silently drops slots — flag it instead.
    return jsonError("Start-time increment cannot be longer than the meeting duration.", 422);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: input,
  });

  return NextResponse.json({ ok: true, username: updated.username });
});
