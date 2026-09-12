import { NextResponse } from "next/server";

import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** The signed-in host's bookings, newest meeting first for past ones. */
export const GET = route(async (request: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "upcoming";
  const now = new Date();

  const bookings = await prisma.booking.findMany({
    where: {
      userId: user.id,
      ...(scope === "past"
        ? { endUtc: { lt: now } }
        : scope === "all"
          ? {}
          : { endUtc: { gte: now }, status: "CONFIRMED" }),
    },
    orderBy: { startUtc: scope === "past" ? "desc" : "asc" },
    take: 200,
  });

  return NextResponse.json({ bookings });
});
