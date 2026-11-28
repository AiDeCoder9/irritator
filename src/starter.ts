import Storage from 'expo-sqlite/kv-store';
import notifee, { AlarmType, AndroidImportance, AndroidVisibility, TriggerType } from 'react-native-notify-kit';

import { reminderEvents, type Starter, starterDefaults } from './starterCore';

export * from './starterCore';

const KEY = 'irritator.starter.v1';
const CHANNEL = 'irritator-move';
const IDS = Array.from({ length: 12 }, (_, i) => `move-${i}`);
const END = 'move-end';

export function loadStarter(): Starter {
  try {
    const raw = Storage.getItemSync(KEY);
    return raw ? { ...starterDefaults, ...JSON.parse(raw) } : starterDefaults;
  } catch {
    return starterDefaults;
  }
}

export function updateStarter(fn: (s: Starter) => Starter): Starter {
  const next = fn(loadStarter());
  try {
    Storage.setItemSync(KEY, JSON.stringify(next));
  } catch {
    // Never crash a screen over storage.
  }
  return next;
}

async function channel() {
  await notifee.createChannel({ id: CHANNEL, name: 'Move reminders', importance: AndroidImportance.DEFAULT, visibility: AndroidVisibility.PUBLIC });
}

/** Cancels old move reminders and schedules the next three days. Safe to call any time, and after every finished walk. */
export async function rescheduleStarter(): Promise<void> {
  for (const id of IDS) await notifee.cancelNotification(id);
  const st = loadStarter();
  const events = reminderEvents(st, Date.now()).slice(0, IDS.length);
  if (!events.length) return;
  await channel();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    await notifee.createTriggerNotification(
      {
        id: IDS[i],
        title: e.late ? 'Still time to move' : 'Time for your walk',
        body: e.late ? 'A short walk is enough. Open the app and start the timer.' : 'A few minutes counts. Open the app and start the timer.',
        data: { route: 'move' },
        android: { channelId: CHANNEL, pressAction: { id: 'default' } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: e.ts, alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE } },
    );
  }
}

/** A notification when the walk timer ends. */
export async function notifyWalkEnd(endsAt: number): Promise<void> {
  await channel();
  await notifee.createTriggerNotification(
    {
      id: END,
      title: 'Walk time is up',
      body: 'Open the app and tap Finish.',
      data: { route: 'move' },
      android: { channelId: CHANNEL, pressAction: { id: 'default' } },
    },
    { type: TriggerType.TIMESTAMP, timestamp: endsAt, alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE } },
  );
}

export async function cancelWalkEnd(): Promise<void> {
  await notifee.cancelNotification(END);
}
