import { BigShouldersDisplay_900Black } from '@expo-google-fonts/big-shoulders-display';
import {
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

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
import { phaseOf } from './src/phase';
import {
  ClearedScreen,
  CountdownScreen,
  RingingScreen,
  SetupScreen,
  TakeoverScreen,
} from './src/screens';
import { loadState, saveState, State } from './src/store';
import { color } from './src/theme';
import { useNow } from './src/ui';

export default function App() {
  const [fontsLoaded] = useFonts({
    BigShouldersDisplay_900Black,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });
  const [state, setState] = useState<State>(loadState);
  const [notes, setNotes] = useState<string[]>([]);
  const now = useNow(1000);

  useEffect(() => {
    ensureChannels().catch(() => {});
  }, []);

  const update = useCallback((patch: Partial<State>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      saveState(next);
      return next;
    });
  }, []);

  // Wraps a notification action so a failure shows up on screen instead of crashing.
  const run = useCallback(
    async (fn: () => Promise<Partial<State> | void>) => {
      try {
        const patch = await fn();
        if (patch) update(patch);
      } catch (e) {
        setNotes([`Something went wrong: ${e instanceof Error ? e.message : String(e)}`]);
      }
    },
    [update],
  );

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: color.concrete }} />;
  }

  const phase = phaseOf(state, now);
  const dark = phase === 'takeover' || phase === 'cleared';

  const onSet = () =>
    run(async () => {
      const missing = await ensurePermissions();
      setNotes(missing);
      return scheduleAlarm(state);
    });

  const onTest = () =>
    run(async () => {
      const missing = await ensurePermissions();
      setNotes(missing);
      return scheduleAlarm(state, Date.now() + 30_000);
    });

  let screen;
  switch (phase) {
    case 'ringing':
      screen = <RingingScreen now={now} onDismiss={() => run(() => dismissAlarm(state))} />;
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
      screen = <ClearedScreen s={state} onClose={() => run(() => closeToday(state))} />;
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
    </View>
  );
}
