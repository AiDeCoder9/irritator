// Pure water logic: goal, totals and the reminder plan. No storage, no notifications, so it can be tested alone.
const MIN = 60_000;
const DEFAULT_GOAL_ML = 2500;
export const MAX_IDS = 16;
export const REPEAT_EVERY_MIN = 15;
export const REPEAT_TIMES = 3;

export type Drink = { t: number; ml: number };

export type Water = {
  enabled: boolean;
  /** Body weight in kg. Null until the user enters it. */
  weightKg: number | null;
  /** One entry per day the weight was set, newest last. Feeds the progress screen later. */
  weightLog: { t: number; kg: number }[];
  /** A goal you typed yourself. Null means use the suggested one. */
  customGoalMl: number | null;
  container: 'bottle' | 'glass';
  sizeMl: number;
  startHour: number;
  endHour: number;
  intervalMin: number;
  /** Remind again every 15 minutes, up to 3 times, until you log. */
  repeat: boolean;
  drinks: Drink[];
  /** Last time a drink was logged from a notification. Proves the background path works. */
  lastFromNotification: number | null;
};

export const waterDefaults: Water = {
  enabled: true,
  weightKg: null,
  weightLog: [],
  customGoalMl: null,
  container: 'bottle',
  sizeMl: 500,
  startHour: 8,
  endHour: 21,
  intervalMin: 90,
  repeat: false,
  drinks: [],
  lastFromNotification: null,
};

/* ---------- goal ---------- */

/** About 35 ml per kg per day (common range 30 to 40), rounded to 50 ml. 2.5 L until a weight is set. */
export function suggestedGoal(weightKg: number | null): number {
  if (weightKg == null) return DEFAULT_GOAL_ML;
  return Math.round((weightKg * 35) / 50) * 50;
}

export const goalOf = (w: Water) => w.customGoalMl ?? suggestedGoal(w.weightKg);

export function setWeight(w: Water, kg: number, now = Date.now()): Water {
  const v = Math.min(250, Math.max(30, Math.round(kg)));
  const today = new Date(now).toDateString();
  const log = w.weightLog.filter((e) => new Date(e.t).toDateString() !== today);
  return { ...w, weightKg: v, weightLog: [...log, { t: now, kg: v }] };
}

/* ---------- today ---------- */

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const todaysDrinks = (w: Water, now = Date.now()) => w.drinks.filter((d) => d.t >= startOfDay(now));
export const totalOf = (w: Water, now = Date.now()) => todaysDrinks(w, now).reduce((a, d) => a + d.ml, 0);

export const mlText = (ml: number) => (ml >= 1000 ? `${+(ml / 1000).toFixed(2)} L` : `${ml} ml`);

/* ---------- reminder plan (pure) ---------- */

const at = (day: Date, hour: number) => {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};

/**
 * When the next reminders should fire. The times sit on a fixed grid, so opening the app or planning again never moves them:
 * - With no drink today the grid starts at the first reminder time (default 8 AM) and steps by the interval.
 * - After a drink, the grid restarts from that drink: the next reminder is one interval later.
 * - Stops for today once the goal is reached. Tomorrow starts again at the first reminder time.
 */
export function planReminders(w: Water, now = Date.now(), maxIds = MAX_IDS): number[] {
  if (!w.enabled) return [];
  const step = w.intervalMin * MIN;
  const today = todaysDrinks(w, now);
  const lastToday = today.length ? today[today.length - 1].t : null;
  const done = totalOf(w, now) >= goalOf(w);

  const out: number[] = [];
  for (let offset = done ? 1 : 0; offset < 4 && out.length < maxIds; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    const open = at(day, w.startHour);
    const close = at(day, w.endHour);
    let t = offset === 0 && lastToday != null ? lastToday + step : open;
    for (; t <= close && out.length < maxIds; t += step) {
      if (t <= now + 30_000) continue;
      out.push(t);
      if (w.repeat) {
        for (let i = 1; i <= REPEAT_TIMES && out.length < maxIds; i++) {
          const r = t + i * REPEAT_EVERY_MIN * MIN;
          if (r <= close) out.push(r);
        }
      }
    }
  }
  return out;
}
