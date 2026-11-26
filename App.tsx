import { BigShouldersDisplay_900Black } from '@expo-google-fonts/big-shoulders-display';
import {
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  cancelAlarm,
  checkIn,
  closeToday,
  dismissAlarm,
  ensureChannels,
  ensurePermissions,
  openBatterySettings,
  scheduleAlarm,
  skipToday,
} from './src/alarm';
import { isMissed, phaseOf } from './src/phase';
import {
  ClearedScreen,
  CountdownScreen,
  RingingScreen,
  SetupScreen,
  TakeoverScreen,
} from './src/screens';
import { loadState, saveState, State } from './src/store';
import { color, font } from './src/theme';
import { topInset, useNow } from './src/ui';

function message(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function App() {
  const [fontsLoaded] = useFonts({
    BigShouldersDisplay_900Black,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });
  const [state, setState] = useState<State>(loadState);
  const [notes, setNotes] = useState<string[]>([]);
  // Errors show on every screen, so a failure can never happen silently.
  const [error, setError] = useState<string | null>(null);
  const now = useNow(1000);
  const missing = useRef(false);

  useEffect(() => {
    ensureChannels().catch((e) => setError(`Could not create notification channels: ${message(e)}`));
  }, []);

  const update = useCallback((patch: Partial<State>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      saveState(next);
      return next;
    });
  }, []);

  const run = useCallback(
    async (fn: () => Promise<Partial<State> | void>) => {
      try {
        const patch = await fn();
        if (patch) update(patch);
      } catch (e) {
        setError(`Something went wrong: ${message(e)}`);
      }
    },
    [update],
  );

  // If the day was missed completely (no check-in long after leave-by), reset the streak and set the next alarm.
  useEffect(() => {
    if (!isMissed(state, now) || missing.current) return;
    missing.current = true;
    run(() => skipToday(state)).finally(() => {
      missing.current = false;
    });
  }, [now, state, run]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: color.concrete }} />;
  }

  const phase = phaseOf(state, now);
  const dark = phase === 'takeover' || phase === 'cleared';

  const onSet = () =>
    run(async () => {
      setNotes(await ensurePermissions());
      return scheduleAlarm(state);
    });

  const onTest = () =>
    run(async () => {
      setNotes(await ensurePermissions());
      return scheduleAlarm(state, Date.now() + 30_000);
    });

  // Start the countdown first, so it always starts. Then try to schedule the reminders.
  const onDismiss = async () => {
    const dismissedAt = Date.now();
    update({ dismissedAt });
    try {
      await dismissAlarm({ ...state, dismissedAt });
    } catch (e) {
      setError(`Countdown started, but the reminders could not be scheduled: ${message(e)}`);
    }
  };

  let screen;
  switch (phase) {
    case 'ringing':
      screen = <RingingScreen now={now} onDismiss={onDismiss} />;
      break;
    case 'countdown':
    case 'late':
      screen = <CountdownScreen s={state} now={now} onCheckIn={() => run(() => checkIn(state))} />;
      break;
    case 'takeover':
      screen = (
        <TakeoverScreen
          s={state}
          now={now}
          onCheckIn={() => run(() => checkIn(state))}
          onSkip={() => run(() => skipToday(state))}
        />
      );
      break;
    case 'cleared':
      screen = <ClearedScreen s={state} onClose={() => run(() => closeToday())} />;
      break;
    default:
      screen = (
        <SetupScreen
          s={state}
          now={now}
          notes={notes}
          onChange={update}
          onSet={onSet}
          onTest={onTest}
          onCancel={() => run(() => cancelAlarm())}
          onBattery={() => run(async () => openBatterySettings())}
        />
      );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {screen}
      {error ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss error"
          onPress={() => setError(null)}
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: topInset,
            backgroundColor: color.white,
            borderWidth: 2,
            borderColor: color.graphite,
            borderRadius: 12,
            padding: 14,
          }}
        >
          <Text style={{ fontFamily: font.semibold, fontSize: 15, lineHeight: 21, color: color.graphite }}>
            {error}
          </Text>
          <Text style={{ fontFamily: font.body, fontSize: 14, color: color.iron, marginTop: 6 }}>
            Tap to dismiss. Send this message to Claude.
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
