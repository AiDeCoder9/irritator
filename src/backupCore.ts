// Backup and restore: one block of text holding everything saved on the phone. Pure logic, no storage.

export type Parts = { state: Record<string, unknown>; water: Record<string, unknown>; food: Record<string, unknown>; starter: Record<string, unknown> | null };

export const BACKUP_VERSION = 1;

/** Fields that only make sense on the phone and moment they were saved. A restore clears them so nothing stale rings. */
const TRANSIENT = ['alarmAt', 'dismissedAt', 'checkedInAt', 'leftHomeAt', 'verify'] as const;

/** The backup text. The USDA key is left out so it is not shared by accident. */
export function makeBackup(p: Parts, now: number): string {
  const { fdcKey: _key, ...food } = p.food as Record<string, unknown> & { fdcKey?: unknown };
  return JSON.stringify({ app: 'irritator', v: BACKUP_VERSION, at: now, state: p.state, water: p.water, food, starter: p.starter });
}

export type Parsed = { ok: true; parts: Parts; at: number; lines: string[] } | { ok: false; message: string };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const count = (x: unknown) => (Array.isArray(x) ? x.length : 0);

/** Checks pasted text. Extra words around the backup (from a chat app) are ignored. */
export function parseBackup(text: string): Parsed {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return { ok: false, message: 'That does not look like a backup. Paste the whole text you shared.' };
  let j: unknown;
  try {
    j = JSON.parse(text.slice(a, b + 1));
  } catch {
    return { ok: false, message: 'The backup text is cut off or changed. Paste the whole text again.' };
  }
  if (!isObj(j) || j.app !== 'irritator') return { ok: false, message: 'This is not an IRRITATOR backup.' };
  if (j.v !== BACKUP_VERSION) return { ok: false, message: 'This backup is from a different version of the app and cannot be read.' };
  if (typeof j.at !== 'number') return { ok: false, message: 'The backup has no date, so it may be damaged.' };
  const { state, water, food, starter } = j;
  if (!isObj(state) || !Array.isArray(state.days) || state.days.length !== 7 || !Array.isArray(state.history)) return { ok: false, message: 'The schedule and history in this backup are damaged.' };
  if (!isObj(water) || !isObj(food) || !Array.isArray(food.meals)) return { ok: false, message: 'The water or food data in this backup is damaged.' };
  const cleaned: Record<string, unknown> = { ...state };
  for (const k of TRANSIENT) cleaned[k] = null;
  const parts: Parts = { state: cleaned, water, food, starter: isObj(starter) ? starter : null };
  const lines = [
    `${count(state.history)} gym days in your history`,
    `${count(food.meals)} meals and ${count(water.drinks)} drinks from the last 30 days`,
    ...(parts.starter ? [`${count(parts.starter.log)} Starter walks`] : []),
  ];
  return { ok: true, parts, at: j.at, lines };
}
