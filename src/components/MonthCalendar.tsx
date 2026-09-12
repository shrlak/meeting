"use client";

import { DateTime } from "luxon";

import { WEEKDAY_SHORT } from "@/lib/time";

export type DayState = "available" | "unavailable" | "blocked" | "custom";

type Props = {
  /** Any date inside the month being displayed. */
  monthISO: string;
  onMonthChange: (monthISO: string) => void;
  selected?: string | null;
  onSelectDate?: (dateISO: string) => void;
  /** Visual state for a given date; drives colour and default clickability. */
  dayState: (dateISO: string) => DayState;
  /** When true, every in-month day is clickable regardless of state. */
  allDaysClickable?: boolean;
  /** Dates outside [minDate, maxDate] are shown but never clickable. */
  minDate?: string;
  maxDate?: string;
  todayISO: string;
  busy?: boolean;
};

export default function MonthCalendar({
  monthISO,
  onMonthChange,
  selected,
  onSelectDate,
  dayState,
  allDaysClickable = false,
  minDate,
  maxDate,
  todayISO,
  busy = false,
}: Props) {
  const month = DateTime.fromISO(monthISO).startOf("month");
  const leadingBlanks = month.weekday % 7; // luxon: 1 = Monday … 7 = Sunday
  const gridStart = month.minus({ days: leadingBlanks });
  const weeks = Math.ceil((leadingBlanks + (month.daysInMonth ?? 31)) / 7);
  const visible = Array.from({ length: weeks * 7 }, (_, index) => gridStart.plus({ days: index }));

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onMonthChange(month.minus({ months: 1 }).toISODate() as string)}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="calendar-title">
          {month.toFormat("LLLL yyyy")} {busy && <span className="spinner" aria-label="Loading" />}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onMonthChange(month.plus({ months: 1 }).toISODate() as string)}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="calendar-grid" role="grid">
        {WEEKDAY_SHORT.map((label) => (
          <div key={label} className="calendar-dow" role="columnheader">
            {label.slice(0, 2)}
          </div>
        ))}

        {visible.map((day) => {
          const iso = day.toISODate() as string;
          const inMonth = day.month === month.month;

          if (!inMonth) {
            return <div key={iso} className="day day-empty" aria-hidden />;
          }

          const beforeMin = minDate ? iso < minDate : false;
          const afterMax = maxDate ? iso > maxDate : false;
          const outOfRange = beforeMin || afterMax;
          const state = outOfRange ? "unavailable" : dayState(iso);

          const clickable =
            Boolean(onSelectDate) &&
            !outOfRange &&
            (allDaysClickable || state === "available" || state === "blocked" || state === "custom");

          const classes = ["day"];
          if (state === "available") classes.push("day-available");
          if (state === "blocked") classes.push("day-blocked");
          if (state === "custom") classes.push("day-custom");
          if (clickable && state === "unavailable") classes.push("day-clickable");
          if (selected === iso) classes.push("day-selected");
          if (iso === todayISO) classes.push("day-today");

          return (
            <button
              key={iso}
              type="button"
              className={classes.join(" ")}
              disabled={!clickable}
              aria-pressed={selected === iso}
              aria-label={day.toFormat("cccc, LLLL d, yyyy")}
              onClick={() => onSelectDate?.(iso)}
            >
              {day.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
