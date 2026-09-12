import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DateTime } from "luxon";

import {
  generateSlotsForDate,
  generateSlotsForRange,
  intervalsForDate,
  isSlotBookable,
  mergeIntervals,
  parseIntervals,
  type SchedulingSettings,
} from "./availability";

const ZONE = "America/New_York";

const settings: SchedulingSettings = {
  timezone: ZONE,
  durationMinutes: 30,
  bufferMinutes: 0,
  slotIntervalMins: 30,
  minNoticeMinutes: 0,
  maxDaysAhead: 60,
};

/** Mon–Fri, 9:00–12:00. Weekday 1 = Monday. */
const weekdayMornings = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 12 * 60,
}));

/** A fixed "now" so tests never depend on the wall clock. */
const now = DateTime.fromISO("2026-03-02T08:00:00", { zone: ZONE });

function localTimes(slots: { startUtc: string }[]): string[] {
  return slots.map((slot) =>
    DateTime.fromISO(slot.startUtc, { zone: "utc" }).setZone(ZONE).toFormat("HH:mm"),
  );
}

describe("mergeIntervals", () => {
  it("unions overlapping and touching spans", () => {
    assert.deepEqual(
      mergeIntervals([
        { start: 540, end: 660 },
        { start: 600, end: 720 },
        { start: 780, end: 840 },
      ]),
      [
        { start: 540, end: 720 },
        { start: 780, end: 840 },
      ],
    );
  });

  it("drops empty and inverted spans", () => {
    assert.deepEqual(mergeIntervals([{ start: 600, end: 600 }, { start: 700, end: 650 }]), []);
  });
});

describe("parseIntervals", () => {
  it("reads a stored JSON array", () => {
    assert.deepEqual(parseIntervals('[{"start":540,"end":720}]'), [{ start: 540, end: 720 }]);
  });

  it("returns [] for malformed or out-of-range data", () => {
    assert.deepEqual(parseIntervals("not json"), []);
    assert.deepEqual(parseIntervals('[{"start":-10,"end":100}]'), []);
    assert.deepEqual(parseIntervals('[{"start":100,"end":2000}]'), []);
  });
});

describe("intervalsForDate", () => {
  it("uses the weekly rule for that weekday", () => {
    // 2026-03-02 is a Monday.
    assert.deepEqual(intervalsForDate("2026-03-02", weekdayMornings, null, ZONE), [
      { start: 540, end: 720 },
    ]);
  });

  it("returns nothing for a weekday with no rule", () => {
    // 2026-03-07 is a Saturday.
    assert.deepEqual(intervalsForDate("2026-03-07", weekdayMornings, null, ZONE), []);
  });

  it("lets a date override replace the weekly rule", () => {
    assert.deepEqual(
      intervalsForDate(
        "2026-03-02",
        weekdayMornings,
        { date: "2026-03-02", blocked: false, intervals: '[{"start":840,"end":960}]' },
        ZONE,
      ),
      [{ start: 840, end: 960 }],
    );
  });

  it("treats a blocked override as fully unavailable", () => {
    assert.deepEqual(
      intervalsForDate(
        "2026-03-02",
        weekdayMornings,
        { date: "2026-03-02", blocked: true, intervals: "[]" },
        ZONE,
      ),
      [],
    );
  });
});

