import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';
import { Platform } from 'react-native';

import { mergeWeights, nightsOf, pickRun, Session, SleepRec } from './healthCore';

export * from './healthCore';

/**
 * Reads exercise from Android Health Connect. Read only. Nothing is written, and nothing leaves the phone.
 * Fitbit, Google Health, Samsung Health and others write into Health Connect, and we read from there.
 * Every call can fail (not installed, no permission, old app build), so each one turns errors into plain words.
 */

export type HealthStatus = 'ios' | 'missing' | 'unavailable' | 'update' | 'ready';

// Needed for run check-in.
const CORE = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Distance' },
] as const;
// Extras. Each one works on its own, so refusing one does not break the others.
const EXTRA = [
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'HeartRate' },
] as const;
const PERMS = [...CORE, ...EXTRA] as const;

const iso = (t: number) => new Date(t).toISOString();

export async function healthStatus(): Promise<HealthStatus> {
  if (Platform.OS !== 'android') return 'ios';
  try {
    const s = await getSdkStatus();
    if (s === 3) return 'ready';
    return s === 2 ? 'update' : 'unavailable';
  } catch {
    // The native part is not in this build of the app.
    return 'missing';
  }
}

export async function hasHealthAccess(): Promise<boolean> {
  try {
    await initialize();
    const granted = await getGrantedPermissions();
    return CORE.every((p) => granted.some((g) => g.recordType === p.recordType && g.accessType === 'read'));
  } catch {
    return false;
  }
}

/** Which record types are allowed right now. Empty when Health Connect cannot be reached. */
export async function grantedTypes(): Promise<string[]> {
  try {
    await initialize();
    return (await getGrantedPermissions()).filter((g) => g.accessType === 'read').map((g) => g.recordType);
  } catch {
    return [];
  }
}

/** Asks Android to show the Health Connect permission screen. Returns true when everything was allowed. */
export async function connectHealth(): Promise<boolean> {
  try {
    if (!(await initialize())) return false;
    const granted = await requestPermission([...PERMS]);
    return CORE.every((p) => granted.some((g) => g.recordType === p.recordType));
  } catch {
    return false;
  }
}

export function manageHealth() {
  try {
    openHealthConnectSettings();
  } catch {
    // Nothing to do if it cannot open.
  }
}

async function distanceKm(start: number, end: number): Promise<number | null> {
  try {
    const r = await aggregateRecord({ recordType: 'Distance', timeRangeFilter: { operator: 'between', startTime: iso(start), endTime: iso(end) } });
    const km = r.DISTANCE?.inKilometers;
    return typeof km === 'number' ? km : null;
  } catch {
    return null;
  }
}

/** Exercise sessions from the last `days` days, newest first. Distance is filled in for up to 20 of them. */
export async function recentSessions(days: number, now = Date.now()): Promise<Session[]> {
  const res = await readRecords('ExerciseSession', {
    timeRangeFilter: { operator: 'between', startTime: iso(now - days * 24 * 3_600_000), endTime: iso(now) },
    ascendingOrder: false,
    pageSize: 100,
  });
  const out: Session[] = res.records.map((r) => ({
    id: r.metadata?.id ?? `${r.startTime}`,
    start: new Date(r.startTime).getTime(),
    end: new Date(r.endTime).getTime(),
    type: r.exerciseType,
    title: r.title ?? '',
    source: r.metadata?.dataOrigin ?? '',
    km: null,
  }));
  out.sort((a, b) => b.start - a.start);
  for (const s of out.slice(0, 20)) s.km = await distanceKm(s.start, s.end);
  return out;
}

export async function stepsSince(since: number, now = Date.now()): Promise<number | null> {
  try {
    const r = await aggregateRecord({ recordType: 'Steps', timeRangeFilter: { operator: 'between', startTime: iso(since), endTime: iso(now) } });
    return typeof r.COUNT_TOTAL === 'number' ? r.COUNT_TOTAL : null;
  } catch {
    return null;
  }
}

/**
 * Looks for a run in the last 20 hours. Asks for permission if needed (call it from a button press).
 * Returns the run, or a plain message saying why there is none.
 */
