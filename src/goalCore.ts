// Goal weight, a safe date, and health safety flags. Pure logic, no storage.
import type { Goal } from './foodCore';

export type HealthFlag = 'ed' | 'diabetes' | 'glp1' | 'heart' | 'thyroid' | 'liver' | 'cholesterol';

export const HEALTH_FLAGS: { id: HealthFlag; label: string }[] = [
  { id: 'ed', label: 'History of an eating disorder' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'glp1', label: 'GLP-1 therapy' },
  { id: 'heart', label: 'Heart disease' },
  { id: 'thyroid', label: 'Thyroid condition' },
  { id: 'liver', label: 'Fatty liver' },
  { id: 'cholesterol', label: 'High cholesterol' },
];

export type Safety = {
  /** No calorie targets, meal plan, fasting or weight goals. */
  hideFood: boolean;
  /** No weight tracking or goal date. */
  hideWeight: boolean;
  /** No calorie suggestions from the weight trend. */
  noSuggest: boolean;
  /** A plain note to show, or null. */
  notice: string | null;
};

export function safetyOf(health: HealthFlag[]): Safety {
  const has = (f: HealthFlag) => health.includes(f);
  if (has('ed')) {
    return {
      hideFood: true,
      hideWeight: true,
      noSuggest: true,
      notice: 'Calorie targets, fasting, the meal plan and weight goals are off. Gym, water and sleep still work. If this is wrong for you, change it in Health and safety.',
    };
  }
  if (has('diabetes') || has('glp1')) {
    return {
      hideFood: false,
      hideWeight: false,
      noSuggest: true,
      notice: 'Calorie numbers here are not medical advice. With diabetes or GLP-1 therapy, ask your doctor before using them. Calorie suggestions are off.',
    };
  }
  if (health.some((h) => h === 'heart' || h === 'thyroid' || h === 'liver' || h === 'cholesterol')) {
    return { hideFood: false, hideWeight: false, noSuggest: false, notice: 'Calorie numbers here are estimates, not medical advice. Ask your doctor before changing how you eat.' };
  }
  return { hideFood: false, hideWeight: false, noSuggest: false, notice: null };
}

/** Pace per week in kg. The cap is never exceeded. */
export const LOSE_PACE = 0.5;
export const MAX_LOSE = 0.75;
export const GAIN_PACE = 0.25;
export const MAX_GAIN = 0.5;
export const MIN_GOAL_KG = 40;
export const MAX_GOAL_KG = 250;
const DAY = 86_400_000;

/** Why a goal weight cannot be used, in plain words, or null when fine. */
export function goalProblem(opts: { goalKg: number; weightKg: number | null; heightCm: number | null; goal: Goal; minor: boolean }): string | null {
  const { goalKg, weightKg, heightCm, goal, minor } = opts;
  if (minor) return 'Goal dates are off under 18. Ask a doctor about weight goals.';
  if (goal === 'maintain') return 'Set your goal to lose or build first.';
  if (weightKg == null) return 'Add your weight first.';
  if (goalKg < MIN_GOAL_KG || goalKg > MAX_GOAL_KG) return `Pick a goal between ${MIN_GOAL_KG} and ${MAX_GOAL_KG} kg.`;
  if (heightCm != null) {
    const bmi = goalKg / (heightCm / 100) ** 2;
    if (bmi < 18.5) return 'That is below the healthy range for your height. Pick a higher goal.';
  }
  if (goal === 'lose' && goalKg >= weightKg) return 'Your goal is to lose weight, so pick a goal below your weight.';
  if (goal === 'build' && goalKg <= weightKg) return 'Your goal is to build, so pick a goal above your weight.';
  return null;
}

export type GoalPlan = { kind: 'reached' | 'plan'; weeks: number; date: number; perWeek: number; diffKg: number };

/** A date at a capped, steady pace. Never faster than the cap. Null when the goal is not usable. */
export function goalPlan(opts: { goalKg: number; weightKg: number; goal: Goal; now: number }): GoalPlan | null {
  const { goalKg, weightKg, goal, now } = opts;
  if (goal === 'maintain') return null;
  const diff = Math.round(Math.abs(goalKg - weightKg) * 10) / 10;
  const perWeek = goal === 'lose' ? LOSE_PACE : GAIN_PACE;
  const wrongWay = goal === 'lose' ? goalKg > weightKg : goalKg < weightKg;
  if (wrongWay) return null;
  if (diff < 0.2) return { kind: 'reached', weeks: 0, date: now, perWeek, diffKg: 0 };
  const weeks = Math.max(1, Math.ceil(diff / perWeek));
  return { kind: 'plan', weeks, date: now + weeks * 7 * DAY, perWeek, diffKg: diff };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dateText(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`}`;
}

/** How many days one skipped session pushes the date back: a week split across your sessions. */
export function skipDelayDays(sessionsPerWeek: number): number {
  return Math.max(1, Math.round(7 / Math.max(1, sessionsPerWeek)));
}

/** The line shown where you decide whether to skip. Null when there is no usable goal. */
export function goalSkipLine(plan: GoalPlan | null, goalKg: number, sessionsPerWeek: number): string | null {
  if (!plan || plan.kind !== 'plan') return null;
  const d = skipDelayDays(sessionsPerWeek);
  return `Your goal: ${goalKg} kg by ${dateText(plan.date)}. Skipping today moves it back about ${d} ${d === 1 ? 'day' : 'days'}.`;
}

/** The line for the progress card. */
export function goalLine(plan: GoalPlan | null, goalKg: number): string {
  if (!plan) return 'No usable goal yet.';
  if (plan.kind === 'reached') return `You are at ${goalKg} kg. Goal reached.`;
  return `${plan.diffKg} kg to go. About ${plan.weeks} ${plan.weeks === 1 ? 'week' : 'weeks'} at ${plan.perWeek} kg a week, by ${dateText(plan.date)}.`;
}
