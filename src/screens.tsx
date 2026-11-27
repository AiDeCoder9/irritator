import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useKeepAwake } from 'expo-keep-awake';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { clockText, DAY_NAMES, dayName, inText, leaveByOf, leftHomeOf, pad, time12, timeText } from './phase';
import { activeGym, travelOf } from './gym';
import { Places } from './places';
import { levelAt, messageFor } from './motivation';
import type { State } from './store';
import { color, font, SKIP_WAIT_SEC, TAKEOVER_AFTER_MIN } from './theme';
import { Button, Chip, Hero, Rail, Screen, Stepper, T, topInset } from './ui';

type Patch = (p: Partial<State>) => void;

const page = { paddingTop: topInset, paddingHorizontal: 28, paddingBottom: 32 } as const;

/* ---------- Home: the one screen you use every day ---------- */

export function HomeScreen({
  s,
  now,
  notes,
  onChange,
  onToggle,
  onTest,
  onSettings,
}: {
  s: State;
  now: number;
  notes: string[];
  onChange: Patch;
  onToggle: () => void;
  onTest: () => void;
  onSettings: () => void;
}) {
  const on = s.alarmAt != null;
  const [hour12, ampm] = time12(s.alarmHour, s.alarmMinute).split(' ');

  const pickTime = () => {
    const d = new Date();
    d.setHours(s.alarmHour, s.alarmMinute, 0, 0);
    DateTimePickerAndroid.open({
      value: d,
      mode: 'time',
      is24Hour: false,
      onChange: (event, picked) => {
        if (event.type === 'set' && picked) {
          onChange({ alarmHour: picked.getHours(), alarmMinute: picked.getMinutes() });
        }
      },
    });
  };

  const toggleDay = (d: number) => {
    const onlyOne = s.days[d] && s.days.filter(Boolean).length === 1;
    if (onlyOne) return;
    const next = [...s.days];
    next[d] = !next[d];
    onChange({ days: next });
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.concrete }}>
      <ScrollView contentContainerStyle={{ ...page, flexGrow: 1, gap: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T size={20} weight="bold" tint={color.graphite}>
            Day {s.streak + 1}
          </T>
          <Pressable
            accessibilityRole="button"
            onPress={onSettings}
            style={({ pressed }) => ({
              minHeight: 48,
              paddingHorizontal: 4,
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <T size={17} weight="semibold" tint={color.graphite}>
              Settings
            </T>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Alarm time ${time12(s.alarmHour, s.alarmMinute)}. Tap to change.`}
          onPress={pickTime}
          style={({ pressed }) => ({ gap: 4, transform: [{ scale: pressed ? 0.98 : 1 }] })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <Hero size={136} tint={color.graphite}>
              {hour12}
            </Hero>
            <Text style={{ fontFamily: font.display, fontSize: 44, lineHeight: 56, color: color.graphite }}>
              {ampm}
            </Text>
          </View>
          <T size={16} tint={color.iron}>
            Tap the time to change it
          </T>
        </Pressable>

        <View style={{ gap: 12 }}>
          <T size={17} weight="semibold" tint={color.graphite}>
            Repeat
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <Chip
                key={d}
                label={DAY_NAMES[d].slice(0, 2)}
                a11y={DAY_NAMES[d]}
                on={s.days[d]}
                onPress={() => toggleDay(d)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <T size={17} weight="semibold" tint={color.graphite}>
            Minutes to get out the door
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[5, 10, 15, 20, 25, 30].map((m) => (
              <Chip
                key={m}
                label={String(m)}
                a11y={`${m} minutes`}
                on={s.countdownMin === m}
                onPress={() => onChange({ countdownMin: m })}
              />
            ))}
          </View>
          <T size={15} tint={color.iron}>
            The countdown starts when you dismiss the alarm.
          </T>
        </View>

        <View style={{ flex: 1, minHeight: 8 }} />

        <View style={{ gap: 14 }}>
          {on ? (
            <View style={{ gap: 2 }}>
              <T size={20} weight="bold" tint={color.graphite}>
                Alarm is on
              </T>
              <T size={17} tint={color.iron}>
                Rings {dayName(s.alarmAt!)} at {timeText(s.alarmAt!)}, {inText(s.alarmAt! - now)}.
              </T>
            </View>
          ) : (
            <T size={20} weight="bold" tint={color.graphite}>
              Alarm is off
            </T>
          )}

          {notes.map((n) => (
            <T key={n} size={16} weight="semibold" tint={color.graphite}>
              {n}
            </T>
          ))}

          {on ? (
            <Button label="Turn alarm off" onPress={onToggle} outline={color.graphite} fg={color.graphite} />
          ) : (
            <Button label="Turn alarm on" onPress={onToggle} bg={color.graphite} fg={color.white} />
          )}

          <Pressable
            accessibilityRole="button"
            onPress={onTest}
            style={({ pressed }) => ({
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <T size={16} weight="semibold" tint={color.iron} style={{ textDecorationLine: 'underline' }}>
              Try it: ring in 30 seconds
            </T>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------- Settings: things you set once ---------- */

export function SettingsScreen({
  s,
  onChange,
  onBack,
  onBattery,
  onSetup,
}: {
  s: State;
  onChange: Patch;
  onBack: () => void;
  onBattery: () => void;
  onSetup: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: color.concrete }}>
      <ScrollView contentContainerStyle={{ ...page, gap: 28 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <T size={17} weight="semibold" tint={color.graphite}>
              Back
            </T>
          </Pressable>
          <Hero size={64} tint={color.graphite}>
            Settings
          </Hero>
        </View>

        <View style={{ gap: 10 }}>
          <T size={17} weight="semibold" tint={color.graphite}>
            Places
          </T>
          <Places s={s} onChange={onChange} />
          <Button label="Run setup again" onPress={onSetup} outline={color.graphite} fg={color.graphite} />
          <T size={17} weight="semibold" tint={color.graphite} style={{ marginTop: 8 }}>
            Check my location at check-in
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip label="On" on={s.verifyLocation} onPress={() => onChange({ verifyLocation: true })} />
            <Chip label="Off" on={!s.verifyLocation} onPress={() => onChange({ verifyLocation: false })} />
          </View>
          <T size={15} tint={color.iron}>
            Turn Off only to test at home.
          </T>
        </View>

        <View style={{ gap: 10 }}>
          <T size={17} weight="semibold" tint={color.graphite}>
            Your reason
          </T>
          <TextInput
            value={s.reason}
            onChangeText={(t) => onChange({ reason: t })}
            multiline
            style={{
              minHeight: 72,
              borderWidth: 2,
              borderColor: color.graphite,
              borderRadius: 12,
              padding: 14,
              fontFamily: font.body,
              fontSize: 17,
              color: color.graphite,
              textAlignVertical: 'top',
            }}
          />
          <T size={15} tint={color.iron}>
            Shown on the full screen when you're late.
          </T>
        </View>

        <View style={{ gap: 10 }}>
          <T size={17} weight="semibold" tint={color.graphite}>
            Days in a row
          </T>
          <Stepper
            label="days"
            value={String(s.streak)}
            atMin={s.streak <= 0}
            onDec={() => onChange({ streak: Math.max(0, s.streak - 1) })}
            onInc={() => onChange({ streak: Math.min(999, s.streak + 1) })}
          />
          <T size={15} tint={color.iron}>
            Match your real streak. Going to the gym adds one. Skipping resets it to 0.
          </T>
        </View>

        <View style={{ gap: 10 }}>
          <T size={17} weight="semibold" tint={color.graphite}>
            Keep the alarm reliable
          </T>
          <Button label="Open battery settings" onPress={onBattery} outline={color.graphite} fg={color.graphite} />
          <T size={15} tint={color.iron}>
            On Samsung: Settings, Battery, Background usage limits, Never sleeping apps, then add IRRITATOR.
          </T>
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------- Alarm ringing ---------- */

export function RingingScreen({ s, now, onDismiss }: { s: State; now: number; onDismiss: () => void }) {
  useKeepAwake();
  return (
    <Screen bg={color.concrete}>
      <View />
      <View style={{ gap: 6 }}>
        <T size={22} weight="bold" tint={color.graphite}>
          Time to get up
        </T>
        <Hero fit tint={color.graphite}>{timeText(now)}</Hero>
        <T size={19} tint={color.graphite}>
          Dismiss to start your {s.countdownMin}-minute countdown.
        </T>
      </View>
      <Button label="Dismiss alarm" onPress={onDismiss} bg={color.graphite} fg={color.white} />
    </Screen>
  );
}

/* ---------- Countdown and late (amber) ---------- */

export function CountdownScreen({
  s,
  now,
  onCheckIn,
  onSkip,
  onPickGym,
}: {
  s: State;
  now: number;
  onCheckIn: () => void;
  onSkip: () => void;
  onPickGym: (id: string) => void;
}) {
  useKeepAwake();
  const leaveBy = leaveByOf(s)!;
  const travel = travelOf(s);
  const gym = activeGym(s);
  const late = now >= leaveBy;
  const lateMin = Math.floor((now - leaveBy) / 60_000);

  return (
    <Screen bg={color.amber}>
      <View style={{ gap: 12 }}>
        <Rail stage={1} hasHome={s.home != null} leftAt={null} fmt={timeText} />
        <T size={16} weight="semibold" tint={color.graphite}>
          {late
            ? `The full screen comes at ${timeText(leaveBy + TAKEOVER_AFTER_MIN * 60_000)}.`
            : 'A new message every 5 minutes, stronger each time.'}
        </T>
      </View>

      <View style={{ gap: 6 }}>
        <T size={22} weight="bold" tint={color.graphite}>
          {late ? `${lateMin} min past ${timeText(leaveBy)}` : `Leave by ${timeText(leaveBy)}`}
        </T>
        <Hero fit size={160} tint={color.graphite}>
          {late ? clockText(now - leaveBy) : clockText(leaveBy - now)}
        </Hero>
        <T size={22} tint={color.graphite}>
          {late ? 'late.' : 'until you should be out the door.'}
        </T>
        <T size={17} weight="semibold" tint={color.graphite}>
          {s.home ? "You're still at home. " : ''}
          {`${gym ? gym.label : 'The gym'} is ${travel} min away. ${late ? 'Every minute now pushes your arrival later.' : `Leave on time and you're there by ${timeText(leaveBy + travel * 60_000)}.`}`}
        </T>
      </View>

      <View style={{ borderWidth: 2, borderColor: color.graphite, borderRadius: 14, padding: 16 }}>
        <T size={20} weight="bold" tint={color.graphite} style={{ lineHeight: 27 }}>
          {messageFor(levelAt(s.dismissedAt!, now), s)}
        </T>
      </View>

      <View style={{ gap: 14 }}>
        <GymChips s={s} onPick={onPickGym} />
        <Button label="I'm at the gym" onPress={onCheckIn} bg={color.graphite} fg={color.white} />
        <Pressable
          accessibilityRole="button"
          onPress={onSkip}
          style={({ pressed }) => ({ minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <T size={16} weight="semibold" tint={color.graphite} style={{ textDecorationLine: 'underline' }}>
            Skip today (resets your streak to 0)
          </T>
        </Pressable>
      </View>
    </Screen>
  );
}

function GymChips({ s, onPick }: { s: State; onPick: (id: string) => void }) {
  if (s.gyms.length < 2) return null;
  const current = activeGym(s)?.id;
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {s.gyms.slice(0, 3).map((g) => (
        <Chip key={g.id} label={g.label} on={g.id === current} onPress={() => onPick(g.id)} />
      ))}
    </View>
  );
}

/* ---------- On your way (after leaving home) ---------- */

export function OnWayScreen({
  s,
  now,
  onCheckIn,
  onSkip,
  onPickGym,
}: {
  s: State;
  now: number;
  onCheckIn: () => void;
  onSkip: () => void;
  onPickGym: (id: string) => void;
}) {
  useKeepAwake();
  const left = leftHomeOf(s)!;
  const gym = activeGym(s);
  const eta = left + travelOf(s) * 60_000;
  const over = now >= eta;

  return (
    <Screen bg={color.amber}>
      <Rail stage={2} hasHome leftAt={left} fmt={timeText} />

      <View style={{ gap: 6 }}>
        <T size={22} weight="bold" tint={color.graphite}>
          {`On your way to ${gym ? gym.label : 'the gym'}`}
        </T>
        <Hero fit size={160} tint={color.graphite}>
          {clockText(over ? now - eta : eta - now)}
        </Hero>
        <T size={22} tint={color.graphite}>
          {over ? 'past when you should have arrived.' : 'until you arrive.'}
        </T>
        <T size={17} weight="semibold" tint={color.graphite}>
          {`Reminders are off. Check-in unlocks within ${s.gymRadius} m.`}
        </T>
      </View>

      <View style={{ gap: 14 }}>
        <GymChips s={s} onPick={onPickGym} />
        <Button label="I'm at the gym" onPress={onCheckIn} bg={color.graphite} fg={color.white} />
        <Pressable
          accessibilityRole="button"
          onPress={onSkip}
          style={({ pressed }) => ({ minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <T size={16} weight="semibold" tint={color.graphite} style={{ textDecorationLine: 'underline' }}>
            Skip today (resets your streak to 0)
          </T>
        </Pressable>
      </View>
    </Screen>
  );
}

/* ---------- Motivation screen (last reminder) ---------- */

export function TakeoverScreen({
  s,
  now,
  onCheckIn,
  onSkip,
  onBack,
}: {
  s: State;
  now: number;
  onCheckIn: () => void;
  onSkip: () => void;
  /** Set when you opened this screen yourself to skip. */
  onBack?: () => void;
}) {
  useKeepAwake();
  const [why, setWhy] = useState('');
  const [mountedAt] = useState(Date.now());

  const waitLeft = Math.max(0, SKIP_WAIT_SEC - Math.floor((now - mountedAt) / 1000));
  const canSkip = waitLeft === 0 && why.trim().length >= 3;
  const leaveBy = leaveByOf(s)!;
  const lateMin = Math.floor((now - leaveBy) / 60_000);

  return (
    <Screen bg={color.graphite}>
      <T size={16} weight="semibold" tint={color.mist}>
        {lateMin > 0
          ? `${s.home ? "You haven't left home. " : ''}This stays until you leave. You're ${lateMin} minutes late.`
          : 'Before you skip, read this.'}
      </T>

      <View style={{ gap: 24 }}>
        <Hero size={84} tint={color.amber}>
          {`Day ${s.streak + 1} starts at the gym.`}
        </Hero>
        <View style={{ gap: 6 }}>
          <T size={16} tint={color.mist}>
            You wrote this:
          </T>
          <T size={25} weight="semibold" tint={color.white} style={{ lineHeight: 32 }}>
            {s.reason}
          </T>
        </View>
      </View>

      <View style={{ gap: 14 }}>
        <Button label="I'm at the gym" onPress={onCheckIn} bg={color.amber} fg={color.graphite} />
        {onBack ? <Button label="Back to countdown" onPress={onBack} outline={color.mist} fg={color.mist} /> : null}
        <T size={16} weight="semibold" tint={color.white}>
          Skipping today? Say why.
        </T>
        <TextInput
          value={why}
          onChangeText={setWhy}
          placeholder="Type your reason"
          placeholderTextColor={color.mist}
          style={{
            height: 52,
            borderWidth: 2,
            borderColor: color.mist,
            borderRadius: 12,
            paddingHorizontal: 16,
            fontFamily: font.body,
            fontSize: 17,
            color: color.white,
          }}
        />
        <Button
          label={waitLeft > 0 ? `Skip today unlocks in 0:${pad(waitLeft)}` : 'Skip today'}
          onPress={onSkip}
          outline={color.mist}
          fg={color.mist}
          disabled={!canSkip}
        />
      </View>
    </Screen>
  );
}

/* ---------- Cleared (green) ---------- */

export function ClearedScreen({ s, onClose }: { s: State; onClose: () => void }) {
  return (
    <Screen bg={color.cleared}>
      <T size={16} weight="semibold" tint={color.white}>
        Done for today. No more reminders until tomorrow.
      </T>
      <View style={{ gap: 6 }}>
        <T size={22} weight="bold" tint={color.white}>
          Day
        </T>
        <Hero size={300} tint={color.white}>
          {String(s.streak)}
        </Hero>
        <T size={22} tint={color.white}>
          in a row.
        </T>
        <T size={19} tint={color.white} style={{ marginTop: 24 }}>
          Checked in at {timeText(s.checkedInAt!)}
        </T>
      </View>
      <View style={{ gap: 14 }}>
        <T size={16} tint={color.white}>
          {s.alarmAt != null
            ? `Next alarm: ${dayName(s.alarmAt)} at ${timeText(s.alarmAt)}.`
            : 'No alarm is set.'}
        </T>
        <Button label="Done" onPress={onClose} bg={color.white} fg={color.graphite} />
      </View>
    </Screen>
  );
}
