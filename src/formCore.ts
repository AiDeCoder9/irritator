// "Form": a simple 0 to 100 score that makes the cost of skipping visible, plus comeback mode after missed days.
// It is a motivation tool, not sports science: it is built so a miss hurts a little, a run of misses hurts more,
// and coming back is rewarded. Pure logic, no storage.
import { ymd, type DayEntry } from './progressCore';

const DAY = 86_400_000;

export const FORM_START = 50;
export const GAIN = 5; // a day done
export const GAIN_COMEBACK = 8; // the first day done after 2 or more missed days
const LOSS_FIRST = 3; // a missed scheduled day
const LOSS_STEP = 2; // each further miss in a row costs 2 more
const LOSS_MAX = 11;
export const COMEBACK_AFTER = 2; // missed scheduled days in a row

/** What the next miss costs, given how many were missed in a row before it. */
export const lossFor = (missRun: number) => Math.min(LOSS_MAX, LOSS_FIRST + LOSS_STEP * missRun);

export type Form = {
  score: number;
  /** Scheduled days missed in a row, counting back from yesterday (or from today if today is done, which makes it 0). */
  missRun: number;
  comeback: boolean;
  /** Form lost if today is skipped. */
  skipCost: number;
  /** Form gained by getting today done. */
  gainToday: number;
  /** Sessions needed to win back the cost of skipping today. */
  sessionsToRecover: number;
  /** False until the app has any history to work from. */
  hasHistory: boolean;
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Walks from your first logged day to yesterday (and to today if today is already done).
 * Done days add, missed scheduled days subtract, excused days change nothing, rest days change nothing.
 * `days` marks which weekdays have an alarm (0 = Sunday).
 */
export function formOf(history: DayEntry[], days: boolean[], now: number): Form {
  const byDate = new Map(history.map((e) => [e.date, e]));
  const first = history.length ? history.reduce((a, b) => (a.date < b.date ? a : b)).date : null;
  const today = ymd(now);
  let score = FORM_START;
  let missRun = 0;

  if (first) {
    const [y, m, d] = first.split('-').map(Number);
    let ts = new Date(y, m - 1, d, 12).getTime();
    for (let guard = 0; guard < 400 && ymd(ts) <= today; guard++, ts += DAY) {
      const date = ymd(ts);
      const e = byDate.get(date);
      if (date === today && e?.result !== 'done') break; // today is not over unless it is done
      if (e?.result === 'done') {
        score = clamp(score + (missRun >= COMEBACK_AFTER ? GAIN_COMEBACK : GAIN));
        missRun = 0;
      } else if (e?.result === 'excused') {
        // nothing changes
      } else if (days[new Date(ts).getDay()]) {
        score = clamp(score - lossFor(missRun));
        missRun++;
      }
    }
  }

  const comeback = missRun >= COMEBACK_AFTER;
  const skipCost = lossFor(missRun);
  const gainToday = comeback ? GAIN_COMEBACK : GAIN;
  return { score, missRun, comeback, skipCost, gainToday, sessionsToRecover: Math.max(1, Math.ceil(skipCost / GAIN)), hasHistory: first != null };
}

/** The one-line cost shown where you decide whether to skip. */
export function skipLine(f: Form): string {
  const to = Math.max(0, f.score - f.skipCost);
  const times = f.sessionsToRecover;
  return `Skipping today takes your form from ${f.score} to ${to}. It takes ${times} ${times === 1 ? 'session' : 'sessions'} to win that back.`;
}
