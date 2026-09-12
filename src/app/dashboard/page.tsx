import { redirect } from "next/navigation";

import DashboardTabs from "@/app/dashboard/DashboardTabs";
import GoogleCard from "@/app/dashboard/GoogleCard";
import ShareLink from "@/app/dashboard/ShareLink";
import TopBar from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { APP_URL, googleConfigured } from "@/lib/env";

export const metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<{ google?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { google: googleStatus } = await searchParams;

  const [rules, overrides] = await Promise.all([
    prisma.availabilityRule.findMany({
      where: { userId: user.id },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    }),
    prisma.dateOverride.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
    }),
  ]);

  return (
    <>
      <TopBar user={user} />
      <main className="page">
        <div className="row-between" style={{ marginBottom: 20 }}>
          <div>
            <h1 style={{ marginBottom: 2 }}>Hi, {user.name.split(" ")[0]}</h1>
            <p className="muted" style={{ margin: 0 }}>
              Manage when people can book you, and see who is on the calendar.
            </p>
          </div>
          <ShareLink url={`${APP_URL}/${user.username}`} />
        </div>

        <GoogleCard
          connected={Boolean(user.googleRefreshToken)}
          googleEmail={user.googleEmail}
          configured={googleConfigured}
          status={googleStatus ?? null}
        />

        <DashboardTabs
          user={{
            name: user.name,
            username: user.username,
            timezone: user.timezone,
            eventTitle: user.eventTitle,
            eventDescription: user.eventDescription,
            eventLocation: user.eventLocation,
            durationMinutes: user.durationMinutes,
            bufferMinutes: user.bufferMinutes,
            slotIntervalMins: user.slotIntervalMins,
            minNoticeMinutes: user.minNoticeMinutes,
            maxDaysAhead: user.maxDaysAhead,
          }}
          initialRules={rules.map((rule) => ({
            weekday: rule.weekday,
            startMinute: rule.startMinute,
            endMinute: rule.endMinute,
          }))}
          initialOverrides={overrides.map((override) => ({
            date: override.date,
            blocked: override.blocked,
            intervals: override.intervals,
          }))}
          baseUrl={APP_URL}
        />
      </main>
    </>
  );
}
