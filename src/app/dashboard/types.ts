export type RuleInput = { weekday: number; startMinute: number; endMinute: number };

export type OverrideInput = { date: string; blocked: boolean; intervals: string };

export type UserSettings = {
  name: string;
  username: string;
  timezone: string;
  eventTitle: string;
  eventDescription: string;
  eventLocation: string;
  durationMinutes: number;
  bufferMinutes: number;
  slotIntervalMins: number;
  minNoticeMinutes: number;
  maxDaysAhead: number;
};
