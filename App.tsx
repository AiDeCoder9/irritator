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
  cancelNags,
  checkIn,
  closeToday,
  dismissAlarm,
  ensureChannels,
  ensurePermissions,
  openBatterySettings,
  scheduleAlarm,
  skipToday,
} from './src/alarm';
import { checkAtGym, distanceM, HOME_LEFT_M, quietPlace } from './src/gym';
import { Onboarding } from './src/onboarding';
import { isMissed, phaseOf } from './src/phase';
import {
  ClearedScreen,
  CountdownScreen,
  HomeScreen,
  OnWayScreen,
  RingingScreen,
  SettingsScreen,
  TakeoverScreen,
} from './src/screens';
import { loadState, saveState, State } from './src/store';
import { color, font } from './src/theme';
import { FadeIn, topInset, useNow } from './src/ui';

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
  const [showSettings, setShowSettings] = useState(false);
  // Errors show on every screen, so a failure can never happen silently.
  const [error, setError] = useState<string | null>(null);
  // Plain messages (like "you're too far") are not bugs, so they get their own banner text.
  const [notice, setNotice] = useState<string | null>(null);
  const [setup, setSetup] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const checking = useRef(false);
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

  // While the countdown is on and a home is saved, look for you leaving. Foreground only: the app is open on this screen.
  const watching = state.home != null && ['countdown', 'late', 'takeover'].includes(phaseOf(state, now));
  useEffect(() => {
    if (!watching) return;
    let alive = true;
    const home = state.home!;
    const look = async () => {
      try {
        const here = await quietPlace();
        if (!alive || !here) return;
        if (distanceM(here, home) > HOME_LEFT_M) {
          await cancelNags();
          if (alive) update({ leftHomeAt: Date.now() });
        }
      } catch {
        // A missed reading is fine. The next one is 15 seconds away.
      }
    };
    look();
    const id = setInterval(look, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [watching, state.home, update]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: color.concrete }} />;
  }

  const phase = phaseOf(state, now);
  const dark =
    phase === 'takeover' || phase === 'cleared' || (skipping && ['countdown', 'late', 'onway'].includes(phase));

  const turnOn = () =>
    run(async () => {
      setNotes(await ensurePermissions());
      return scheduleAlarm(state);
    });

  const onToggle = () => (state.alarmAt != null ? run(() => cancelAlarm()) : turnOn());

  // Changing the time or days while the alarm is on moves the alarm right away.
  const onChange = (patch: Partial<State>) => {
    update(patch);
    if (state.alarmAt != null && ('alarmHour' in patch || 'alarmMinute' in patch || 'days' in patch)) {
      run(() => scheduleAlarm({ ...state, ...patch }));
    }
  };

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

  // Check-in only counts when you are at the gym (unless the check is switched off in Settings).
  const verifiedCheckIn = async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const r = await checkAtGym(state);
      if (!r.ok) {
        setNotice(r.message);
        return;
      }
      await run(() => checkIn(state));
      setSkipping(false);
    } catch (e) {
      setError(`Could not check your location: ${message(e)}`);
    } finally {
      checking.current = false;
    }
  };

  const finishSetup = () =>
    run(async () => {
      const patch = await scheduleAlarm(state);
      setSetup(false);
      return { ...patch, onboarded: true };
    });

  let screen;
  switch (phase) {
    case 'ringing':
      screen = <RingingScreen s={state} now={now} onDismiss={onDismiss} />;
      break;
    case 'countdown':
    case 'late':
      screen = skipping ? (
        <TakeoverScreen
          s={state}
          now={now}
          onCheckIn={verifiedCheckIn}
          onSkip={() =>
            run(async () => {
              setSkipping(false);
              return skipToday(state);
            })
          }
          onBack={() => setSkipping(false)}
        />
      ) : (
        <CountdownScreen
          s={state}
          now={now}
          onCheckIn={verifiedCheckIn}
          onSkip={() => setSkipping(true)}
          onPickGym={(id) => update({ activeGymId: id })}
        />
      );
      break;
    case 'onway':
      screen = skipping ? (
        <TakeoverScreen
          s={state}
          now={now}
          onCheckIn={verifiedCheckIn}
          onSkip={() =>
            run(async () => {
              setSkipping(false);
              return skipToday(state);
            })
          }
          onBack={() => setSkipping(false)}
        />
      ) : (
        <OnWayScreen
          s={state}
          now={now}
          onCheckIn={verifiedCheckIn}
          onSkip={() => setSkipping(true)}
          onPickGym={(id) => update({ activeGymId: id })}
        />
      );
      break;
    case 'takeover':
      screen = (
        <TakeoverScreen
          s={state}
          now={now}
          onCheckIn={verifiedCheckIn}
          onSkip={() => run(() => skipToday(state))}
        />
      );
      break;
    case 'cleared':
      screen = <ClearedScreen s={state} onClose={() => run(() => closeToday())} />;
      break;
    default:
      screen = !state.onboarded || setup ? (
        <Onboarding
          s={state}
          onChange={update}
          onPermissions={ensurePermissions}
          onBattery={() => run(async () => openBatterySettings())}
          onFinish={finishSetup}
          onSkip={() => {
            update({ onboarded: true });
            setSetup(false);
          }}
        />
      ) : showSettings ? (
        <SettingsScreen
          s={state}
          onChange={update}
          onBack={() => setShowSettings(false)}
          onSetup={() => {
            setShowSettings(false);
            setSetup(true);
          }}
          onBattery={() => run(async () => openBatterySettings())}
        />
      ) : (
        <HomeScreen
          s={state}
          now={now}
          notes={notes}
          onChange={onChange}
          onToggle={onToggle}
          onTest={onTest}
          onSettings={() => setShowSettings(true)}
        />
      );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <FadeIn key={`${phase}-${skipping}-${showSettings}-${setup || !state.onboarded}`}>{screen}</FadeIn>
      {error || notice ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss error"
          onPress={() => {
            setError(null);
            setNotice(null);
          }}
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
            {error ?? notice}
          </Text>
          <Text style={{ fontFamily: font.body, fontSize: 14, color: color.iron, marginTop: 6 }}>
            {error ? 'Tap to dismiss. Send this message to Claude.' : 'Tap to dismiss.'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
