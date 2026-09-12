import { NextResponse } from "next/server";

import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Forgets the host's Google Calendar tokens. Existing bookings are kept. */
export const POST = route(async () => {
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      googleEmail: null,
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
    },
  });

  return NextResponse.json({ ok: true });
});
