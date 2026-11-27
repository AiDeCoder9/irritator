import {
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { Sora_800ExtraBold } from '@expo-google-fonts/sora';
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
  excuseToday,
  ensureChannels,
  ensurePermissions,
  openBatterySettings,
  scheduleAlarm,
  skipToday,
} from './src/alarm';
import { checkAtGym, distanceM, HOME_LEFT_M, quietPlace } from './src/gym';
import { Onboarding } from './src/onboarding';
import { kindOf } from './src/kinds';
import { isMissed, phaseOf } from './src/phase';
import { rescheduleBedtime, sleepLine } from './src/sleep';
import {
  ClearedScreen,
  CountdownScreen,
  ExcuseScreen,
  OnWayScreen,
  PlacesScreen,
  RingingScreen,
  RunDoneScreen,
  ScheduleScreen,
  SettingsScreen,
  TakeoverScreen,
  TodayScreen,
} from './src/screens';
import { loadState, saveState, State } from './src/store';
import { color, font } from './src/theme';
import { FadeIn, TabBar, topInset, useNow } from './src/ui';
import { HealthScreen } from './src/healthScreens';
import { findRecentRun, runSummary } from './src/health';
import { AddMealScreen, FastingScreen, FoodScreen, PlanScreen, TargetsScreen, useFood } from './src/foodScreens';
import { dayTypeOf, Meal, targetFor, totalsOf } from './src/food';
import { ProgressScreen } from './src/progressScreen';
import { bumpsFor, goalOf, setWeight } from './src/waterCore';
import { ymd } from './src/progressCore';
import { weekReview } from './src/reviewCore';
import { ReviewScreen } from './src/reviewScreen';
import { suggestedRestKcal } from './src/food';
import { useWater, WaterScreen, WaterSettingsScreen } from './src/waterScreens';

type Route = 'today' | 'food' | 'addMeal' | 'fasting' | 'targets' | 'plan' | 'health' | 'water' | 'progress' | 'review' | 'waterSettings' | 'settings' | 'schedule' | 'places';

