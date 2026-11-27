// Pure progress logic: day history, streak numbers and the last two weeks. No storage, so it can be tested alone.

export type Result = 'done' | 'skipped';
export type DayEntry = { date: string; result: Result; at: number };

const DAY = 86_400_000;

/** Local calendar date, like 2026-11-27. */
export function ymd(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const at = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

/** One entry per day. A later result for the same day replaces the earlier one. Keeps 120 days. */
export function addEntry(history: DayEntry[], dayTs: number, result: Result, now = Date.now()): DayEntry[] {
  const date = ymd(dayTs);
  const kept = history.filter((e) => e.date !== date && now - at(e.date).getTime() < 120 * DAY);
  return [...kept, { date, result, at: now }].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export type Cell = { date: string; state: 'done' | 'skipped' | 'rest' | 'empty' | 'today'; label: string };

/** The last `n` days ending today, oldest first. `days` marks which weekdays have a gym alarm (0 = Sunday). */
export function lastDays(history: DayEntry[], days: boolean[], now: number, n = 14): Cell[] {
  const byDate = new Map(history.map((e) => [e.date, e.result]));
  const out: Cell[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    const date = ymd(d.getTime());
    const r = byDate.get(date);
    const label = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
    const state: Cell['state'] = r ?? (i === 0 ? 'today' : days[d.getDay()] ? 'empty' : 'rest');
    out.push({ date, state: r ? r : state, label });
  }
  return out;
}

export type Stats = {
  streak: number;
  best: number;
  weekDone: number;
  weekScheduled: number;
  /** Share of scheduled days you went, over the last 28 days since tracking began. Null until there is a day to count. */
  consistency: number | null;
  tracked: number;
};

export function statsOf(history: DayEntry[], days: boolean[], streak: number, bestStreak: number, now: number): Stats {
  // Week runs Monday to today.
  const dow = (new Date(now).getDay() + 6) % 7;
  const weekStart = ymd(now - dow * DAY);
  const weekDone = history.filter((e) => e.date >= weekStart && e.result === 'done').length;
  let weekScheduled = 0;
  for (let i = 0; i <= dow; i++) if (days[new Date(now - i * DAY).getDay()]) weekScheduled++;

  const first = history[0]?.date;
  let scheduled = 0;
  let done = 0;
  if (first) {
    for (let i = 0; i < 28; i++) {
      const ts = now - i * DAY;
      const date = ymd(ts);
      if (date < first) break;
      const e = history.find((x) => x.date === date);
      if (e) {
        scheduled++;
        if (e.result === 'done') done++;
      } else if (i > 0 && days[new Date(ts).getDay()]) scheduled++;
    }
  }
  return {
    streak,
    best: Math.max(bestStreak, streak),
    weekDone,
    weekScheduled: Math.max(weekScheduled, weekDone),
    consistency: scheduled ? Math.round((done / scheduled) * 100) : null,
    tracked: history.length,
  };
}
