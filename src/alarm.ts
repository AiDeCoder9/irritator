import { Platform } from 'react-native';
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

import { levelAt, messageFor, MESSAGE_EVERY_MIN } from './motivation';
import { nextOccurrence } from './phase';
import { addEntry } from './progressCore';
import type { State } from './store';
import { TAKEOVER_AFTER_MIN } from './theme';

const MIN = 60_000;

const CH = {
  alarm: 'irritator-alarm',
  nag: 'irritator-nag',
  quiet: 'irritator-quiet',
  takeover: 'irritator-takeover',
};

const NAG_IDS = [
  'nag-takeover',
  ...Array.from({ length: 16 }, (_, i) => `nag-${i + 1}`),
  // Older builds used these.
  'nag-half',
  'nag-leave',
  'nag-late-1',
  'nag-late-2',
  'nag-late-3',
];

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

  // The rest is Android only: iOS has no alarm permission.
  if (Platform.OS !== 'android') return missing;
  const settings = await notifee.getNotificationSettings();
  if (settings.android.alarm !== AndroidNotificationSetting.ENABLED) {
    missing.push('Turn on "Alarms & reminders" for IRRITATOR, then come back and press the button again.');
    await notifee.openAlarmPermissionSettings();
  }

  return missing;
}

export async function openBatterySettings() {
  if (Platform.OS !== 'android') return;
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

  return { alarmAt, dismissedAt: null, checkedInAt: null, leftHomeAt: null };
}

export async function cancelAlarm(): Promise<Partial<State>> {
  await notifee.cancelNotification('alarm');
  await cancelNags();
  return { alarmAt: null, dismissedAt: null, checkedInAt: null, leftHomeAt: null };
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

  const takeoverAt = leaveBy + TAKEOVER_AFTER_MIN * MIN;
  const plan: { id: string; ts: number; title: string; body: string; channel: string; loud: boolean; full?: boolean }[] = [];

  // A message every 5 minutes, each stronger than the last. The first one is on the countdown screen itself.
  for (let k = 1; s.dismissedAt + k * MESSAGE_EVERY_MIN * MIN < takeoverAt; k++) {
    const ts = s.dismissedAt + k * MESSAGE_EVERY_MIN * MIN;
    const left = Math.round((leaveBy - ts) / MIN);
    plan.push({
      id: `nag-${k}`,
      ts,
      title: left > 0 ? `${left} min left to leave` : left === 0 ? 'Time to leave' : `${-left} min late`,
      body: messageFor(levelAt(s.dismissedAt, ts), s),
      channel: ts < leaveBy ? CH.quiet : CH.nag,
      loud: ts >= leaveBy,
    });
  }
  plan.push({
    id: 'nag-takeover',
    ts: takeoverAt,
    title: `Day ${day} starts at the gym.`,
    body: messageFor(levelAt(s.dismissedAt, takeoverAt), s),
    channel: CH.takeover,
    loud: true,
    full: true,
  });

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
  const streak = s.streak + 1;
  return {
    ...next,
    checkedInAt: Date.now(),
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    history: addEntry(s.history, s.alarmAt ?? Date.now(), 'done'),
  };
}

/** Skipping (or missing the day) resets the streak and sets up the next alarm. */
export async function skipToday(s: State): Promise<Partial<State>> {
  await cancelNags();
  const next = await scheduleAlarm(s);
  return { ...next, streak: 0, history: addEntry(s.history, s.alarmAt ?? Date.now(), 'skipped') };
}

/** Hides the cleared screen. The next alarm is already scheduled. */
export async function closeToday(): Promise<Partial<State>> {
  return { checkedInAt: null };
}
