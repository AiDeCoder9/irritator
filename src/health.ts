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

import { pickRun, Session } from './healthCore';

export * from './healthCore';

/**
 * Reads exercise from Android Health Connect. Read only. Nothing is written, and nothing leaves the phone.
 * Fitbit, Google Health, Samsung Health and others write into Health Connect, and we read from there.
 * Every call can fail (not installed, no permission, old app build), so each one turns errors into plain words.
 */

export type HealthStatus = 'ios' | 'missing' | 'unavailable' | 'update' | 'ready';

const PERMS = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Distance' },
] as const;

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
    return PERMS.every((p) => granted.some((g) => g.recordType === p.recordType && g.accessType === 'read'));
  } catch {
    return false;
  }
}

/** Asks Android to show the Health Connect permission screen. Returns true when everything was allowed. */
export async function connectHealth(): Promise<boolean> {
  try {
    if (!(await initialize())) return false;
    const granted = await requestPermission([...PERMS]);
    return PERMS.every((p) => granted.some((g) => g.recordType === p.recordType));
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
    if (run) return { run };
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
