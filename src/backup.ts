import Storage from 'expo-sqlite/kv-store';

import { makeBackup, type Parts } from './backupCore';

export * from './backupCore';

const KEYS = { state: 'irritator.state.v1', water: 'irritator.water.v1', food: 'irritator.food.v1', starter: 'irritator.starter.v1' } as const;

const read = (key: string): Record<string, unknown> | null => {
  try {
    const raw = Storage.getItemSync(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** The backup text for what is saved on this phone right now. */
export function backupText(now = Date.now()): string {
  return makeBackup({ state: read(KEYS.state) ?? {}, water: read(KEYS.water) ?? {}, food: read(KEYS.food) ?? {}, starter: read(KEYS.starter) }, now);
}

/** Replaces what is saved with the backup. The food key stays as it was on this phone. The app must reload after. */
export function applyBackup(p: Parts): void {
  const keepKey = read(KEYS.food)?.fdcKey;
  Storage.setItemSync(KEYS.state, JSON.stringify(p.state));
  Storage.setItemSync(KEYS.water, JSON.stringify(p.water));
  Storage.setItemSync(KEYS.food, JSON.stringify(typeof keepKey === 'string' ? { ...p.food, fdcKey: keepKey } : p.food));
  if (p.starter) Storage.setItemSync(KEYS.starter, JSON.stringify(p.starter));
}
