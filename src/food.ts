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

/* ---------- Open Food Facts search ---------- */

export type Hit = { name: string; brand: string; kcal100: number; protein100: number | null };

/**
 * Packaged foods from Open Food Facts (free, no key). Search is limited to 10 requests a minute, so search on a button, not while typing.
 * It does not know home cooking like dal or rice: those are typed by hand and saved to your meals.
 */
export async function searchFoods(query: string): Promise<Hit[]> {
  const url =
    'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=15&fields=product_name,brands,nutriments&search_terms=' +
    encodeURIComponent(query);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10_000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'IRRITATOR/0.1 (https://github.com/AiDeCoder9/irritator)' }, signal: ctl.signal });
    if (!res.ok) throw new Error(`The food database said ${res.status}. Type the meal by hand instead.`);
    const json = (await res.json()) as { products?: { product_name?: string; brands?: string; nutriments?: Record<string, number | string> }[] };
    const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
    const hits: Hit[] = [];
    for (const p of json.products ?? []) {
      const n = p.nutriments ?? {};
      const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) != null ? Math.round(num(n['energy_100g'])! / 4.184) : null);
      if (!p.product_name?.trim() || kcal == null) continue;
      hits.push({ name: p.product_name.trim(), brand: (p.brands ?? '').split(',')[0].trim(), kcal100: Math.round(kcal), protein100: num(n['proteins_100g']) });
    }
    return hits;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('The food database is slow right now. Try again, or type the meal by hand.');
    if (e instanceof TypeError) throw new Error('Could not reach the food database. Check your connection, or type the meal by hand.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
