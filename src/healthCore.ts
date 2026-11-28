// Pure Health Connect logic: picking a run out of exercise sessions and wording it. No native calls, so it can be tested alone.

export type Session = {
  id: string;
  start: number;
  end: number;
  /** Health Connect exercise type number. */
  type: number;
  title: string;
  /** Package name of the app that wrote it, such as com.fitbit.FitbitMobile. */
  source: string;
  /** Distance in km when known. */
  km: number | null;
  /** Average and highest heart rate during the session, when the watch recorded it. */
  avgHr?: number | null;
  maxHr?: number | null;
};

export const RUNNING = 56;
export const RUNNING_TREADMILL = 57;
export const RUN_TYPES = [RUNNING, RUNNING_TREADMILL];

const NAMES: Record<number, string> = {
  0: 'Workout',
  8: 'Cycling',
  10: 'Boot camp',
  13: 'Calisthenics',
  25: 'Elliptical',
  36: 'HIIT',
  37: 'Hiking',
  56: 'Run',
  57: 'Treadmill run',
  68: 'Stair climbing',
  69: 'Stair machine',
  70: 'Strength training',
  74: 'Swimming',
  79: 'Walk',
  81: 'Weightlifting',
};
export const typeName = (t: number) => NAMES[t] ?? 'Exercise';

const SOURCES: [RegExp, string][] = [
  [/fitbit/i, 'Fitbit'],
  [/google\.android\.apps\.fitness/i, 'Google Fit'],
  [/google\.android\.apps\.health/i, 'Google Health'],
  [/samsung/i, 'Samsung Health'],
  [/strava/i, 'Strava'],
  [/garmin/i, 'Garmin'],
  [/nothing/i, 'Nothing'],
];
export const sourceName = (pkg: string) => SOURCES.find(([re]) => re.test(pkg))?.[1] ?? (pkg || 'unknown app');

export const minutesOf = (s: Pick<Session, 'start' | 'end'>) => Math.max(0, Math.round((s.end - s.start) / 60_000));

/**
 * The run to count: the most recent running session that ended after `since`, is not in the future,
 * and lasted at least `minMinutes`. Returns null when there is none.
 */
export function pickRun(sessions: Session[], since: number, now: number, minMinutes = 10): Session | null {
  const runs = sessions
    .filter((s) => RUN_TYPES.includes(s.type) && s.end >= since && s.start <= now && minutesOf(s) >= minMinutes)
    .sort((a, b) => b.end - a.end);
  return runs[0] ?? null;
}

/** "Ran 5.2 km in 31 min, from Fitbit" */
export function runSummary(s: Session): string {
  const dist = s.km != null && s.km > 0 ? `${Math.round(s.km * 10) / 10} km in ` : '';
  const hr = s.avgHr ? `, average ${Math.round(s.avgHr)} bpm` : '';
  return `Ran ${dist}${minutesOf(s)} min${hr}, from ${sourceName(s.source)}`;
}

/** One line for the list on the Health Connect screen. */
export function sessionLine(s: Session): string {
  const dist = s.km != null && s.km > 0 ? `, ${Math.round(s.km * 10) / 10} km` : '';
  return `${minutesOf(s)} min${dist}, ${sourceName(s.source)}`;
}

/** Whether a session counts as a run for the minimum length. Used to explain why a short one was skipped. */
export const isShortRun = (s: Session, minMinutes = 10) => RUN_TYPES.includes(s.type) && minutesOf(s) < minMinutes;

/* ---------- sleep, weight, heart rate ---------- */

export type SleepRec = { start: number; end: number; stages: { start: number; end: number; stage: number }[] };

// Health Connect sleep stage numbers that count as asleep: sleeping 2, light 4, deep 5, REM 6.
const ASLEEP = [2, 4, 5, 6];

/** Minutes actually asleep in one sleep record. Uses the stages when there are any, otherwise the whole span. */
export function asleepMinutes(r: SleepRec): number {
  if (!r.stages.length) return Math.max(0, Math.round((r.end - r.start) / 60_000));
  const ms = r.stages.filter((s) => ASLEEP.includes(s.stage)).reduce((a, s) => a + Math.max(0, s.end - s.start), 0);
  return Math.round(ms / 60_000);
}

const ymdOf = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Records of 3 hours asleep or more count as a night's sleep (shorter ones are naps). */
export const NIGHT_MIN = 180;

/** Sleep per night, keyed by the local date the sleep ended on. Two records ending the same day are added up. */
export function nightsOf(recs: SleepRec[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of recs) {
    const m = asleepMinutes(r);
    if (m < NIGHT_MIN) continue;
    const k = ymdOf(r.end);
    out[k] = (out[k] ?? 0) + m;
  }
  return out;
}

/** "6 h 40 min", "7 h", "45 min". */
export function sleepText(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Add weigh-ins from Health Connect for days that have none yet. Your own entries are never replaced. Returns the same array when nothing is new. */
export function mergeWeights<T extends { t: number; kg: number }>(log: T[], recs: { t: number; kg: number }[]): { t: number; kg: number }[] {
  const have = new Set(log.map((e) => ymdOf(e.t)));
  const add: { t: number; kg: number }[] = [];
  for (const r of [...recs].sort((a, b) => a.t - b.t)) {
    const k = ymdOf(r.t);
    if (have.has(k) || r.kg < 30 || r.kg > 250) continue;
    have.add(k);
    add.push({ t: r.t, kg: Math.round(r.kg * 10) / 10 });
  }
  return add.length ? [...log, ...add].sort((a, b) => a.t - b.t) : log;
}
