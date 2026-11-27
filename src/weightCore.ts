// Weight trend and a gentle calorie suggestion. Pure logic, no storage.
import type { Goal } from './foodCore';

export type WeightEntry = { t: number; kg: number };
const DAY = 86_400_000;

/**
 * Weekly rate of change in kg, from a straight line through the weigh-ins in the last `windowDays`.
 * Needs at least 3 weigh-ins spread over at least 10 days, otherwise null. `since` ignores older entries (used after a change).
 */
export function weightRate(log: WeightEntry[], now: number, since = 0, windowDays = 28): { perWeek: number; n: number } | null {
  const e = log.filter((x) => x.t >= Math.max(since, now - windowDays * DAY) && x.t <= now).sort((a, b) => a.t - b.t);
  if (e.length < 3) return null;
  if ((e[e.length - 1].t - e[0].t) / DAY < 10) return null;
  const xs = e.map((x) => (x.t - e[0].t) / DAY);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = e.reduce((a, b) => a + b.kg, 0) / e.length;
  let num = 0;
  let den = 0;
  e.forEach((p, i) => {
    num += (xs[i] - mx) * (p.kg - my);
    den += (xs[i] - mx) ** 2;
  });
  if (den === 0) return null;
  return { perWeek: (num / den) * 7, n: e.length };
}

/** Change from the oldest to the newest weigh-in in the last `days` days. Null with fewer than two. */
export function weightChange(log: WeightEntry[], now: number, days = 28): number | null {
  const e = log.filter((x) => x.t >= now - days * DAY && x.t <= now).sort((a, b) => a.t - b.t);
  if (e.length < 2) return null;
  return Math.round((e[e.length - 1].kg - e[0].kg) * 10) / 10;
}

export type Nudge = {
  kind: 'none' | 'need-data' | 'ok' | 'up' | 'down';
  /** Calories to add (positive) or remove (negative) from the rest-day number. Zero unless up or down. */
  delta: number;
  perWeek: number | null;
  message: string;
};

const fmt = (kg: number) => `${Math.abs(Math.round(kg * 100) / 100)}`;

/**
 * Is the plan moving your weight the way your goal wants? Small suggestions only: 100 or 150 kcal.
 * Never for under 18, never below the calorie floor, and the caller allows one every two weeks.
 */
export function nudgeFor(opts: { goal: Goal; perWeek: number | null; weightKg: number; rest: number; floor: number; minor: boolean }): Nudge {
  const { goal, perWeek, weightKg, rest, floor, minor } = opts;
  if (minor) return { kind: 'none', delta: 0, perWeek, message: 'Under 18: calorie changes should come from a doctor, so none are suggested.' };
  if (perWeek == null) return { kind: 'need-data', delta: 0, perWeek, message: 'Weigh yourself a few times over two weeks, same time of day, and this will show whether your plan is working.' };

  const rate = perWeek;
  const pace = `about ${fmt(rate)} kg a week`;
  const ok = (extra: string): Nudge => ({ kind: 'ok', delta: 0, perWeek, message: `Your weight is moving ${pace}. ${extra}` });
  const make = (delta: number, text: string): Nudge => {
    const target = Math.max(floor, rest + delta);
    const real = target - rest;
    if (real === 0) return { kind: 'ok', delta: 0, perWeek, message: `Your weight is moving ${pace}. Your rest-day calories are already at the lowest this app suggests.` };
    return { kind: real > 0 ? 'up' : 'down', delta: real, perWeek, message: text };
  };

  const fast = weightKg * 0.01; // losing more than 1% of body weight a week is fast
  if (goal === 'lose') {
    if (rate < -fast) return make(150, `You are losing ${pace}, faster than a steady pace. Eating a little more usually helps you keep it up.`);
    if (rate > -0.1) return make(-100, `Your weight is ${rate > 0.1 ? 'going up' : 'flat'} (${pace}). A small cut may help if you have been logging your food.`);
    return ok('That fits losing fat at a steady pace.');
  }
  if (goal === 'build') {
    if (rate < 0.1) return make(150, `Your weight is ${rate < -0.1 ? 'going down' : 'flat'} (${pace}). Building muscle usually needs a little extra food.`);
    if (rate > 0.5) return make(-100, `You are gaining ${pace}, which is quick. A small cut may keep it mostly muscle.`);
    return ok('That fits building slowly.');
  }
  if (rate > 0.3) return make(-100, `Your weight is creeping up, ${pace}.`);
  if (rate < -0.3) return make(100, `Your weight is slipping down, ${pace}.`);
  return ok('That is steady.');
}
