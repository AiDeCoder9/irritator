import { TAKEOVER_AFTER_MIN } from './theme';
import type { State } from './store';

export type Phase = 'idle' | 'waiting' | 'ringing' | 'countdown' | 'late' | 'takeover' | 'onway' | 'cleared';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** If you haven't checked in this long after leave-by, the day counts as missed. */
export const MISSED_AFTER_MIN = 120;

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Only a dismissal made after the current alarm rang counts. Older ones belong to a previous day. */
function validDismissedAt(s: State): number | null {
  if (s.alarmAt == null || s.dismissedAt == null) return null;
  return s.dismissedAt >= s.alarmAt ? s.dismissedAt : null;
}

/** Only a "left home" seen after this alarm's dismissal counts. */
export function leftHomeOf(s: State): number | null {
  const d = validDismissedAt(s);
  return d != null && s.leftHomeAt != null && s.leftHomeAt >= d ? s.leftHomeAt : null;
}

export function leaveByOf(s: State): number | null {
  const d = validDismissedAt(s);
  return d == null ? null : d + s.countdownMin * MIN;
}

function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** The whole app is a function of the saved state and the clock, so it survives being killed and reopened. */
export function phaseOf(s: State, now: number): Phase {
  if (s.checkedInAt != null && sameDay(s.checkedInAt, now) && (s.alarmAt == null || now < s.alarmAt)) {
    return 'cleared';
  }
  if (s.alarmAt == null) return 'idle';
  if (now < s.alarmAt) return 'waiting';
  const leaveBy = leaveByOf(s);
  if (leaveBy == null) return 'ringing';
  if (leftHomeOf(s) != null) return 'onway';
  if (now < leaveBy) return 'countdown';
  if (now < leaveBy + TAKEOVER_AFTER_MIN * MIN) return 'late';
  return 'takeover';
}

/** True when the alarm rang and you never got to the gym within the allowed window. */
export function isMissed(s: State, now: number): boolean {
  if (s.alarmAt == null || now < s.alarmAt) return false;
  const leaveBy = leaveByOf(s);
  const left = leftHomeOf(s);
  const base = left ?? leaveBy ?? s.alarmAt;
  return now > base + MISSED_AFTER_MIN * MIN;
}

export function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function clockText(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function timeText(ts: number) {
  const d = new Date(ts);
  return `${d.getHours()}:${pad(d.getMinutes())}`;
}

export function dayName(ts: number) {
  return DAY_NAMES[new Date(ts).getDay()];
}

/** Next alarm over the chosen days, where each weekday can have its own time. `timeFor` gets Date.getDay() (0 = Sunday). */
export function nextOccurrenceBy(timeFor: (day: number) => [number, number], days: boolean[], from = Date.now()) {
  for (let i = 0; i < 8; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const [h, m] = timeFor(d.getDay());
    d.setHours(h, m, 0, 0);
    if (days[d.getDay()] && d.getTime() > from + 5000) return d.getTime();
  }
  return from + DAY;
}

/** Same time on every chosen day. */
export function nextOccurrence(hour: number, minute: number, days: boolean[], from = Date.now()) {
  return nextOccurrenceBy(() => [hour, minute], days, from);
}

/** The alarm time for a weekday: its own time if set, otherwise the default. */
export function timeOnDay(s: { alarmHour: number; alarmMinute: number; dayTimes: (number | null)[] }, day: number): [number, number] {
  const own = s.dayTimes[day];
  return own == null ? [s.alarmHour, s.alarmMinute] : [Math.floor(own / 60), own % 60];
}

/** 5:00 am style, matching how people say alarm times. */
export function time12(hour: number, minute: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${pad(minute)} ${hour < 12 ? 'am' : 'pm'}`;
}

/** "in 14 h 2 min" */
export function inText(ms: number) {
  const total = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `in ${m} min`;
  return `in ${h} h ${m} min`;
}
