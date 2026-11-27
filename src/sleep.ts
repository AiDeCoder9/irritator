import notifee, { AlarmType, AndroidImportance, AndroidVisibility, TriggerType } from 'react-native-notify-kit';

import { bedtimes, hoursText } from './sleepCore';
import { time12 } from './phase';
import type { State } from './store';

export * from './sleepCore';

const CHANNEL = 'irritator-bedtime';
const IDS = Array.from({ length: 7 }, (_, i) => `bed-${i}`);

/** Cancels old bedtime reminders and schedules the next week from the alarm settings. Safe to call any time. */
export async function rescheduleBedtime(s: State, now = Date.now()): Promise<void> {
  await notifee.createChannel({ id: CHANNEL, name: 'Bedtime reminder', importance: AndroidImportance.DEFAULT, visibility: AndroidVisibility.PUBLIC });
  for (const id of IDS) await notifee.cancelNotification(id);
  const list = bedtimes(s, now, IDS.length);
  for (let i = 0; i < list.length; i++) {
    const a = new Date(list[i].alarmAt);
    await notifee.createTriggerNotification(
      {
        id: IDS[i],
        title: 'Bedtime',
        body: `Alarm at ${time12(a.getHours(), a.getMinutes())}. That is ${hoursText(s.sleep.hours)} of sleep if you go now.`,
        android: { channelId: CHANNEL, pressAction: { id: 'default' } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: list[i].bedAt, alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE } },
    );
  }
}
