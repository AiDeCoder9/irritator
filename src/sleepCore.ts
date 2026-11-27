// Bedtime reminder logic: working back from the alarm. Pure, so it can be tested alone.
import { nextOccurrenceBy, time12, timeOnDay } from './phase';

export type Sleep = { enabled: boolean; hours: number };
export const SLEEP_MIN = 6;
export const SLEEP_MAX = 10;
export const sleepDefaults: Sleep = { enabled: false, hours: 8 };

const H = 3_600_000;
const MIN = 60_000;

type Plan = { alarmHour: number; alarmMinute: number; dayTimes: (number | null)[]; days: boolean[]; sleep: Sleep };

/** "8 h" or "7.5 h". */
export const hoursText = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} h`;

const clock = (t: number) => {
  const d = new Date(t);
  return time12(d.getHours(), d.getMinutes());
};

/**
 * The next bedtimes, one per upcoming alarm, each `hours` before its alarm. Each has a wind-down 30 minutes earlier.
 * Anything already in the past is left out. Empty when the reminder is off or no alarm days are chosen.
 */
export function bedtimes(s: Plan, now: number, count = 7): { alarmAt: number; bedAt: number; windDownAt: number }[] {
  if (!s.sleep.enabled || !s.days.some(Boolean)) return [];
  const out: { alarmAt: number; bedAt: number; windDownAt: number }[] = [];
  let from = now;
  for (let i = 0; i < count + 3 && out.length < count; i++) {
    const alarmAt = nextOccurrenceBy((d) => timeOnDay(s, d), s.days, from);
    from = alarmAt;
    const bedAt = alarmAt - s.sleep.hours * H;
    if (bedAt > now + 5000) out.push({ alarmAt, bedAt, windDownAt: bedAt - 30 * MIN });
  }
  return out;
}

/** The line shown on Today. Null when the reminder is off or no alarm is set. */
export function sleepLine(s: { sleep: Sleep; alarmAt: number | null }, now: number): string | null {
  if (!s.sleep.enabled || s.alarmAt == null || s.alarmAt <= now) return null;
  const bedAt = s.alarmAt - s.sleep.hours * H;
  if (now < bedAt) return `Bed by ${clock(bedAt)} for ${hoursText(s.sleep.hours)} of sleep.`;
  const left = Math.floor((s.alarmAt - now) / MIN);
  return `Past bedtime. Sleep now and you still get ${Math.floor(left / 60)} h ${left % 60} min.`;
}
