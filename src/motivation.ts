import { travelOf } from './gym';
import { kindOf } from './kinds';
import type { State } from './store';

export const MESSAGE_EVERY_MIN = 5;

type Ctx = { day: number; streak: number; reason: string; travelMin: number };

/** Strongest last. Mixes encouragement and hard truths. Past the end it keeps cycling the last three. */
const LADDER: ((c: Ctx) => string)[] = [
  (c) => `Day ${c.day} is yours if you stand up right now. Feet on the floor. Phone down.`,
  () => 'Every minute on your phone is a minute your body loses to who you were before.',
  (c) =>
    c.streak > 0
      ? `${c.streak} days in a row. You already proved you're someone who goes. Don't prove otherwise today.`
      : 'You can start the streak today. It takes one decision, and you can make it now.',
  () => 'Strength fades the longer you stay put. Your body is deciding today which way it goes.',
  (c) => `The gym is ${c.travelMin} minutes away. In ${c.travelMin} minutes the hard part is already over.`,
  () => "You won't feel like going. You never will. Nobody fit waited to feel like it.",
  (c) => `You wrote: "${c.reason}" This is the exact moment that decides if you meant it.`,
  () => 'Scrolling will not build the body you want. Standing up will.',
  () => 'Tomorrow you will wish you went today. So go today.',
];

/** The same ladder for run days. No gym, no travel time. */
const RUN_LADDER: ((c: Ctx) => string)[] = [
  (c) => `Day ${c.day} is yours if you stand up right now. Shoes on. Phone down.`,
  () => 'Every minute on your phone is a minute the run gets harder to start.',
  (c) =>
    c.streak > 0
      ? `${c.streak} days in a row. You already proved you're someone who runs. Don't prove otherwise today.`
      : 'You can start the streak today. It takes one decision, and you can make it now.',
  () => 'The first ten minutes are the only hard part. After that your legs take over.',
  () => 'The door is the first finish line. Open it, and the run has started.',
  () => "You won't feel like running. You never will. Nobody who ran today waited to feel like it.",
  (c) => `You wrote: "${c.reason}" This is the exact moment that decides if you meant it.`,
  () => 'The run will not get shorter tomorrow. It will only get later.',
  () => 'Tomorrow you will wish you went today. So go today.',
];

export function levelAt(dismissedAt: number, ts: number) {
  return Math.max(0, Math.floor((ts - dismissedAt) / (MESSAGE_EVERY_MIN * 60_000)));
}

export function messageFor(level: number, s: State) {
  const ladder = kindOf(s) === 'run' ? RUN_LADDER : LADDER;
  const i = level < ladder.length ? level : ladder.length - 3 + ((level - ladder.length) % 3);
  return ladder[i]({ day: s.streak + 1, streak: s.streak, reason: s.reason, travelMin: travelOf(s) });
}
