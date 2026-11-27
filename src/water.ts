import notifee, { AndroidImportance, AndroidVisibility, TriggerType } from 'react-native-notify-kit';
import Storage from 'expo-sqlite/kv-store';

import { goalOf, MAX_IDS, mlText, planReminders, todaysDrinks, totalOf, Water, waterDefaults } from './waterCore';

export * from './waterCore';

const MIN = 60_000;
const KEY = 'irritator.water.v1';
const CHANNEL = 'irritator-water';

export function loadWater(): Water {
  try {
    const raw = Storage.getItemSync(KEY);
    return raw ? { ...waterDefaults, ...JSON.parse(raw) } : waterDefaults;
  } catch {
    return waterDefaults;
  }
}

export function saveWater(w: Water) {
  try {
    // Keep two weeks of drinks. Older ones are not used yet.
    const cutoff = Date.now() - 14 * 24 * 60 * MIN;
    Storage.setItemSync(KEY, JSON.stringify({ ...w, drinks: w.drinks.filter((d) => d.t >= cutoff) }));
  } catch {
    // Never crash a screen or a notification handler over storage.
  }
}

/** Load, change, save. Always starts from what is stored, so the app and the notification handler never overwrite each other. */
export function updateWater(fn: (w: Water) => Water): Water {
  const next = fn(loadWater());
  saveWater(next);
  return next;
}

export function logDrink(ml: number, fromNotification = false, now = Date.now()): Water {
  return updateWater((w) => ({
    ...w,
    drinks: [...w.drinks, { t: now, ml }],
    lastFromNotification: fromNotification ? now : w.lastFromNotification,
  }));
}

export function undoLast(now = Date.now()): Water {
  return updateWater((w) => {
    const today = todaysDrinks(w, now);
    const last = today[today.length - 1];
    return last ? { ...w, drinks: w.drinks.filter((d) => d !== last && !(d.t === last.t && d.ml === last.ml)) } : w;
  });
}

/* ---------- notifications ---------- */

const ids = () => Array.from({ length: MAX_IDS }, (_, i) => `water-${i}`);

async function ensureChannel() {
  await notifee.createChannel({
    id: CHANNEL,
    name: 'Water reminders',
    importance: AndroidImportance.DEFAULT,
    visibility: AndroidVisibility.PUBLIC,
  });
}

/** Cancels old water reminders and schedules the next ones from what is stored. Safe to call any time. */
export async function rescheduleWater(): Promise<void> {
  await ensureChannel();
  for (const id of ids()) await notifee.cancelNotification(id);
  const w = loadWater();
  const now = Date.now();
  const plan = planReminders(w, now);
  const total = totalOf(w, now);
  const goal = goalOf(w);
  for (let i = 0; i < plan.length; i++) {
    await notifee.createTriggerNotification(
      {
        id: `water-${i}`,
        title: 'Drink water',
        body: `${mlText(total)} of ${mlText(goal)} so far.`,
        android: {
          channelId: CHANNEL,
          pressAction: { id: 'default' },
          actions: [
            { title: `Drank ${mlText(w.sizeMl)}`, pressAction: { id: 'water-drank' } },
            { title: `Half`, pressAction: { id: 'water-half' } },
          ],
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: plan[i] },
    );
  }
}

/** Notification button pressed. Works with the app closed. Returns true if it was a water action. */
export async function handleWaterAction(actionId: string | undefined, notificationId?: string): Promise<boolean> {
  if (actionId !== 'water-drank' && actionId !== 'water-half') return false;
  const w = loadWater();
  logDrink(actionId === 'water-half' ? Math.round(w.sizeMl / 2) : w.sizeMl, true);
  if (notificationId) await notifee.cancelNotification(notificationId);
  await rescheduleWater();
  return true;
}
