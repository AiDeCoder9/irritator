// Workout check: after "I'm at the gym" the day only clears once you have stayed 20 minutes and taken 100 steps.
// Pure logic so it can be tested alone.

export const VERIFY_MIN = 20;
export const VERIFY_MIN_TEST = 1; // used when "Check my location" is off, which is the testing-at-home mode
export const STEPS_MIN = 100;
/** If the steps still have not arrived this long after the timer ends, offer a location-only finish. */
export const FALLBACK_AFTER_MIN = 10;
/** A check that was started this long ago and never finished is dropped. */
export const STALE_AFTER_MIN = 180;

export type Verify = { startAt: number; gymId: string | null; minutes: number };

const MIN = 60_000;

export const endsAt = (v: Verify) => v.startAt + v.minutes * MIN;

export const isActive = (v: Verify | null | undefined, now: number): v is Verify => v != null && now - v.startAt < STALE_AFTER_MIN * MIN;

export type Judgement =
  | { ok: true; note: string }
  | { ok: false; reason: 'early' | 'left' | 'steps'; message: string; canFallback: boolean };

/**
 * Decides whether the workout counts.
 * - `steps` is null when steps cannot be read (not connected). Then the check is time plus location only.
 * - `atGym` is null when location is not being checked.
 */
export function judge(v: Verify, now: number, steps: number | null, atGym: boolean | null, fallback = false): Judgement {
  const left = endsAt(v) - now;
  if (left > 0) {
    const m = Math.ceil(left / MIN);
    return { ok: false, reason: 'early', message: `${m} more ${m === 1 ? 'minute' : 'minutes'}. Keep training.`, canFallback: false };
  }
  if (atGym === false) {
    return { ok: false, reason: 'left', message: 'You are not at the gym any more. Go back, then finish the check.', canFallback: false };
  }
  if (steps != null && steps < STEPS_MIN && !fallback) {
    const late = now - endsAt(v) >= FALLBACK_AFTER_MIN * MIN;
    return {
      ok: false,
      reason: 'steps',
      message: `${steps} of ${STEPS_MIN} steps. Keep moving, then check again. Steps can arrive a few minutes late.`,
      canFallback: late,
    };
  }
  const mins = Math.max(v.minutes, Math.floor((now - v.startAt) / MIN));
  if (steps == null) return { ok: true, note: `Checked: ${mins} min at the gym (steps not available)` };
  if (steps < STEPS_MIN) return { ok: true, note: `Checked: ${mins} min at the gym, steps not synced (${steps})` };
  return { ok: true, note: `Checked: ${mins} min at the gym, ${steps} steps` };
}

/** "14:32" until the timer ends, then "Done". */
export function timerText(v: Verify, now: number): string {
  const s = Math.max(0, Math.ceil((endsAt(v) - now) / 1000));
  if (s === 0) return 'Done';
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
