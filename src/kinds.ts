/** What a scheduled day is. Rest days are days with the alarm off. */
export type Kind = 'gym' | 'run';

export const DEFAULT_KINDS: Kind[] = ['gym', 'gym', 'gym', 'gym', 'gym', 'gym', 'gym'];

/** The kind of the day the current alarm belongs to (or a given time). Indexed like Date.getDay(). */
export function kindOf(s: { kinds: Kind[]; alarmAt: number | null }, ts?: number): Kind {
  const day = new Date(ts ?? s.alarmAt ?? Date.now()).getDay();
  return s.kinds[day] ?? 'gym';
}
