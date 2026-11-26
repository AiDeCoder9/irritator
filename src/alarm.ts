import notifee, {
  AlarmType,
  AndroidCategory,
  AndroidImportance,
  AndroidNotificationSetting,
  AndroidVisibility,
  AuthorizationStatus,
  TimestampTrigger,
  TriggerType,
} from 'react-native-notify-kit';

import { nextOccurrence } from './phase';
import type { State } from './store';
import { TAKEOVER_AFTER_MIN } from './theme';

const MIN = 60_000;

const CH = {
  alarm: 'irritator-alarm',
  nag: 'irritator-nag',
  quiet: 'irritator-quiet',
  takeover: 'irritator-takeover',
};

const NAG_IDS = ['nag-half', 'nag-leave', 'nag-late-1', 'nag-late-2', 'nag-late-3', 'nag-takeover'];

export async function ensureChannels() {
  await notifee.createChannel({
    id: CH.alarm,
    name: 'Alarm',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
    visibility: AndroidVisibility.PUBLIC,
  });
  await notifee.createChannel({
    id: CH.nag,
    name: 'Nags',
    importance: AndroidImportance.HIGH,
    vibration: true,
    visibility: AndroidVisibility.PUBLIC,
  });
  await notifee.createChannel({
    id: CH.quiet,
    name: 'Quiet reminders',
    importance: AndroidImportance.DEFAULT,
  });
  await notifee.createChannel({
    id: CH.takeover,
    name: 'Motivation screen',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
    visibility: AndroidVisibility.PUBLIC,
  });
}

/** Returns a list of things the user still has to allow. Empty means ready. */
export async function ensurePermissions(): Promise<string[]> {
  const missing: string[] = [];

  const perm = await notifee.requestPermission();
  if (perm.authorizationStatus === AuthorizationStatus.DENIED) {
    missing.push('Allow notifications for IRRITATOR in system settings.');
  }

  const settings = await notifee.getNotificationSettings();
  if (settings.android.alarm !== AndroidNotificationSetting.ENABLED) {
    missing.push('Turn on "Alarms & reminders" for IRRITATOR, then come back and press the button again.');
    await notifee.openAlarmPermissionSettings();
  }

  return missing;
}

export async function openBatterySettings() {
  if (await notifee.isBatteryOptimizationEnabled()) {
    await notifee.openBatteryOptimizationSettings();
    return;
  }
  const info = await notifee.getPowerManagerInfo();
  if (info.activity) {
    await notifee.openPowerManagerSettings();
  }
}

function at(timestamp: number, strong = false): TimestampTrigger {
  return {
    type: TriggerType.TIMESTAMP,
    timestamp,
    alarmManager: {
      type: strong ? AlarmType.SET_ALARM_CLOCK : AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE,
    },
  };
}

/** Schedules the alarm itself. Our app owns the alarm so we know exactly when it is dismissed. */
export async function scheduleAlarm(s: State, whenMs?: number): Promise<Partial<State>> {
  await ensureChannels();
  await cancelNags();
  await notifee.cancelNotification('alarm');

  const alarmAt = whenMs ?? nextOccurrence(s.alarmHour, s.alarmMinute, s.days);

  await notifee.createTriggerNotification(
    {
      id: 'alarm',
      title: 'Time to get up',
      body: 'Open the app and dismiss the alarm to start your countdown.',
      android: {
        channelId: CH.alarm,
        category: AndroidCategory.ALARM,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        ongoing: true,
        autoCancel: false,
        loopSound: true,
        pressAction: { id: 'default' },
        fullScreenAction: { id: 'default' },
      },
    },
    at(alarmAt, true),
  );

  return { alarmAt, dismissedAt: null, checkedInAt: null };
}

export async function cancelAlarm(): Promise<Partial<State>> {
  await notifee.cancelNotification('alarm');
  await cancelNags();
  return { alarmAt: null, dismissedAt: null, checkedInAt: null };
}

/** Stops the ringing and schedules the escalating nags. The caller saves dismissedAt first, so the countdown always starts. */
export async function dismissAlarm(s: State & { dismissedAt: number }): Promise<void> {
  try {
    await notifee.cancelNotification('alarm');
  } catch {
    // The alarm notification may already be gone.
  }
  await scheduleNags(s);
}

async function scheduleNags(s: State & { dismissedAt: number }) {
  await ensureChannels();
  await cancelNags();

  const total = s.countdownMin * MIN;
  const leaveBy = s.dismissedAt + total;
  const day = s.streak + 1;
  const now = Date.now();

  const plan: { id: string; ts: number; title: string; body: string; channel: string; loud: boolean; full?: boolean }[] = [
    {
      id: 'nag-half',
      ts: s.dismissedAt + total / 2,
      title: 'Half your time is gone',
      body: `You have ${Math.round(s.countdownMin / 2)} minutes left to get out the door.`,
      channel: CH.quiet,
      loud: false,
    },
    {
      id: 'nag-leave',
      ts: leaveBy,
      title: 'Time to leave',
      body: 'Shoes on. Out the door now.',
      channel: CH.nag,
      loud: true,
    },
    {
      id: 'nag-late-1',
      ts: leaveBy + 3 * MIN,
      title: "You're 3 minutes late",
      body: 'Every minute you wait makes it easier to skip.',
      channel: CH.nag,
      loud: true,
    },
    {
      id: 'nag-late-2',
      ts: leaveBy + 6 * MIN,
      title: "You're 6 minutes late",
      body: `Day ${day} is still yours. Go now.`,
      channel: CH.nag,
      loud: true,
    },
    {
      id: 'nag-late-3',
      ts: leaveBy + 9 * MIN,
      title: "You're 9 minutes late",
      body: 'The next one fills your screen.',
      channel: CH.nag,
      loud: true,
    },
    {
      id: 'nag-takeover',
      ts: leaveBy + TAKEOVER_AFTER_MIN * MIN,
      title: `Day ${day} starts at the gym.`,
      body: s.reason,
      channel: CH.takeover,
      loud: true,
      full: true,
    },
  ];

  for (const n of plan) {
    if (n.ts <= now + 1000) continue;
    await notifee.createTriggerNotification(
      {
        id: n.id,
        title: n.title,
        body: n.body,
        android: {
          channelId: n.channel,
          importance: n.loud ? AndroidImportance.HIGH : AndroidImportance.DEFAULT,
          visibility: AndroidVisibility.PUBLIC,
          pressAction: { id: 'default' },
          // The library throws on optional fields set to undefined, so add them only when needed.
          ...(n.full
            ? { category: AndroidCategory.ALARM, loopSound: true, fullScreenAction: { id: 'default' } }
            : {}),
        },
      },
      at(n.ts),
    );
  }
}

export async function cancelNags() {
  for (const id of NAG_IDS) {
    await notifee.cancelNotification(id);
  }
}

/** Test stand-in until gym check-in (location plus steps) exists. Schedules the next alarm straight away. */
export async function checkIn(s: State): Promise<Partial<State>> {
  await cancelNags();
  const next = await scheduleAlarm(s);
  return { ...next, checkedInAt: Date.now(), streak: s.streak + 1 };
}

/** Skipping (or missing the day) resets the streak and sets up the next alarm. */
export async function skipToday(s: State): Promise<Partial<State>> {
  await cancelNags();
  const next = await scheduleAlarm(s);
  return { ...next, streak: 0 };
}

/** Hides the cleared screen. The next alarm is already scheduled. */
export async function closeToday(): Promise<Partial<State>> {
  return { checkedInAt: null };
}
