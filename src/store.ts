import Storage from 'expo-sqlite/kv-store';

export type State = {
  alarmHour: number;
  alarmMinute: number;
  /** Which days the alarm rings, indexed like Date.getDay(): 0 = Sunday. */
  days: boolean[];
  /** Minutes you get after dismissing the alarm: 5 to 30, steps of 5. */
  countdownMin: number;
  reason: string;
  /** Days completed in a row. Today is day streak + 1. */
  streak: number;
  /** Next alarm, epoch ms. */
  alarmAt: number | null;
  dismissedAt: number | null;
  checkedInAt: number | null;
};

export const defaults: State = {
  alarmHour: 5,
  alarmMinute: 0,
  days: [true, true, true, true, true, true, true],
  countdownMin: 20,
  reason: "I'm not going back to who I was in October.",
  streak: 4,
  alarmAt: null,
  dismissedAt: null,
  checkedInAt: null,
};

const KEY = 'irritator.state.v1';

export function loadState(): State {
  try {
    const raw = Storage.getItemSync(KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
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
