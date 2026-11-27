import Storage from 'expo-sqlite/kv-store';
import notifee, { AlarmType, AndroidImportance, AndroidVisibility, TriggerType } from 'react-native-notify-kit';

import { fastEvents, Food, foodDefaults } from './foodCore';
import { timeText } from './phase';

export * from './foodCore';

const KEY = 'irritator.food.v1';
const CHANNEL = 'irritator-fasting';

export function loadFood(): Food {
  try {
    const raw = Storage.getItemSync(KEY);
    if (!raw) return foodDefaults;
    const saved = JSON.parse(raw);
    return { ...foodDefaults, ...saved, fast: { ...foodDefaults.fast, ...saved.fast } };
  } catch {
    return foodDefaults;
  }
}

export function saveFood(f: Food) {
  try {
    // Keep 30 days of meals.
    const cutoff = Date.now() - 30 * 24 * 60 * 60_000;
    Storage.setItemSync(KEY, JSON.stringify({ ...f, meals: f.meals.filter((m) => m.t >= cutoff) }));
  } catch {
    // Never crash a screen over storage.
  }
}

export function updateFood(fn: (f: Food) => Food): Food {
  const next = fn(loadFood());
  saveFood(next);
  return next;
}

/* ---------- fasting reminders ---------- */

const IDS = Array.from({ length: 8 }, (_, i) => `fast-${i}`);

/** Cancels the old fasting notifications and schedules the next few from what is saved. Safe to call any time. */
export async function rescheduleFast(): Promise<void> {
  for (const id of IDS) await notifee.cancelNotification(id);
  const { fast } = loadFood();
  if (!fast.enabled || !fast.notify) return;
  await notifee.createChannel({ id: CHANNEL, name: 'Fasting window', importance: AndroidImportance.DEFAULT, visibility: AndroidVisibility.PUBLIC });
  const events = fastEvents(fast, Date.now(), 3).slice(0, IDS.length);
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    await notifee.createTriggerNotification(
      {
        id: IDS[i],
        title: e.opens ? 'Eating window is open' : 'Eating window closed',
        body: e.opens ? `You can eat until ${timeText(e.ts + fast.eatHours * 3_600_000)}.` : 'Your fast starts now. Water and tea are fine.',
        android: { channelId: CHANNEL, pressAction: { id: 'default' } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: e.ts, alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE } },
    );
  }
}
