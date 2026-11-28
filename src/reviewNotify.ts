import notifee, { AlarmType, AndroidImportance, AndroidVisibility, TriggerType } from 'react-native-notify-kit';

import { nextSundays } from './reviewCore';

const CHANNEL = 'irritator-review';
const IDS = ['review-0', 'review-1', 'review-2', 'review-3'];

/** Schedules the next four Sunday-evening review reminders, or removes them when switched off. Safe to call any time. */
export async function rescheduleReview(enabled: boolean, now = Date.now()): Promise<void> {
  for (const id of IDS) await notifee.cancelNotification(id);
  if (!enabled) return;
  await notifee.createChannel({ id: CHANNEL, name: 'Weekly review', importance: AndroidImportance.DEFAULT, visibility: AndroidVisibility.PUBLIC });
  const times = nextSundays(now, IDS.length);
  for (let i = 0; i < times.length; i++) {
    await notifee.createTriggerNotification(
      {
        id: IDS[i],
        title: 'Your week is ready',
        body: 'See what went well and what to work on.',
        data: { route: 'review' },
        android: { channelId: CHANNEL, pressAction: { id: 'default' } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: times[i], alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE } },
    );
  }
}
