// Pure food logic: meals, totals, fasting window, scaling. No storage and no network, so it can be tested alone.

import type { HealthFlag } from './goalCore';

export type Meal = { id: string; t: number; name: string; kcal: number; protein: number | null };
export type Saved = { id: string; name: string; kcal: number; protein: number | null };
export type Fast = {
  enabled: boolean;
  /** When the eating window opens each day. */
  openHour: number;
  openMinute: number;
  /** Hours you may eat. Only 8, 10 or 12 are offered: a 16, 14 or 12 hour fast. */
  eatHours: number;
  /** Notify when the window opens and closes. */
  notify: boolean;
};
export type Goal = 'lose' | 'maintain' | 'build';
export type Sex = 'male' | 'female';
export type Targets = {
  goal: Goal;
  /** Optional details that make the estimate better. All can stay empty. */
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  /** Your own rest-day calories. null means use the estimate from weight and goal. */
  restKcal: number | null;
  /** When the weight-trend suggestion was last answered. Only weigh-ins after this count toward the next one. */
  lastAdjust: number | null;
  /** Goal weight in kg for a goal date. null means none. */
  goalKg: number | null;
  /** Health conditions chosen in the safety questions. */
  health: HealthFlag[];
  /** True once the safety questions were answered (including "none of these"). */
  healthAsked: boolean;
  /** The goal you committed to. Cleared when the goal weight changes. */
  commit: { at: number; goalKg: number } | null;
};
/** Meal reminders at times you choose, in minutes after midnight. */
export type Remind = { enabled: boolean; times: number[] };
export type Food = { meals: Meal[]; saved: Saved[]; fast: Fast; fdcKey: string; targets: Targets; remind: Remind };

export const EAT_HOURS = [8, 10, 12];
export const MAX_MEAL_TIMES = 5;
export const DEFAULT_MEAL_TIMES = [8 * 60, 13 * 60, 20 * 60];