function message(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Sora_800ExtraBold,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });
  const [state, setState] = useState<State>(loadState);
  const [notes, setNotes] = useState<string[]>([]);
  const [route, setRoute] = useState<Route>('today');
  const [from, setFrom] = useState<Route>('settings');
  // Errors show on every screen, so a failure can never happen silently.
  const [error, setError] = useState<string | null>(null);
  // Plain messages (like "you're too far") are not bugs, so they get their own banner text.
  const [notice, setNotice] = useState<string | null>(null);
  const [setup, setSetup] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [excusing, setExcusing] = useState(false);
  const [runDone, setRunDone] = useState(false);
  // Remember what today was, so the cleared screen can say "run" after the next alarm is set.
  const [wasRun, setWasRun] = useState(false);
  const checking = useRef(false);
  const now = useNow(1000);
  const water = useWater();
  const food = useFood();
  const [editMeal, setEditMeal] = useState<Meal | null>(null);
  const foodToday = totalsOf(food.f, now);
  const foodTarget = targetFor(food.f.targets, water.w.weightKg, dayTypeOf(state.days, state.kinds, now));
  const foodDay = { gym: 'Gym day', run: 'Run day', rest: 'Rest day' }[dayTypeOf(state.days, state.kinds, now)];
  const missing = useRef(false);

  // Bedtime reminders follow the alarm. Redo them whenever the alarm, days or sleep hours change.
  const bedKey = JSON.stringify([state.sleep, state.alarmHour, state.alarmMinute, state.dayTimes, state.days, state.alarmAt]);
  useEffect(() => {
    rescheduleBedtime(state).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedKey]);

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

  // Copy the week plan into the water goal bumps, so the notification handler can know today's goal with the app closed.
  const bumps = bumpsFor(state.days, state.kinds);
  const bumpsKey = bumps.join(',');
  const savedBumps = (water.w.bumps ?? []).join(',');
  const changeWater = water.change;
  useEffect(() => {
    if (bumpsKey !== savedBumps) changeWater((x) => ({ ...x, bumps: bumpsKey.split(',').map(Number) }));
  }, [bumpsKey, savedBumps, changeWater]);

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
    return <View style={{ flex: 1, backgroundColor: color.black }} />;
  }

  const phase = phaseOf(state, now);
  // Yellow screens need dark status bar icons. Everything else is black.
  const yellowScreen = !skipping && !excusing && !runDone && ['countdown', 'late', 'onway'].includes(phase);
  const idle = phase === 'idle' || phase === 'waiting';
  const showTabs = idle && state.onboarded && !setup && (route === 'today' || route === 'settings' || route === 'water' || route === 'progress' || route === 'food');
  const go = (r: Route, back: Route) => {
    setFrom(back);
    setRoute(r);
  };

  const turnOn = () =>
    run(async () => {
      setNotes(await ensurePermissions());
      return scheduleAlarm(state);
    });

  const onToggle = () => (state.alarmAt != null ? run(() => cancelAlarm()) : turnOn());

  // Changing the time or days while the alarm is on moves the alarm right away.
  const onChange = (patch: Partial<State>) => {
    update(patch);
    if (state.alarmAt != null && ('alarmHour' in patch || 'alarmMinute' in patch || 'days' in patch || 'dayTimes' in patch)) {
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
  const verifiedCheckIn = async (note?: string) => {
    // Run days ask for one line about the run first.
    if (kindOf(state) === 'run' && note == null) {
      setRunDone(true);
      return;
    }
    if (checking.current) return;
    checking.current = true;
    try {
      const r = await checkAtGym(state);
      if (!r.ok) {
        setNotice(r.message);
        return;
      }
      setWasRun(kindOf(state) === 'run');
      await run(() => checkIn(state, note));
      setSkipping(false);
      setRunDone(false);
    } catch (e) {
      setError(`Could not check your location: ${message(e)}`);
    } finally {
      checking.current = false;
    }
  };

  const excuse = (why: string) =>
    run(async () => {
      setExcusing(false);
      setSkipping(false);
      return excuseToday(state, why);
    });

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
          onCheckIn={() => verifiedCheckIn()}
          onExcuse={() => setExcusing(true)}
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
          onCheckIn={() => verifiedCheckIn()}
          onSkip={() => setSkipping(true)}
          onExcuse={() => setExcusing(true)}
          onPickGym={(id) => update({ activeGymId: id })}
        />
      );
      break;
    case 'onway':
      screen = skipping ? (
        <TakeoverScreen
          s={state}
          now={now}
          onCheckIn={() => verifiedCheckIn()}
          onExcuse={() => setExcusing(true)}
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
          onCheckIn={() => verifiedCheckIn()}
          onSkip={() => setSkipping(true)}
          onExcuse={() => setExcusing(true)}
          onPickGym={(id) => update({ activeGymId: id })}
        />
      );
      break;
    case 'takeover':
      screen = (
        <TakeoverScreen
          s={state}
          now={now}
          onCheckIn={() => verifiedCheckIn()}
          onExcuse={() => setExcusing(true)}
          onSkip={() => run(() => skipToday(state))}
        />
      );
      break;
    case 'cleared':
      screen = <ClearedScreen s={state} wasRun={wasRun} onClose={() => run(() => closeToday())} />;
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
      ) : route === 'settings' ? (
        <SettingsScreen
          s={state}
          onChange={update}
          onSchedule={() => go('schedule', 'settings')}
          onPlaces={() => go('places', 'settings')}
          onSetup={() => setSetup(true)}
          onBattery={() => run(async () => openBatterySettings())}
          onHealth={() => setRoute('health')}
        />
      ) : route === 'health' ? (
        <HealthScreen onBack={() => setRoute('settings')} />
      ) : route === 'food' ? (
        <FoodScreen
          api={food}
          now={now}
          onAdd={() => {
            setEditMeal(null);
            setRoute('addMeal');
          }}
          onEdit={(m) => {
            setEditMeal(m);
            setRoute('addMeal');
          }}
          onFasting={() => setRoute('fasting')}
          onTargets={() => setRoute('targets')}
          onPlan={() => setRoute('plan')}
          weightKg={water.w.weightKg}
          days={state.days}
          kinds={state.kinds}
        />
      ) : route === 'addMeal' ? (
        <AddMealScreen key={editMeal?.id ?? 'new'} api={food} initial={editMeal} onDone={() => setRoute('food')} />
      ) : route === 'plan' ? (
        <PlanScreen
          api={food}
          now={now}
          weightKg={water.w.weightKg}
          days={state.days}
          kinds={state.kinds}
          onBack={() => setRoute('food')}
          onAdd={() => {
            setEditMeal(null);
            setRoute('addMeal');
          }}
        />
      ) : route === 'targets' ? (
        <TargetsScreen api={food} weightKg={water.w.weightKg} onBack={() => setRoute('food')} />
      ) : route === 'fasting' ? (
        <FastingScreen api={food} onBack={() => setRoute('food')} />
      ) : route === 'review' ? (
        <ReviewScreen
          onBack={() => setRoute('progress')}
          r={weekReview({
            now,
            history: state.history,
            days: state.days,
            streak: state.streak,
            waterTotalOn: (ts) => water.w.drinks.filter((d) => ymd(d.t) === ymd(ts)).reduce((a, d) => a + d.ml, 0),
            waterGoalOn: (ts) => goalOf(water.w, ts),
            kcalOn: (ts) => food.f.meals.filter((m) => ymd(m.t) === ymd(ts)).reduce((a, m) => a + m.kcal, 0),
            kcalTargetOn: (ts) => targetFor(food.f.targets, water.w.weightKg, dayTypeOf(state.days, state.kinds, ts)).kcal,
            weightLog: water.w.weightLog,
          })}
        />
      ) : route === 'progress' ? (
        <ProgressScreen
          s={state}
          water={water.w}
          now={now}
          targets={food.f.targets}
          onReview={() => setRoute('review')}
          onLogWeight={(kg) => water.change((x) => setWeight(x, kg))}
          onApply={(delta) =>
            food.change((f) => {
              const rest = f.targets.restKcal ?? suggestedRestKcal(f.targets.goal, water.w.weightKg, f.targets);
              return { ...f, targets: { ...f.targets, restKcal: delta ? rest + delta : f.targets.restKcal, lastAdjust: Date.now() } };
            })
          }
        />
      ) : route === 'water' ? (
        <WaterScreen api={water} now={now} onSettings={() => setRoute('waterSettings')} />
      ) : route === 'waterSettings' ? (
        <WaterSettingsScreen api={water} onBack={() => setRoute('water')} />
      ) : route === 'schedule' ? (
        <ScheduleScreen s={state} onChange={onChange} onBack={() => setRoute(from)} backLabel={from === 'today' ? 'Today' : 'Settings'} />
      ) : route === 'places' ? (
        <PlacesScreen s={state} onChange={update} onBack={() => setRoute(from)} backLabel={from === 'today' ? 'Today' : 'Settings'} />
      ) : (
        <TodayScreen
          s={state}
          now={now}
          notes={notes}
          onToggle={onToggle}
          onTest={onTest}
          onSchedule={() => go('schedule', 'today')}
          onPlaces={() => go('places', 'today')}
          food={{ eaten: foodToday.kcal, target: foodTarget.kcal, day: foodDay }}
          onFood={() => setRoute('food')}
          sleepText={sleepLine(state, now)}
        />
      );
  }

  const working = ['countdown', 'late', 'onway', 'takeover'].includes(phase);
  if (working && excusing) screen = <ExcuseScreen onExcuse={excuse} onBack={() => setExcusing(false)} />;
  else if (working && runDone) screen = <RunDoneScreen
      onSave={(note) => verifiedCheckIn(note)}
      onBack={() => setRunDone(false)}
      onFind={async () => {
        const r = await findRecentRun();
        return 'run' in r ? { summary: runSummary(r.run) } : r;
      }}
    />;

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <StatusBar style={yellowScreen ? 'dark' : 'light'} />
      <View style={{ flex: 1 }}>
        <FadeIn key={`${phase}-${skipping}-${excusing}-${runDone}-${route}-${setup || !state.onboarded}`}>{screen}</FadeIn>
      </View>
      {showTabs ? <TabBar active={route as 'today' | 'food' | 'water' | 'progress' | 'settings'} onTab={(r) => setRoute(r)} /> : null}
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
            backgroundColor: color.surface2,
            borderWidth: 1.5,
            borderColor: color.yellow,
            borderRadius: 18,
            padding: 16,
          }}
        >
          <Text style={{ fontFamily: font.semibold, fontSize: 15, lineHeight: 21, color: color.text }}>
            {error ?? notice}
          </Text>
          <Text style={{ fontFamily: font.body, fontSize: 14, color: color.text2, marginTop: 6 }}>
            {error ? 'Tap to dismiss. Send this message to Claude.' : 'Tap to dismiss.'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
