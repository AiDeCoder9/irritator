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
  return `Ran ${dist}${minutesOf(s)} min, from ${sourceName(s.source)}`;
}

/** One line for the list on the Health Connect screen. */
export function sessionLine(s: Session): string {
  const dist = s.km != null && s.km > 0 ? `, ${Math.round(s.km * 10) / 10} km` : '';
  return `${minutesOf(s)} min${dist}, ${sourceName(s.source)}`;
}

/** Whether a session counts as a run for the minimum length. Used to explain why a short one was skipped. */
export const isShortRun = (s: Session, minMinutes = 10) => RUN_TYPES.includes(s.type) && minutesOf(s) < minMinutes;