export async function findRecentRun(now = Date.now()): Promise<{ run: Session } | { message: string }> {
  const status = await healthStatus();
  if (status === 'ios') return { message: 'Health Connect is Android only.' };
  if (status === 'missing') return { message: 'This version of the app cannot read Health Connect. Install the newest app version.' };
  if (status === 'unavailable') return { message: 'Health Connect is not on this phone. Install it from the Play Store, then try again.' };
  if (status === 'update') return { message: 'Health Connect needs an update. Update it in the Play Store, then try again.' };
  if (!(await hasHealthAccess())) {
    if (!(await connectHealth())) return { message: 'Allow IRRITATOR to read exercise, steps and distance in Health Connect, then try again.' };
  }
  try {
    const sessions = await recentSessions(1, now);
    const run = pickRun(sessions, now - 20 * 3_600_000, now);
    if (run) {
      const hr = await heartRate(run.start, run.end);
      return { run: hr ? { ...run, avgHr: hr.avg, maxHr: hr.max } : run };
    }
    const short = sessions.find((s) => s.type === 56 || s.type === 57);
    return {
      message: short
        ? 'Only a run under 10 minutes was found. Type your run below instead.'
        : 'No run found yet. Open your watch app to sync, wait a minute, then try again. Or type your run below.',
    };
  } catch {
    return { message: 'Could not read Health Connect. Try again, or type your run below.' };
  }
}

/* ---------- extra data: sleep, weight, calories burned, heart rate ---------- */

export type HealthData = {
  /** Minutes asleep per night, keyed by the local date you woke up (YYYY-MM-DD). Last 9 days. */
  nights: Record<string, number>;
  /** Weigh-ins from the last 60 days. */
  weights: { t: number; kg: number }[];
  /** Active calories burned since midnight, or null if not allowed or not recorded. */
  activeKcal: number | null;
  /** Which extras are allowed, so the screen can say what is missing. */
  allowed: { sleep: boolean; weight: boolean; burn: boolean; heart: boolean };
};

const DAYMS = 24 * 3_600_000;

/**
 * Reads whatever extras are allowed. Never asks for permission (safe to call at app start).
 * Returns null when Health Connect is not ready or nothing at all is allowed. Each part fails on its own.
 */
export async function readHealthData(now = Date.now()): Promise<HealthData | null> {
  if ((await healthStatus()) !== 'ready') return null;
  const g = await grantedTypes();
  const allowed = { sleep: g.includes('SleepSession'), weight: g.includes('Weight'), burn: g.includes('ActiveCaloriesBurned'), heart: g.includes('HeartRate') };
  if (!allowed.sleep && !allowed.weight && !allowed.burn) return null;
  const out: HealthData = { nights: {}, weights: [], activeKcal: null, allowed };
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);

  if (allowed.sleep) {
    try {
      const res = await readRecords('SleepSession', { timeRangeFilter: { operator: 'between', startTime: iso(now - 9 * DAYMS), endTime: iso(now) }, pageSize: 100 });
      const recs: SleepRec[] = res.records.map((r) => ({
        start: new Date(r.startTime).getTime(),
        end: new Date(r.endTime).getTime(),
        stages: (r.stages ?? []).map((st) => ({ start: new Date(st.startTime).getTime(), end: new Date(st.endTime).getTime(), stage: st.stage })),
      }));
      out.nights = nightsOf(recs);
    } catch {
      // leave empty
    }
  }
  if (allowed.weight) {
    try {
      const res = await readRecords('Weight', { timeRangeFilter: { operator: 'between', startTime: iso(now - 60 * DAYMS), endTime: iso(now) }, pageSize: 100 });
      out.weights = res.records
        .map((r) => ({ t: new Date(r.time).getTime(), kg: r.weight.inKilograms }))
        .filter((w) => Number.isFinite(w.kg));
    } catch {
      // leave empty
    }
  }
  if (allowed.burn) {
    try {
      const r = await aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: { operator: 'between', startTime: iso(midnight.getTime()), endTime: iso(now) } });
      const k = r.ACTIVE_CALORIES_TOTAL?.inKilocalories;
      out.activeKcal = typeof k === 'number' && k > 0 ? Math.round(k) : null;
    } catch {
      // leave null
    }
  }
  return out;
}

export { mergeWeights };

/** Average and highest heart rate during a session. Null when not allowed or not recorded. */
async function heartRate(start: number, end: number): Promise<{ avg: number; max: number } | null> {
  try {
    if (!(await grantedTypes()).includes('HeartRate')) return null;
    const r = await aggregateRecord({ recordType: 'HeartRate', timeRangeFilter: { operator: 'between', startTime: iso(start), endTime: iso(end) } });
    return typeof r.BPM_AVG === 'number' && r.BPM_AVG > 0 ? { avg: r.BPM_AVG, max: r.BPM_MAX } : null;
  } catch {
    return null;
  }
}
