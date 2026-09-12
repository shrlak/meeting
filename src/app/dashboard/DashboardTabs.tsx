"use client";

import { useState } from "react";

import BookingsList from "@/app/dashboard/BookingsList";
import DateOverrides from "@/app/dashboard/DateOverrides";
import MeetingSettings from "@/app/dashboard/MeetingSettings";
import WeeklyEditor from "@/app/dashboard/WeeklyEditor";
import type { OverrideInput, RuleInput, UserSettings } from "@/app/dashboard/types";

const TABS = [
  { id: "weekly", label: "Weekly hours" },
  { id: "dates", label: "Specific dates" },
  { id: "bookings", label: "Bookings" },
  { id: "settings", label: "Meeting settings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DashboardTabs({
  user,
  initialRules,
  initialOverrides,
  baseUrl,
}: {
  user: UserSettings;
  initialRules: RuleInput[];
  initialOverrides: OverrideInput[];
  baseUrl: string;
}) {
  const [tab, setTab] = useState<TabId>("weekly");

  return (
    <>
      <div className="tabs" role="tablist">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            role="tab"
            className="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "weekly" && <WeeklyEditor initialRules={initialRules} timezone={user.timezone} />}
      {tab === "dates" && (
        <DateOverrides
          initialOverrides={initialOverrides}
          rules={initialRules}
          timezone={user.timezone}
        />
      )}
      {tab === "bookings" && <BookingsList hostTimezone={user.timezone} />}
      {tab === "settings" && <MeetingSettings initial={user} baseUrl={baseUrl} />}
    </>
  );
}
