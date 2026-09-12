"use client";

import { DateTime } from "luxon";
import { useMemo, useState } from "react";

import type { OverrideInput, RuleInput } from "@/app/dashboard/types";
import MonthCalendar, { type DayState } from "@/components/MonthCalendar";
import { parseIntervals } from "@/lib/availability";
import {
  luxonWeekdayToIndex,
  minutesToLabel,
  minutesToTimeInput,
  timeInputToMinutes,
} from "@/lib/time";

type Block = { start: string; end: string };
type OverrideState = { blocked: boolean; blocks: Block[] };
type Mode = "weekly" | "blocked" | "custom";

function toOverrideMap(overrides: OverrideInput[]): Record<string, OverrideState> {
  const map: Record<string, OverrideState> = {};
  for (const override of overrides) {
    map[override.date] = {
      blocked: override.blocked,
      blocks: parseIntervals(override.intervals).map((interval) => ({
        start: minutesToTimeInput(interval.start),
        end: minutesToTimeInput(interval.end),
      })),
    };
  }
  return map;
}

export default function DateOverrides({
  initialOverrides,
  rules,
  timezone,
}: {
  initialOverrides: OverrideInput[];
  rules: RuleInput[];
  timezone: string;
}) {
  const today = DateTime.now().setZone(timezone).toISODate() as string;

  const [overrides, setOverrides] = useState(() => toOverrideMap(initialOverrides));
  const [monthISO, setMonthISO] = useState(
    () => DateTime.fromISO(today).startOf("month").toISODate() as string,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("weekly");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: string; text: string } | null>(null);

  const weeklyByDay = useMemo(() => {
    const map: Record<number, RuleInput[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const rule of rules) map[rule.weekday].push(rule);
    return map;
  }, [rules]);

  function weeklyHoursFor(dateISO: string): RuleInput[] {
    const weekday = luxonWeekdayToIndex(DateTime.fromISO(dateISO).weekday);
    return weeklyByDay[weekday] ?? [];
  }

  function dayState(dateISO: string): DayState {
    const override = overrides[dateISO];
    if (override) return override.blocked ? "blocked" : "custom";
    return weeklyHoursFor(dateISO).length > 0 ? "available" : "unavailable";
  }

  function openDate(dateISO: string) {
    setSelected(dateISO);
    setMessage(null);

    const override = overrides[dateISO];
    if (!override) {
      setMode("weekly");
      const weekly = weeklyHoursFor(dateISO);
      setBlocks(
        weekly.length > 0
          ? weekly.map((rule) => ({
              start: minutesToTimeInput(rule.startMinute),
              end: minutesToTimeInput(rule.endMinute),
            }))
          : [{ start: "09:00", end: "17:00" }],
      );
      return;
    }

    setMode(override.blocked ? "blocked" : "custom");
    setBlocks(
      override.blocks.length > 0 ? override.blocks : [{ start: "09:00", end: "17:00" }],
    );
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setMessage(null);

    try {
      if (mode === "weekly") {
        const response = await fetch(`/api/overrides?date=${selected}`, { method: "DELETE" });
        if (!response.ok) {
          const data = await response.json();
          setMessage({ tone: "alert-error", text: data.error ?? "Could not update that date." });
          return;
        }
        setOverrides((current) => {
          const next = { ...current };
          delete next[selected];
          return next;
        });
        setMessage({ tone: "alert-success", text: "Back to your weekly hours for that date." });
        return;
      }

      const intervals: { start: number; end: number }[] = [];
      if (mode === "custom") {
        for (const block of blocks) {
          const start = timeInputToMinutes(block.start);
          const end = timeInputToMinutes(block.end);
          if (start === null || end === null || start >= end) {
            setMessage({ tone: "alert-error", text: "Check the times for that date." });
            return;
          }
          intervals.push({ start, end });
        }
        if (intervals.length === 0) {
          setMessage({ tone: "alert-error", text: "Add at least one block of time." });
          return;
        }
      }

      const response = await fetch("/api/overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selected,
          blocked: mode === "blocked",
          intervals,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage({ tone: "alert-error", text: data.error ?? "Could not update that date." });
        return;
      }

      setOverrides((current) => ({
        ...current,
        [selected]: {
          blocked: mode === "blocked",
          blocks: mode === "blocked" ? [] : blocks.map((block) => ({ ...block })),
        },
      }));
      setMessage({
        tone: "alert-success",
        text: mode === "blocked" ? "That date is now blocked." : "Custom hours saved.",
      });
    } catch {
      setMessage({ tone: "alert-error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const overrideDates = Object.keys(overrides).sort();

  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div className="card">
        <div className="card-header">
          <h2>Specific dates</h2>
          <p>
            Click any date to block it off or give it different hours. Everything else follows your
            weekly schedule.
          </p>
        </div>

        <MonthCalendar
          monthISO={monthISO}
          onMonthChange={setMonthISO}
          selected={selected}
          onSelectDate={openDate}
          dayState={dayState}
          allDaysClickable
          todayISO={today}
        />

        <div className="legend">
          <span>
            <span
              className="legend-swatch"
              style={{ background: "var(--accent-soft)", borderColor: "var(--accent-border)" }}
            />
            Weekly hours apply
          </span>
          <span>
            <span
              className="legend-swatch"
              style={{ background: "var(--warning-soft)", borderColor: "var(--warning)" }}
            />
            Custom hours
          </span>
          <span>
            <span
              className="legend-swatch"
              style={{ background: "var(--danger-soft)", borderColor: "var(--danger)" }}
            />
            Blocked
          </span>
        </div>
      </div>

      <div className="card">
        {!selected ? (
          <>
            <div className="card-header">
              <h2>No date selected</h2>
              <p>Pick a date on the calendar to change it.</p>
            </div>

            {overrideDates.length > 0 ? (
              <div className="list">
                {overrideDates.map((date) => (
                  <div className="list-item" key={date}>
                    <div>
                      <strong>{DateTime.fromISO(date).toFormat("ccc, LLL d, yyyy")}</strong>
                      <div className="faint">
                        {overrides[date].blocked
                          ? "Unavailable all day"
                          : overrides[date].blocks
                              .map(
                                (block) =>
                                  `${minutesToLabel(timeInputToMinutes(block.start) ?? 0)} – ${minutesToLabel(
                                    timeInputToMinutes(block.end) ?? 0,
                                  )}`,
                              )
                              .join(", ")}
                      </div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => openDate(date)}>
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">No date exceptions yet.</div>
            )}
          </>
        ) : (
          <>
            <div className="card-header row-between">
              <div>
                <h2>{DateTime.fromISO(selected).toFormat("cccc, LLLL d, yyyy")}</h2>
                <p>Choose how this single date should behave.</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>

            {message && <div className={`alert ${message.tone}`}>{message.text}</div>}

            <div className="stack" style={{ gap: 8, marginBottom: 14 }}>
              {(
                [
                  ["weekly", "Use my weekly hours"],
                  ["blocked", "Unavailable all day"],
                  ["custom", "Custom hours for this date"],
                ] as [Mode, string][]
              ).map(([value, label]) => (
                <label key={value} className="weekday-toggle" style={{ fontWeight: 500 }}>
                  <input
                    type="radio"
                    name="override-mode"
                    checked={mode === value}
                    onChange={() => {
                      setMode(value);
                      setMessage(null);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>

            {mode === "custom" && (
              <div style={{ marginBottom: 14 }}>
                {blocks.map((block, index) => (
                  <div className="time-row" key={index}>
                    <input
                      type="time"
                      value={block.start}
                      step={300}
                      aria-label={`Start time ${index + 1}`}
                      onChange={(e) =>
                        setBlocks((current) =>
                          current.map((b, i) =>
                            i === index ? { ...b, start: e.target.value } : b,
                          ),
                        )
                      }
                    />
                    <span className="time-sep">to</span>
                    <input
                      type="time"
                      value={block.end}
                      step={300}
                      aria-label={`End time ${index + 1}`}
                      onChange={(e) =>
                        setBlocks((current) =>
                          current.map((b, i) => (i === index ? { ...b, end: e.target.value } : b)),
                        )
                      }
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setBlocks((current) => current.filter((_, i) => i !== index))
                      }
                      aria-label={`Remove block ${index + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    setBlocks((current) => [...current, { start: "09:00", end: "17:00" }])
                  }
                >
                  + Add block
                </button>
              </div>
            )}

            <button className="btn" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save this date"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
