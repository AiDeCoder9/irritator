// Weekly review: the last 7 finished days in one place, with one good thing and one thing to work on. Pure logic.
import { ymd, type DayEntry } from './progressCore';
import type { WeightEntry } from './weightCore';

const DAY = 86_400_000;

export type ReviewInput = {
  now: number;
  history: DayEntry[];
  /** Which weekdays have an alarm, indexed like Date.getDay(). */
  days: boolean[];
  streak: number;
  waterTotalOn: (ts: number) => number;
  waterGoalOn: (ts: number) => number;
  kcalOn: (ts: number) => number;
  kcalTargetOn: (ts: number) => number;
  weightLog: WeightEntry[];
};

export type Review = {
  /** Local dates covered, oldest first. Today is not included, because it is not finished. */
  from: string;
  to: string;
  gymScheduled: number;
  gymDone: number;
  runs: number;
  waterDays: number;
  foodLogged: number;
  foodClose: number;
  avgKcal: number | null;
  weightChange: number | null;
  streak: number;
  hasData: boolean;
  good: string | null;
  focus: string | null;
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function weekReview(i: ReviewInput): Review {
  const stamps: number[] = [];
  for (let k = 7; k >= 1; k--) stamps.push(i.now - k * DAY);
  const dates = stamps.map(ymd);
  const entries = new Map(i.history.map((e) => [e.date, e]));

  let gymScheduled = 0;
  let gymDone = 0;
  let runs = 0;
  let waterDays = 0;
  let foodLogged = 0;
  let foodClose = 0;
  let kcalSum = 0;
  stamps.forEach((ts, idx) => {
    const e = entries.get(dates[idx]);
    if (e && e.result !== 'excused') gymScheduled++;
    else if (!e && i.days[new Date(ts).getDay()]) gymScheduled++;
    if (e?.result === 'done') {
      gymDone++;
      if (e.kind === 'run') runs++;
    }
    if (i.waterTotalOn(ts) >= i.waterGoalOn(ts)) waterDays++;
    const kcal = i.kcalOn(ts);
    if (kcal > 0) {
      foodLogged++;
      kcalSum += kcal;
      const target = i.kcalTargetOn(ts);
      if (kcal >= target * 0.85 && kcal <= target * 1.1) foodClose++;
    }
  });

  const w = i.weightLog.filter((x) => x.t >= i.now - 8 * DAY && x.t <= i.now).sort((a, b) => a.t - b.t);
  const weightChange = w.length >= 2 ? Math.round((w[w.length - 1].kg - w[0].kg) * 10) / 10 : null;

  const hasData = gymScheduled > 0 || waterDays > 0 || foodLogged > 0;

  // One good thing and one thing to work on, from the areas that have something to count.
  type Area = { name: string; ratio: number; good: string; focus: string };
  const areas: Area[] = [];
  if (gymScheduled > 0) {
    areas.push({
      name: 'gym',
      ratio: gymDone / gymScheduled,
      good: `You showed up ${gymDone} of ${plural(gymScheduled, 'day')}${runs ? `, including ${plural(runs, 'run')}` : ''}`,
      focus: `Training was ${gymDone} of ${gymScheduled}. Pick the one day that keeps slipping and plan it`,
    });
  }
  areas.push({
    name: 'water',
    ratio: waterDays / 7,
    good: `You hit your water goal on ${plural(waterDays, 'day')}`,
    focus: `Water goal was hit on ${waterDays} of 7 days. A drink when you wake up is the easiest fix`,
  });
  areas.push({
    name: 'food',
    ratio: foodLogged / 7,
    good: `You logged food on ${plural(foodLogged, 'day')}`,
    focus: `Food was logged on ${foodLogged} of 7 days. Logging even one meal a day keeps the plan honest`,
  });

  let good: string | null = null;
  let focus: string | null = null;
  if (hasData) {
    const sorted = [...areas].sort((a, b) => b.ratio - a.ratio);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.ratio >= 0.6) good = best.good;
    if (worst.ratio < 0.7 && worst !== best) focus = worst.focus;
  }

  return {
    from: dates[0],
    to: dates[6],
    gymScheduled,
    gymDone,
    runs,
    waterDays,
    foodLogged,
    foodClose,
    avgKcal: foodLogged ? Math.round(kcalSum / foodLogged) : null,
    weightChange,
    streak: i.streak,
    hasData,
    good,
    focus,
  };
}
