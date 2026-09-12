"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { UserSettings } from "@/app/dashboard/types";
import { listTimezones } from "@/lib/time";

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];
const INCREMENTS = [5, 10, 15, 20, 30, 60];
const NOTICE_OPTIONS = [
  { value: 0, label: "No minimum" },
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
];

export default function MeetingSettings({
  initial,
  baseUrl,
}: {
  initial: UserSettings;
  baseUrl: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<UserSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: string; text: string } | null>(null);

  function set<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage({ tone: "alert-error", text: data.error ?? "Could not save your settings." });
        return;
      }

      setMessage({ tone: "alert-success", text: "Settings saved." });
      router.refresh();
    } catch {
      setMessage({ tone: "alert-error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const host = baseUrl.replace(/^https?:\/\//, "");

  return (
    <form className="card" onSubmit={save}>
      <div className="card-header row-between">
        <div>
          <h2>Meeting settings</h2>
          <p>What guests see, how long meetings run, and how far ahead they can book.</p>
        </div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>

      {message && <div className={`alert ${message.tone}`}>{message.text}</div>}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="set-name">Your name</label>
          <input
            id="set-name"
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="set-username">Booking link</label>
          <div className="input-prefix">
            <span>{host}/</span>
            <input
              id="set-username"
              type="text"
              value={form.username}
              onChange={(e) => set("username", e.target.value.toLowerCase())}
              spellCheck={false}
              required
            />
          </div>
          <p className="field-hint">Changing this breaks any link you have already shared.</p>
        </div>
      </div>

      <div className="field">
        <label htmlFor="set-title">Meeting title</label>
        <input
          id="set-title"
          type="text"
          value={form.eventTitle}
          onChange={(e) => set("eventTitle", e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="set-description">Description</label>
        <textarea
          id="set-description"
          value={form.eventDescription}
          onChange={(e) => set("eventDescription", e.target.value)}
          placeholder="What should people know before booking?"
        />
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="set-location">Location</label>
          <input
            id="set-location"
            type="text"
            value={form.eventLocation}
            onChange={(e) => set("eventLocation", e.target.value)}
            placeholder="Google Meet"
          />
          <p className="field-hint">
            Mentioning “Meet” adds a Google Meet link to every calendar invite.
          </p>
        </div>

        <div className="field">
          <label htmlFor="set-timezone">Your timezone</label>
          <select
            id="set-timezone"
            value={form.timezone}
            onChange={(e) => set("timezone", e.target.value)}
          >
            {[...new Set([form.timezone, ...listTimezones()])].map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <p className="field-hint">Your weekly hours are interpreted in this timezone.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="set-duration">Meeting length</label>
          <select
            id="set-duration"
            value={form.durationMinutes}
            onChange={(e) => set("durationMinutes", Number(e.target.value))}
          >
            {[...new Set([form.durationMinutes, ...DURATIONS])]
              .sort((a, b) => a - b)
              .map((value) => (
                <option key={value} value={value}>
                  {value} minutes
                </option>
              ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="set-increment">Start times every</label>
          <select
            id="set-increment"
            value={form.slotIntervalMins}
            onChange={(e) => set("slotIntervalMins", Number(e.target.value))}
          >
            {[...new Set([form.slotIntervalMins, ...INCREMENTS])]
              .sort((a, b) => a - b)
              .map((value) => (
                <option key={value} value={value}>
                  {value} minutes
                </option>
              ))}
          </select>
          <p className="field-hint">e.g. 30 gives 9:00, 9:30, 10:00 …</p>
        </div>

        <div className="field">
          <label htmlFor="set-buffer">Buffer between meetings</label>
          <select
            id="set-buffer"
            value={form.bufferMinutes}
            onChange={(e) => set("bufferMinutes", Number(e.target.value))}
          >
            {[0, 5, 10, 15, 30, 60].map((value) => (
              <option key={value} value={value}>
                {value === 0 ? "None" : `${value} minutes`}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="set-notice">Minimum notice</label>
          <select
            id="set-notice"
            value={form.minNoticeMinutes}
            onChange={(e) => set("minNoticeMinutes", Number(e.target.value))}
          >
            {NOTICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="set-horizon">Bookable up to</label>
          <select
            id="set-horizon"
            value={form.maxDaysAhead}
            onChange={(e) => set("maxDaysAhead", Number(e.target.value))}
          >
            {[7, 14, 30, 60, 90, 180, 365].map((value) => (
              <option key={value} value={value}>
                {value} days ahead
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  );
}