describe("generateSlotsForDate", () => {
  it("walks the interval in slot-sized steps", () => {
    const slots = generateSlotsForDate({
      dateISO: "2026-03-02",
      settings,
      weeklyRules: weekdayMornings,
      now,
    });
    assert.deepEqual(localTimes(slots), ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
  });

  it("never produces a slot that overruns the interval", () => {
    const slots = generateSlotsForDate({
      dateISO: "2026-03-02",
      settings: { ...settings, durationMinutes: 45, slotIntervalMins: 30 },
      weeklyRules: weekdayMornings,
      now,
    });
    assert.deepEqual(localTimes(slots), ["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("removes slots that collide with busy time", () => {
    const busyStart = DateTime.fromISO("2026-03-02T10:00:00", { zone: ZONE });
    const slots = generateSlotsForDate({
      dateISO: "2026-03-02",
      settings,
      weeklyRules: weekdayMornings,
      busy: [{ start: busyStart.toMillis(), end: busyStart.plus({ minutes: 30 }).toMillis() }],
      now,
    });
    assert.deepEqual(localTimes(slots), ["09:00", "09:30", "10:30", "11:00", "11:30"]);
  });

  it("expands busy time by the buffer on both sides", () => {
    const busyStart = DateTime.fromISO("2026-03-02T10:00:00", { zone: ZONE });
    const slots = generateSlotsForDate({
      dateISO: "2026-03-02",
      settings: { ...settings, bufferMinutes: 15 },
      weeklyRules: weekdayMornings,
      busy: [{ start: busyStart.toMillis(), end: busyStart.plus({ minutes: 30 }).toMillis() }],
      now,
    });
    assert.deepEqual(localTimes(slots), ["09:00", "11:00", "11:30"]);
  });

  it("honours the minimum notice window", () => {
    const slots = generateSlotsForDate({
      dateISO: "2026-03-02",
      settings: { ...settings, minNoticeMinutes: 180 }, // now is 08:00 => 11:00 earliest
      weeklyRules: weekdayMornings,
      now,
    });
    assert.deepEqual(localTimes(slots), ["11:00", "11:30"]);
  });

  it("refuses dates in the past", () => {
    const slots = generateSlotsForDate({
      dateISO: "2026-02-27",
      settings,
      weeklyRules: weekdayMornings,
      now,
    });
    assert.deepEqual(slots, []);
  });

  it("refuses dates beyond the booking horizon", () => {
    const slots = generateSlotsForDate({
      dateISO: "2026-03-16",
      settings: { ...settings, maxDaysAhead: 7 },
      weeklyRules: weekdayMornings,
      now,
    });
    assert.deepEqual(slots, []);
  });

  it("keeps local clock times correct across a DST spring-forward", () => {
    // US DST begins 2026-03-08; the Monday after is 2026-03-09.
    const slots = generateSlotsForDate({
      dateISO: "2026-03-09",
      settings,
      weeklyRules: weekdayMornings,
      now,
    });
    assert.deepEqual(localTimes(slots), ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
    // 9:00 EDT is 13:00 UTC, where 9:00 EST the week before was 14:00 UTC.
    assert.equal(slots[0].startUtc, "2026-03-09T13:00:00.000Z");
  });
});

describe("generateSlotsForRange", () => {
  it("only includes days that have open times", () => {
    const days = generateSlotsForRange({
      fromISO: "2026-03-02",
      toISO: "2026-03-08",
      settings,
      weeklyRules: weekdayMornings,
      overrides: [{ date: "2026-03-04", blocked: true, intervals: "[]" }],
      now,
    });
    assert.deepEqual(Object.keys(days).sort(), [
      "2026-03-02",
      "2026-03-03",
      "2026-03-05",
      "2026-03-06",
    ]);
  });
});

describe("isSlotBookable", () => {
  const startUtc = DateTime.fromISO("2026-03-02T09:00:00", { zone: ZONE })
    .toUTC()
    .toISO() as string;

  it("accepts a slot that the generator produced", () => {
    assert.equal(
      isSlotBookable({ startUtc, settings, weeklyRules: weekdayMornings, now }),
      true,
    );
  });

  it("rejects a start time that is not on the grid", () => {
    const offGrid = DateTime.fromISO("2026-03-02T09:07:00", { zone: ZONE })
      .toUTC()
      .toISO() as string;
    assert.equal(
      isSlotBookable({ startUtc: offGrid, settings, weeklyRules: weekdayMornings, now }),
      false,
    );
  });

  it("rejects a slot that is already busy", () => {
    const busy = DateTime.fromISO("2026-03-02T09:00:00", { zone: ZONE });
    assert.equal(
      isSlotBookable({
        startUtc,
        settings,
        weeklyRules: weekdayMornings,
        busy: [{ start: busy.toMillis(), end: busy.plus({ minutes: 30 }).toMillis() }],
        now,
      }),
      false,
    );
  });

  it("rejects a slot on a blocked date", () => {
    assert.equal(
      isSlotBookable({
        startUtc,
        settings,
        weeklyRules: weekdayMornings,
        overrides: [{ date: "2026-03-02", blocked: true, intervals: "[]" }],
        now,
      }),
      false,
    );
  });
});
