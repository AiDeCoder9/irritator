// Starter mode: for people who do not work out yet. A small daily walk, a few days a week, a goal that grows slowly.
import { ymd } from './progressCore';

export type StarterLog = { date: string; minutes: number; steps: number | null; how: 'walk' | 'other' };
export type StarterRun = { startAt: number; minutes: number };
export type Starter = {
  enabled: boolean;
  /** Reminder time in minutes after midnight. */
  remindMin: number;
  /** Days a week that count as a full week: 3 to 7. */
  perWeek: number;
  /** Minutes on a first-week day: 5 to 20. */
  startMin: number;
  log: StarterLog[];
  /** A walk in progress. */
  run: StarterRun | null;
};

export const starterDefaults: Starter = { enabled: false, remindMin: 18 * 60 + 30, perWeek: 4, startMin: 10, log: [], run: null };

export const MIN_START = 5;
export const MAX_START = 20;
export const MAX_GOAL = 30;
export const STEPS_PER_MIN = 60;
const DAY = 86_400_000;
const MIN = 60_000;

/** Midnight on the Monday of the week that holds `ts`. */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

const datesIn = (log: StarterLog[], from: number) => {
  const dates = new Set<string>();
  for (let i = 0; i < 7; i++) dates.add(ymd(from + i * DAY + DAY / 2));
  return new Set(log.filter((l) => dates.has(l.date)).map((l) => l.date));
};

/** Distinct days done in the week that holds `ts`. */
export function weekDone(log: StarterLog[], ts: number): number {
  return datesIn(log, weekStart(ts)).size;
}

export const doneOn = (log: StarterLog[], ts: number) => log.some((l) => l.date === ymd(ts));

/** Days in a row with a walk. Today counts when done; if not yet done, the run ends yesterday. */
export function streakDays(log: StarterLog[], now: number): number {
  let n = 0;
  let t = doneOn(log, now) ? now : now - DAY;
  while (doneOn(log, t)) {
    n++;
    t -= DAY;
  }
  return n;
}

/** Weeks (Monday to Sunday) that reached the weekly target, this one included when it is already full. A missed week does not undo the others. */
export function fullWeeks(st: Pick<Starter, 'log' | 'perWeek'>, _now?: number): number {
  const weeks = new Map<number, Set<string>>();
  for (const l of st.log) {
    const [y, m, d] = l.date.split('-').map(Number);
    const w = weekStart(new Date(y, m - 1, d, 12).getTime());
    weeks.set(w, (weeks.get(w) ?? new Set()).add(l.date));
  }
  return [...weeks.values()].filter((set) => set.size >= st.perWeek).length;
}

/** Minutes for today: the starting amount plus 2 for each full week so far, up to 30. It never drops. */
export function goalMinutes(st: Pick<Starter, 'log' | 'perWeek' | 'startMin'>, now: number): number {
  return Math.min(MAX_GOAL, st.startMin + 2 * fullWeeks(st, now));
}

/** Steps that count as a real walk: a slow pace, so it is easy to meet. */
export const stepsNeeded = (minutes: number) => minutes * STEPS_PER_MIN;

export type WalkCheck = { kind: 'running'; leftMs: number } | { kind: 'ok'; steps: number | null } | { kind: 'few'; steps: number; needed: number } | { kind: 'stale' };

/** A walk is a timer. When it ends, steps (if the phone has them) must reach the pace. */
export function walkCheck(run: StarterRun, now: number, steps: number | null): WalkCheck {
  const end = run.startAt + run.minutes * MIN;
  if (now - run.startAt > 3 * 60 * MIN) return { kind: 'stale' };
  if (now < end) return { kind: 'running', leftMs: end - now };
  const need = stepsNeeded(run.minutes);
  if (steps != null && steps < need) return { kind: 'few', steps, needed: need };
  return { kind: 'ok', steps };
}

export type StarterEvent = { ts: number; late: boolean };

/** A reminder at your time, and one an hour later. None on days already done or once the week is full. */
export function reminderEvents(st: Pick<Starter, 'enabled' | 'remindMin' | 'log' | 'perWeek'>, now: number, days = 3): StarterEvent[] {
  if (!st.enabled) return [];
  const out: StarterEvent[] = [];
  for (let d = 0; d < days; d++) {
    const base = new Date(now + d * DAY);
    base.setHours(Math.floor(st.remindMin / 60), st.remindMin % 60, 0, 0);
    const at = base.getTime();
    if (doneOn(st.log, at) || weekDone(st.log, at) >= st.perWeek) continue;
    if (at > now) out.push({ ts: at, late: false });
    if (at + 60 * MIN > now) out.push({ ts: at + 60 * MIN, late: true });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

/** Add today's walk once. A second log on the same day keeps the first. */
export function addLog(log: StarterLog[], entry: StarterLog): StarterLog[] {
  return log.some((l) => l.date === entry.date) ? log : [...log, entry].slice(-120);
}

/** The line under the big card. */
export function starterLine(st: Starter, now: number): string {
  const done = weekDone(st.log, now);
  const left = Math.max(0, st.perWeek - done);
  if (doneOn(st.log, now)) return left === 0 ? 'Done today. This week is full.' : `Done today. ${left} more ${left === 1 ? 'day' : 'days'} for a full week.`;
  return left === 0 ? 'This week is already full. A walk today is a bonus.' : `${done} of ${st.perWeek} days this week.`;
}