export const foodDefaults: Food = {
  meals: [],
  saved: [],
  fdcKey: '',
  targets: { goal: 'maintain', sex: null, age: null, heightCm: null, restKcal: null, lastAdjust: null, goalKg: null, health: [], healthAsked: false, commit: null },
  fast: { enabled: false, openHour: 12, openMinute: 0, eatHours: 8, notify: true },
  remind: { enabled: false, times: DEFAULT_MEAL_TIMES },
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const todaysMeals = (f: Food, now = Date.now()) => f.meals.filter((m) => m.t >= startOfDay(now)).sort((a, b) => a.t - b.t);

export function totalsOf(f: Food, now = Date.now()) {
  const meals = todaysMeals(f, now);
  return {
    kcal: meals.reduce((a, m) => a + m.kcal, 0),
    protein: Math.round(meals.reduce((a, m) => a + (m.protein ?? 0), 0)),
    count: meals.length,
  };
}

/** "420", "420.5" and "420,5" all work. Returns null for empty, negative or not a number. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Nutrients for an amount in grams, from per-100g values. */
export function scaleFor(per100: { kcal: number; protein: number | null }, grams: number) {
  const k = grams / 100;
  return {
    kcal: Math.round(per100.kcal * k),
    protein: per100.protein == null ? null : Math.round(per100.protein * k * 10) / 10,
  };
}

/** Checks a meal before saving. Returns a plain message, or null when fine. */
export function mealProblem(name: string, kcal: number | null, protein: number | null): string | null {
  if (name.trim().length < 2) return 'Type what you ate.';
  if (kcal == null) return 'Type the calories. A rough number is fine, and you can change it later.';
  if (kcal > 5000) return 'That is a lot for one meal. Check the calories.';
  if (protein != null && protein > 300) return 'Check the protein. That is over 300 g.';
  return null;
}

/* ---------- fasting ---------- */

export type FastState = {
  eating: boolean;
  /** When the current phase (eating or fasting) began. */
  since: number;
  /** When it ends. */
  changeAt: number;
  /** 0 to 1 through the current phase. */
  progress: number;
};

/** Whether you are inside the eating window right now, and when that changes. Derived from the clock only. */
export function fastState(f: Fast, now = Date.now()): FastState {
  const eat = f.eatHours * HOUR;
  const open = new Date(now);
  open.setHours(f.openHour, f.openMinute, 0, 0);
  const todayOpen = open.getTime();
  let eating: boolean;
  let since: number;
  let changeAt: number;
  if (now >= todayOpen && now < todayOpen + eat) {
    eating = true;
    since = todayOpen;
    changeAt = todayOpen + eat;
  } else if (now >= todayOpen + eat) {
    eating = false;
    since = todayOpen + eat;
    changeAt = todayOpen + DAY;
  } else {
    // Before today's window. A window that began yesterday may still be open.
    const yOpen = todayOpen - DAY;
    if (now < yOpen + eat) {
      eating = true;
      since = yOpen;
      changeAt = yOpen + eat;
    } else {
      eating = false;
      since = yOpen + eat;
      changeAt = todayOpen;
    }
  }
  return { eating, since, changeAt, progress: Math.min(1, Math.max(0, (now - since) / (changeAt - since))) };
}

/** Times of the next window opens and closes, for notifications. */
export function fastEvents(f: Fast, now = Date.now(), days = 3): { ts: number; opens: boolean }[] {
  const eat = f.eatHours * HOUR;
  const out: { ts: number; opens: boolean }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(f.openHour, f.openMinute, 0, 0);
    const open = d.getTime();
    if (open > now + 5000) out.push({ ts: open, opens: true });
    if (open + eat > now + 5000) out.push({ ts: open + eat, opens: false });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

/** 5h 20m style. */
export function hm(ms: number) {
  const total = Math.max(0, Math.round(ms / MIN));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h === 0 ? `${m}m` : `${h}h ${String(m).padStart(2, '0')}m`;
}

/** One search result, values per 100 g. */
export type Hit = { name: string; kcal100: number; protein100: number | null };

type UsdaNutrient = { nutrientNumber?: string; nutrientId?: number; unitName?: string; value?: number };
type UsdaFood = { description?: string; foodNutrients?: UsdaNutrient[] };

/** Reads the USDA FoodData Central search answer. Skips foods that have no calorie value. */
export function parseUsda(json: unknown): Hit[] {
  const foods = (json as { foods?: UsdaFood[] } | null)?.foods;
  if (!Array.isArray(foods)) return [];
  const out: Hit[] = [];
  for (const f of foods) {
    const ns = f.foodNutrients ?? [];
    const num = (n: UsdaNutrient) => n.nutrientNumber ?? String(n.nutrientId ?? '');
    // 208 is Energy. Some newer foods only carry the Atwater energy values (957, 958).
    const energy = ['208', '957', '958']
      .map((code) => ns.find((n) => num(n) === code && (n.unitName ?? 'KCAL').toUpperCase() === 'KCAL' && typeof n.value === 'number'))
      .find(Boolean);
    const prot = ns.find((n) => num(n) === '203' && typeof n.value === 'number');
    if (!f.description || !energy) continue;
    out.push({
      name: tidy(f.description),
      kcal100: Math.round(energy.value as number),
      protein100: prot ? Math.round((prot.value as number) * 10) / 10 : null,
    });
  }
  return out;
}

/** "CHICKEN, BROILER, BREAST" becomes "Chicken, broiler, breast". */
export function tidy(s: string): string {
  const t = s.trim();
  if (t === t.toUpperCase()) return t.charAt(0) + t.slice(1).toLowerCase();
  return t;
}

/* ---------- daily targets that follow the training week ---------- */

export type DayType = 'gym' | 'run' | 'rest';

export const GOAL_LABEL: Record<Goal, string> = { lose: 'Lose fat', maintain: 'Stay the same', build: 'Build muscle' };
/** Calories added to or taken from the estimate for each goal. Small on purpose. */
export const GOAL_KCAL: Record<Goal, number> = { lose: -300, maintain: 0, build: 250 };
/** Extra calories on training days, on top of a rest day. */
export const DAY_KCAL: Record<DayType, number> = { gym: 150, run: 250, rest: 0 };
/** Protein in grams per kg of body weight. */
export const GOAL_PROTEIN: Record<Goal, number> = { lose: 1.8, maintain: 1.4, build: 1.8 };
/** The estimate never suggests less than this. */
export const MIN_KCAL = 1500;
export const DEFAULT_KCAL = 2200;

/** Rest-day activity multiplier. Training days add their own calories on top, so this is a light everyday level. */
export const REST_ACTIVITY = 1.4;

type Profile = Pick<Targets, 'sex' | 'age' | 'heightCm'>;

/** True when age, height and weight are all known, so the better formula can be used. */
export const hasProfile = (weightKg: number | null, p?: Profile) => weightKg != null && p?.age != null && p?.heightCm != null;

/**
 * A rough rest-day maintenance estimate. With age, height and weight it uses the Mifflin-St Jeor formula times a light activity level.
 * Without them it uses about 31 kcal per kg. Rounded to the nearest 50. A guess, not a measurement.
 */
export function maintenanceKcal(weightKg: number | null, p?: Profile): number {
  if (weightKg == null) return DEFAULT_KCAL;
  if (p && hasProfile(weightKg, p)) {
    // Sex constant: +5 male, -161 female, about -78 (the middle) when not given.
    const c = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
    const bmr = 10 * weightKg + 6.25 * (p.heightCm as number) - 5 * (p.age as number) + c;
    return Math.round((bmr * REST_ACTIVITY) / 50) * 50;
  }
  return Math.round((weightKg * 31) / 50) * 50;
}

/** Under 18 the goal adjustment is skipped: calorie goals for growing people should come from a doctor. */
export const isMinor = (p?: Profile) => p?.age != null && p.age < 18;

/** The estimated rest-day calories for a goal, before any override. */
export function suggestedRestKcal(goal: Goal, weightKg: number | null, p?: Profile): number {
  const delta = isMinor(p) ? 0 : GOAL_KCAL[goal];
  return Math.max(MIN_KCAL, maintenanceKcal(weightKg, p) + delta);
}

/** What kind of day it is: a gym or run day when the alarm is on that weekday, otherwise rest. */
export function dayTypeOf(days: boolean[], kinds: ('gym' | 'run')[], ts: number): DayType {
  const d = new Date(ts).getDay();
  return !days[d] ? 'rest' : kinds[d] === 'run' ? 'run' : 'gym';
}

/** Calories and protein for one day. Your own rest-day number is always respected. */
export function targetFor(t: Targets, weightKg: number | null, day: DayType) {
  const rest = t.restKcal ?? suggestedRestKcal(t.goal, weightKg, t);
  return {
    rest,
    kcal: rest + DAY_KCAL[day],
    protein: weightKg == null ? null : Math.round((weightKg * GOAL_PROTEIN[t.goal]) / 5) * 5,
  };
}

/* ---------- meal plan: week budget, meal slots, suggestions ---------- */

export type PlanDay = {
  /** Start of that day, as a time. */
  t: number;
  type: DayType;
  target: number;
  eaten: number;
  /** past, today or ahead */
  when: 'past' | 'today' | 'ahead';
};

/** The Monday-to-Sunday week that contains `now`, with each day's target and what was eaten. */
export function weekPlan(f: Food, weightKg: number | null, days: boolean[], kinds: ('gym' | 'run')[], now: number) {
  const today = startOfDay(now);
  const sinceMonday = (new Date(now).getDay() + 6) % 7;
  const list: PlanDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - sinceMonday + i);
    const t = d.getTime();
    const type = dayTypeOf(days, kinds, t + 12 * HOUR);
    list.push({
      t,
      type,
      target: targetFor(f.targets, weightKg, type).kcal,
      eaten: f.meals.filter((m) => m.t >= t && m.t < startOfDay(t + 36 * HOUR)).reduce((a, m) => a + m.kcal, 0),
      when: t < today ? 'past' : t === today ? 'today' : 'ahead',
    });
  }
  const budget = list.reduce((a, d) => a + d.target, 0);
  // Days that are over are not forgiven, and days that are under are not rolled forward: only today and later share what is left.
  const eatenSoFar = list.filter((d) => d.when !== 'ahead').reduce((a, d) => a + d.eaten, 0);
  const open = list.filter((d) => d.when !== 'past');
  const openTarget = open.reduce((a, d) => a + d.target, 0);
  return { days: list, budget, eatenSoFar, openTarget, openCount: open.length };
}

