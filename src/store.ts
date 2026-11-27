import Storage from 'expo-sqlite/kv-store';

import { DEFAULT_KINDS, type Kind } from './kinds';
import type { DayEntry } from './progressCore';

export type Gym = { id: string; label: string; lat: number; lng: number; travelMin: number };
export type Home = { lat: number; lng: number; label: string };

export type State = {
  alarmHour: number;
  alarmMinute: number;
  /** A different alarm time for one weekday, in minutes after midnight. Null uses the default time above. Indexed like days. */
  dayTimes: (number | null)[];
  /** Which days the alarm rings, indexed like Date.getDay(): 0 = Sunday. */
  days: boolean[];
  /** What each weekday is when its alarm is on: gym or run. Indexed like days. */
  kinds: Kind[];
  /** Minutes you get after dismissing the alarm: 5 to 30, steps of 5. */
  countdownMin: number;
  reason: string;
  /** Days completed in a row. Today is day streak + 1. */
  streak: number;
  /** Next alarm, epoch ms. */
  alarmAt: number | null;
  dismissedAt: number | null;
  checkedInAt: number | null;
  /** Every gym you go to. Check-in works at any of them. */
  gyms: Gym[];
  /** The gym you are heading to today. */
  activeGymId: string | null;
  /** Used to see you leave. Optional. */
  home: Home | null;
  /** When the phone saw you leave home after this alarm. */
  leftHomeAt: number | null;
  /** How close you must be to check in, in meters. */
  gymRadius: number;
  /** Off = "I'm at the gym" works anywhere. For testing at home. */
  verifyLocation: boolean;
  onboarded: boolean;
  /** One entry per gym day: went or skipped. Starts empty; earlier days are not tracked. */
  history: DayEntry[];
  bestStreak: number;
};

export const defaults: State = {
  alarmHour: 5,
  alarmMinute: 0,
  dayTimes: [null, null, null, null, null, null, null],
  days: [true, true, true, true, true, true, true],
  kinds: DEFAULT_KINDS,
  countdownMin: 20,
  reason: "I'm not going back to who I was in October.",
  streak: 4,
  alarmAt: null,
  dismissedAt: null,
  checkedInAt: null,
  gyms: [],
  activeGymId: null,
  home: null,
  leftHomeAt: null,
  gymRadius: 100,
  verifyLocation: true,
  onboarded: false,
  history: [],
  bestStreak: 4,
};

const KEY = 'irritator.state.v1';

export function loadState(): State {
  try {
    const raw = Storage.getItemSync(KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    // Older builds saved a single gym in flat fields.
    if (!saved.gyms && saved.gymLat != null && saved.gymLng != null) {
      saved.gyms = [
        {
          id: 'g1',
          label: saved.gymLabel || 'My gym',
          lat: saved.gymLat,
          lng: saved.gymLng,
          travelMin: saved.travelMin ?? 20,
        },
      ];
      saved.activeGymId = 'g1';
    }
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

export function saveState(s: State) {
  try {
    Storage.setItemSync(KEY, JSON.stringify(s));
  } catch {
    // Storage failures should never crash the alarm screen.
  }
}
