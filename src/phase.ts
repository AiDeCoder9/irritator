import { TAKEOVER_AFTER_MIN } from './theme';
import type { State } from './store';

export type Phase = 'idle' | 'waiting' | 'ringing' | 'countdown' | 'late' | 'takeover' | 'cleared';

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
  if (now < leaveBy) return 'countdown';
  if (now < leaveBy + TAKEOVER_AFTER_MIN * MIN) return 'late';
  return 'takeover';
}

/** True when the alarm rang and you never got to the gym within the allowed window. */
export function isMissed(s: State, now: number): boolean {
  if (s.alarmAt == null || now < s.alarmAt) return false;
  const leaveBy = leaveByOf(s);
  const base = leaveBy ?? s.alarmAt;
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

/** Next time the alarm should ring on one of the chosen days. */
export function nextOccurrence(hour: number, minute: number, days: boolean[], from = Date.now()) {
  for (let i = 0; i < 8; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    d.setHours(hour, minute, 0, 0);
    if (days[d.getDay()] && d.getTime() > from + 5000) return d.getTime();
  }
  return from + DAY;
}
