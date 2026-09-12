"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { RuleInput } from "@/app/dashboard/types";
import { WEEKDAY_LABELS, minutesToTimeInput, timeInputToMinutes } from "@/lib/time";

type Block = { start: string; end: string };
type WeekState = Record<number, Block[]>;

const DEFAULT_BLOCK: Block = { start: "09:00", end: "17:00" };

function toWeekState(rules: RuleInput[]): WeekState {
  const week: WeekState = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const rule of rules) {
    week[rule.weekday].push({
      start: minutesToTimeInput(rule.startMinute),
      end: minutesToTimeInput(rule.endMinute),
    });
  }
  return week;
}

export default function WeeklyEditor({
  initialRules,
  timezone,
}: {
  initialRules: RuleInput[];
  timezone: string;
}) {
  const router = useRouter();
  const [week, setWeek] = useState<WeekState>(() => toWeekState(initialRules));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: string; text: string } | null>(null);

  function update(weekday: number, blocks: Block[]) {
    setWeek((current) => ({ ...current, [weekday]: blocks }));
    setMessage(null);
  }

  function toggleDay(weekday: number, enabled: boolean) {
    update(weekday, enabled ? [{ ...DEFAULT_BLOCK }] : []);
  }

  function copyToWeekdays(weekday: number) {
    const source = week[weekday];
    setWeek((current) => {
      const next = { ...current };
      for (const day of [1, 2, 3, 4, 5]) {
        next[day] = source.map((block) => ({ ...block }));
      }
      return next;
    });
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);

    const rules: { weekday: number; start: number; end: number }[] = [];
    for (const [weekday, blocks] of Object.entries(week)) {
      for (const block of blocks) {
        const start = timeInputToMinutes(block.start);
        const end = timeInputToMinutes(block.end);
        if (start === null || end === null) {
          setSaving(false);
          setMessage({
            tone: "alert-error",
            text: `Check the times on ${WEEKDAY_LABELS[Number(weekday)]}.`,
          });
          return;
        }
        if (start >= end) {
          setSaving(false);
          setMessage({
            tone: "alert-error",
            text: `On ${WEEKDAY_LABELS[Number(weekday)]}, the end time must be after the start time.`,
          });
          return;
        }
        rules.push({ weekday: Number(weekday), start, end });
      }
    }

    try {
      const response = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage({ tone: "alert-error", text: data.error ?? "Could not save your hours." });
        return;
      }
      setMessage({ tone: "alert-success", text: "Weekly hours saved." });
      // Keeps the "Specific dates" calendar in step with the new weekly pattern.
      router.refresh();
    } catch {
      setMessage({ tone: "alert-error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header row-between">
        <div>
          <h2>Weekly hours</h2>
          <p>
            The hours you are normally free, in <strong>{timezone.replace(/_/g, " ")}</strong>. Add
            more than one block per day for split schedules.
          </p>
        </div>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save weekly hours"}
        </button>
      </div>

      {message && <div className={`alert ${message.tone}`}>{message.text}</div>}

      <div>
        {WEEKDAY_LABELS.map((label, weekday) => {
          const blocks = week[weekday];
          const enabled = blocks.length > 0;

          return (
            <div className="weekday-row" key={label}>
              <label className="weekday-toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => toggleDay(weekday, e.target.checked)}
                />
                {label}
              </label>

              <div>
                {!enabled && <span className="faint">Unavailable</span>}

                {blocks.map((block, index) => (
                  <div className="time-row" key={index}>
                    <input
                      type="time"
                      value={block.start}
                      step={300}
                      aria-label={`${label} start time ${index + 1}`}
                      onChange={(e) =>
                        update(
                          weekday,
                          blocks.map((b, i) => (i === index ? { ...b, start: e.target.value } : b)),
                        )
                      }
                    />
                    <span className="time-sep">to</span>
                    <input
                      type="time"
                      value={block.end}
                      step={300}
                      aria-label={`${label} end time ${index + 1}`}
                      onChange={(e) =>
                        update(
                          weekday,
                          blocks.map((b, i) => (i === index ? { ...b, end: e.target.value } : b)),
                        )
                      }
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        update(
                          weekday,
                          blocks.filter((_, i) => i !== index),
                        )
                      }
                      aria-label={`Remove block ${index + 1} on ${label}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <div className="row">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => update(weekday, [...blocks, { ...DEFAULT_BLOCK }])}
                  >
                    + Add block
                  </button>
                  {enabled && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => copyToWeekdays(weekday)}
                      title="Copy these hours to Monday–Friday"
                    >
                      Copy to weekdays
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
