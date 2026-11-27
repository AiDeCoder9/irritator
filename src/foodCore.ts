// Pure food logic: meals, totals, fasting window, scaling. No storage and no network, so it can be tested alone.

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
export type Food = { meals: Meal[]; saved: Saved[]; fast: Fast; fdcKey: string };

export const EAT_HOURS = [8, 10, 12];

export const foodDefaults: Food = {
  meals: [],
  saved: [],
  fdcKey: '',
  fast: { enabled: false, openHour: 12, openMinute: 0, eatHours: 8, notify: true },
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