export type Slot = { name: string; share: number };

/** How a day's food is split. With fasting on, two meals and a snack fit the window. */
export function slotsFor(fastEnabled: boolean): Slot[] {
  return fastEnabled
    ? [
        { name: 'First meal', share: 0.4 },
        { name: 'Second meal', share: 0.45 },
        { name: 'Snack', share: 0.15 },
      ]
    : [
        { name: 'Breakfast', share: 0.27 },
        { name: 'Lunch', share: 0.33 },
        { name: 'Dinner', share: 0.3 },
        { name: 'Snack', share: 0.1 },
      ];
}

/**
 * About how much the next meal should be: what is left today, shared across the meals not yet eaten.
 * Never less than 0. The meals eaten count against the slots, so a late start is not squeezed into one big meal.
 */
export function nextMealBudget(targetKcal: number, targetProtein: number | null, eaten: { kcal: number; protein: number; count: number }, slotCount: number) {
  const slotsLeft = Math.max(1, slotCount - eaten.count);
  return {
    kcal: Math.max(0, Math.round((targetKcal - eaten.kcal) / slotsLeft / 10) * 10),
    protein: targetProtein == null ? null : Math.max(0, Math.round((targetProtein - eaten.protein) / slotsLeft)),
    slotsLeft,
    leftKcal: targetKcal - eaten.kcal,
  };
}

