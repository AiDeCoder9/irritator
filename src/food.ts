import Storage from 'expo-sqlite/kv-store';
import notifee, { AlarmType, AndroidImportance, AndroidVisibility, TriggerType } from 'react-native-notify-kit';

import { fastEvents, Food, foodDefaults, Hit, parseUsda } from './foodCore';
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

/* ---------- USDA FoodData Central search ---------- */

const USDA = 'https://api.nal.usda.gov/fdc/v1/foods/search';

/** Searches plain and cooked foods (not store brands). Without your own free key the shared DEMO_KEY allows about 50 searches a day. */
export async function searchFoods(query: string, key: string): Promise<Hit[]> {
  const url =
    `${USDA}?api_key=${encodeURIComponent(key.trim() || 'DEMO_KEY')}&query=${encodeURIComponent(query)}` +
    `&dataType=${encodeURIComponent('Foundation,SR Legacy,Survey (FNDDS)')}&pageSize=15`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (res.status === 429) throw new Error(key.trim() ? 'Too many searches. Try again in an hour.' : 'Search limit reached for today. Add your own free key below for more.');
    if (res.status === 403) throw new Error('The USDA key was refused. Check it, or clear it to use the shared one.');
    if (!res.ok) throw new Error(`The food search failed (${res.status}). Try again, or type the meal.`);
    return parseUsda(await res.json());
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('The search took too long. Check your internet, or type the meal.');
    if (e instanceof TypeError) throw new Error('No internet. Type the meal instead.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
