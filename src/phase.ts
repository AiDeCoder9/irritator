import { TAKEOVER_AFTER_MIN } from './theme';
import type { State } from './store';

export type Phase = 'idle' | 'waiting' | 'ringing' | 'countdown' | 'late' | 'takeover' | 'cleared';

const MIN = 60_000;

export function leaveByOf(s: State): number | null {
  return s.dismissedAt == null ? null : s.dismissedAt + s.countdownMin * MIN;
}

/** The whole app is a function of the saved state and the clock, so it survives being killed and reopened. */
export function phaseOf(s: State, now: number): Phase {
  if (s.checkedInAt != null) return 'cleared';
  if (s.alarmAt == null) return 'idle';
  if (now < s.alarmAt) return 'waiting';
  const leaveBy = leaveByOf(s);
  if (leaveBy == null) return 'ringing';
  if (now < leaveBy) return 'countdown';
  if (now < leaveBy + TAKEOVER_AFTER_MIN * MIN) return 'late';
  return 'takeover';
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

export function nextOccurrence(hour: number, minute: number, from = Date.now()) {
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= from + 5000) d.setDate(d.getDate() + 1);
  return d.getTime();
}