/** Saved meals that fit the budget best: closest calories without going more than 15% over, then more protein. Up to `n`. */
export function suggestMeals(saved: Saved[], budgetKcal: number, n = 3): Saved[] {
  if (budgetKcal <= 0) return [];
  return saved
    .filter((s) => s.kcal <= budgetKcal * 1.15)
    .sort((a, b) => Math.abs(a.kcal - budgetKcal) - Math.abs(b.kcal - budgetKcal) || (b.protein ?? 0) - (a.protein ?? 0))
    .slice(0, n);
}


/* ---------- Past meals and meal reminders ---------- */

export type Recent = { name: string; kcal: number; protein: number | null; last: number };

/** Every meal you have logged or saved, newest first, one line per name. Used for one-tap logging. */
export function recentMeals(f: Pick<Food, 'meals' | 'saved'>, limit = 40): Recent[] {
  const seen = new Set<string>();
  const out: Recent[] = [];
  for (const m of [...f.meals].sort((a, b) => b.t - a.t)) {
    const k = m.name.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name: m.name, kcal: m.kcal, protein: m.protein, last: m.t });
  }
  for (const m of f.saved) {
    const k = m.name.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name: m.name, kcal: m.kcal, protein: m.protein, last: 0 });
  }
  return out.slice(0, limit);
}

/** A meal time today (or on the day of `base`) as a timestamp. */
export function atMinutes(base: number, minutes: number): number {
  const d = new Date(base);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.getTime();
}

export type MealEvent = { ts: number; late: boolean };
const LATE_AFTER = 30 * MIN;
const JUST_ATE = 60 * MIN;

/**
 * The next meal reminders. One at each meal time, and one follow-up 30 minutes later.
 * Skipped when a meal was already logged in the hour before the reminder (or between the reminder and now),
 * so it never nags after you ate. Returns nothing when reminders are off.
 */
export function mealReminderEvents(r: Remind, meals: Meal[], now: number, days = 3): MealEvent[] {
  if (!r.enabled) return [];
  const out: MealEvent[] = [];
  const times = [...r.times].sort((a, b) => a - b).slice(0, MAX_MEAL_TIMES);
  for (let d = 0; d < days; d++) {
    const base = now + d * DAY;
    for (const m of times) {
      const at = atMinutes(base, m);
      const ate = meals.some((x) => x.t >= at - JUST_ATE && x.t <= Math.max(now, at));
      if (ate) continue;
      if (at > now) out.push({ ts: at, late: false });
      if (at + LATE_AFTER > now) out.push({ ts: at + LATE_AFTER, late: true });
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}
