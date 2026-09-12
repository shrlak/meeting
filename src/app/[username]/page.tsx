import type { Metadata } from "next";
import { notFound } from "next/navigation";

import BookingWidget from "@/app/[username]/BookingWidget";
import TopBar from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Props = { params: Promise<{ username: string }> };

async function findHost(username: string) {
  return prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      name: true,
      username: true,
      timezone: true,
      eventTitle: true,
      eventDescription: true,
      eventLocation: true,
      durationMinutes: true,
      maxDaysAhead: true,
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const host = await findHost(username);
  if (!host) return { title: "Page not found" };

  return {
    title: `Book ${host.eventTitle} with ${host.name}`,
    description: host.eventDescription || `Schedule time with ${host.name}.`,
  };
}

export default async function PublicBookingPage({ params }: Props) {
  const { username } = await params;
  const host = await findHost(username);
  if (!host) notFound();

  const viewer = await getCurrentUser();

  return (
    <>
      <TopBar user={viewer} />
      <main className="page">
        <BookingWidget host={host} />
      </main>
    </>
  );
}
