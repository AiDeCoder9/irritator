import Storage from 'expo-sqlite/kv-store';

export type State = {
  alarmHour: number;
  alarmMinute: number;
  /** Minutes you get after dismissing the alarm: 5 to 30, steps of 5. */
  countdownMin: number;
  reason: string;
  streak: number;
  /** Next alarm, epoch ms. */
  alarmAt: number | null;
  dismissedAt: number | null;
  checkedInAt: number | null;
};

export const defaults: State = {
  alarmHour: 5,
  alarmMinute: 0,
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
