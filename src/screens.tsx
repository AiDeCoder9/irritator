import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useKeepAwake } from 'expo-keep-awake';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { activeGym, travelOf } from './gym';
import { levelAt, messageFor } from './motivation';
import { clockText, DAY_NAMES, dayName, inText, leaveByOf, leftHomeOf, pad, time12, timeText } from './phase';
import { Places } from './places';
import type { State } from './store';
import { color, font, SKIP_WAIT_SEC, TAKEOVER_AFTER_MIN } from './theme';
import { Button, Card, Chevron, Chip, Hero, LinkButton, Row, Stepper, Steps, T, Tape, Toggle, topInset } from './ui';

type Patch = (p: Partial<State>) => void;

const page = { paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 24, gap: 16 } as const;
const DAY_LETTERS: Record<number, string> = { 0: 'S', 1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S' };
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function Back({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <T size={16} weight="semibold" tint={color.text2}>
        ‹ {label}
      </T>
    </Pressable>
  );
}

/** Opens the Android time picker. Used on Today and in setup. */
export function pickTime(s: State, onChange: Patch) {
  const d = new Date();
  d.setHours(s.alarmHour, s.alarmMinute, 0, 0);
  DateTimePickerAndroid.open({
    value: d,
    mode: 'time',
    is24Hour: false,
    onChange: (event, picked) => {
      if (event.type === 'set' && picked) onChange({ alarmHour: picked.getHours(), alarmMinute: picked.getMinutes() });
    },
  });
}

/* ---------- Today: tomorrow's alarm and nothing else ---------- */

export function TodayScreen({
  s,
  now,
  notes,
  onToggle,
  onTest,
  onSchedule,
  onPlaces,
}: {
  s: State;
  now: number;
  notes: string[];
  onToggle: () => void;
  onTest: () => void;
  onSchedule: () => void;
  onPlaces: () => void;
}) {
  const on = s.alarmAt != null;
  const [hour12, ampm] = time12(s.alarmHour, s.alarmMinute).split(' ');
  const gym = activeGym(s);
  const fg = on ? color.ink : color.text;
  const soft = on ? color.inkSoft : color.text2;

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ ...page, flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Hero size={30} tint={color.text}>
            Today
          </Hero>
          <View style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, borderColor: color.yellow, justifyContent: 'center' }}>
            <T size={14} weight="bold" tint={color.yellow}>
              Day {s.streak + 1}
            </T>
          </View>
        </View>

        <Card bg={on ? color.yellow : color.surface} pad={24} radius={32} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T size={14} weight="bold" tint={soft}>
              {on ? `Next alarm, ${dayName(s.alarmAt!)}` : 'Alarm is off'}
            </T>
            <Toggle on={on} onPress={onToggle} label="Alarm" tone="yellow" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <Hero size={96} tint={fg} fit>
              {hour12}
            </Hero>
            <Text style={{ fontFamily: font.display, fontSize: 28, color: fg, paddingBottom: 12 }}>{ampm}</Text>
          </View>
          {on ? (
            <T size={15} weight="semibold" tint={color.inkSoft}>
              Rings {inText(s.alarmAt! - now)}.
            </T>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {DAY_ORDER.map((d) => (
              <View
                key={d}
                accessible
                accessibilityLabel={`${DAY_NAMES[d]} ${s.days[d] ? 'on' : 'off'}`}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: s.days[d] ? (on ? color.ink : color.surface2) : 'transparent',
                  borderWidth: s.days[d] ? 0 : 1.5,
                  borderColor: on ? color.inkSoft : color.line,
                }}
              >
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: s.days[d] ? (on ? color.yellow : color.text) : soft }}>{DAY_LETTERS[d]}</Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onSchedule}
            style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <T size={15} weight="bold" tint={fg}>
              Edit schedule ›
            </T>
          </Pressable>
        </Card>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gyms"
          onPress={onPlaces}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
        >
          <Card pad={18} style={{ gap: 4 }}>
            <T size={14} weight="semibold" tint={color.text2}>
              Gym
            </T>
            <T size={20} weight="bold">
              {gym ? gym.label : 'Add your gym'}
            </T>
            <T size={14} tint={color.text2}>
              {gym ? `${gym.travelMin} min away${s.gyms.length > 1 ? `, ${s.gyms.length} gyms saved` : ''}` : 'The app checks you are there.'}
            </T>
          </Card>
        </Pressable>

        {notes.map((n) => (
          <T key={n} size={15} weight="semibold" tint={color.yellow}>
            {n}
          </T>
        ))}

        <View style={{ flex: 1, minHeight: 4 }} />
        <LinkButton label="Try it: ring in 30 seconds" onPress={onTest} />
      </ScrollView>
    </View>
  );
}

/* ---------- Schedule ---------- */

export function ScheduleScreen({ s, onChange, onBack, backLabel = 'Settings' }: { s: State; onChange: Patch; onBack: () => void; backLabel?: string }) {
  const [hour12, ampm] = time12(s.alarmHour, s.alarmMinute).split(' ');

  const toggleDay = (d: number) => {
    if (s.days[d] && s.days.filter(Boolean).length === 1) return;
    const next = [...s.days];
    next[d] = !next[d];
    onChange({ days: next });
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ ...page, gap: 22 }}>
        <View>
          <Back label={backLabel} onPress={onBack} />
          <Hero size={34} tint={color.text}>
            Schedule
          </Hero>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Alarm time ${time12(s.alarmHour, s.alarmMinute)}. Tap to change.`}
          onPress={() => pickTime(s, onChange)}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
        >
          <Card pad={22} radius={28} style={{ gap: 6 }}>
            <T size={14} weight="semibold" tint={color.text2}>
              Alarm time
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <Hero size={88} tint={color.text} fit>
                {hour12}
              </Hero>
              <Text style={{ fontFamily: font.display, fontSize: 26, color: color.text, paddingBottom: 10 }}>{ampm}</Text>
            </View>
            <T size={14} tint={color.text2}>
              Tap the time to change it
            </T>
          </Card>
        </Pressable>

        <View style={{ gap: 10 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            Repeat
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {DAY_ORDER.map((d) => (
              <Chip key={d} label={DAY_LETTERS[d]} a11y={DAY_NAMES[d]} on={s.days[d]} onPress={() => toggleDay(d)} />
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            Minutes to get out the door
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[5, 10, 15, 20, 25, 30].map((m) => (
              <Chip key={m} label={String(m)} a11y={`${m} minutes`} on={s.countdownMin === m} onPress={() => onChange({ countdownMin: m })} />
            ))}
          </View>
          <T size={14} tint={color.text2}>
            The countdown starts when you dismiss the alarm.
          </T>
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------- Settings ---------- */

export function SettingsScreen({
  s,
  onChange,
  onSchedule,
  onPlaces,
  onBattery,
  onSetup,
}: {
  s: State;
  onChange: Patch;
  onSchedule: () => void;
  onPlaces: () => void;
  onBattery: () => void;
  onSetup: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={page} keyboardShouldPersistTaps="handled">
        <Hero size={30} tint={color.text}>
          Settings
        </Hero>

        <Card pad={8}>
          <Row first title="Schedule" sub={`${time12(s.alarmHour, s.alarmMinute)}, ${s.days.every(Boolean) ? 'every day' : `${s.days.filter(Boolean).length} days a week`}`} right={<Chevron />} onPress={onSchedule} />
          <Row
            title="Places"
            sub={s.gyms.length ? `${s.home ? 'Home and ' : ''}${s.gyms.length} gym${s.gyms.length > 1 ? 's' : ''}` : 'No gym saved yet'}
            right={<Chevron />}
            onPress={onPlaces}
          />
        </Card>

        <Card pad={8}>
          <View style={{ padding: 12, gap: 8 }}>
            <T size={17} weight="semibold">
              Your reason
            </T>
            <TextInput
              value={s.reason}
              onChangeText={(t) => onChange({ reason: t })}
              multiline
              placeholderTextColor={color.text2}
              style={{
                minHeight: 64,
                borderRadius: 14,
                backgroundColor: color.surface2,
                padding: 14,
                fontFamily: font.body,
                fontSize: 16,
                color: color.text,
                textAlignVertical: 'top',
              }}
            />
            <T size={14} tint={color.text2}>
              Shown on the full screen when you're late.
            </T>
          </View>
          <Row
            title="Days in a row"
            right={
              <Stepper
                label="days"
                value={String(s.streak)}
                atMin={s.streak <= 0}
                onDec={() => onChange({ streak: Math.max(0, s.streak - 1) })}
                onInc={() => onChange({ streak: Math.min(999, s.streak + 1) })}
              />
            }
          />
          <Row
            title="Check my location"
            sub="Turn off only to test at home"
            right={<Toggle on={s.verifyLocation} onPress={() => onChange({ verifyLocation: !s.verifyLocation })} label="Check my location at check-in" />}
          />
        </Card>

        <Card pad={8}>
          <Row first title="Keep the alarm reliable" sub="Samsung: Battery, Never sleeping apps" right={<Chevron />} onPress={onBattery} />
          <Row title="Run setup again" right={<Chevron />} onPress={onSetup} />
        </Card>
      </ScrollView>
    </View>
  );
}

/* ---------- Places ---------- */

export function PlacesScreen({ s, onChange, onBack, backLabel = 'Settings' }: { s: State; onChange: Patch; onBack: () => void; backLabel?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ ...page, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View>
          <Back label={backLabel} onPress={onBack} />
          <Hero size={34} tint={color.text}>
            Places
          </Hero>
        </View>
        <Places s={s} onChange={onChange} />
        <View style={{ gap: 10 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            How close counts as at the gym
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[50, 100, 150, 200].map((m) => (
              <Chip key={m} label={`${m} m`} a11y={`${m} meters`} on={s.gymRadius === m} onPress={() => onChange({ gymRadius: m })} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------- Alarm ringing ---------- */

export function RingingScreen({ s, now, onDismiss }: { s: State; now: number; onDismiss: () => void }) {
  useKeepAwake();
  return (
    <View style={{ flex: 1, backgroundColor: color.black, paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 28, justifyContent: 'space-between' }}>
      <View />
      <View style={{ gap: 8 }}>
        <T size={20} weight="bold" tint={color.text2}>
          Time to get up
        </T>
        <Hero fit size={150} tint={color.yellow}>
          {timeText(now)}
        </Hero>
        <T size={18} tint={color.text}>
          Dismiss to start your {s.countdownMin}-minute countdown.
        </T>
      </View>
      <Button label="Dismiss alarm" onPress={onDismiss} />
    </View>
  );
}

/* ---------- Countdown and late (yellow) ---------- */

function GymChips({ s, onPick, tone }: { s: State; onPick: (id: string) => void; tone: 'dark' | 'yellow' }) {
  if (s.gyms.length < 2) return null;
  const current = activeGym(s)?.id;
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {s.gyms.slice(0, 3).map((g) => (
        <Chip key={g.id} label={g.label} on={g.id === current} onPress={() => onPick(g.id)} tone={tone} />
      ))}
    </View>
  );
}

function SkipLink({ onPress }: { onPress: () => void }) {
  return <LinkButton label="Skip today (resets your streak to 0)" onPress={onPress} tint={color.ink} />;
}

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
    <View style={{ flex: 1, backgroundColor: color.yellow, paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 24, gap: 14 }}>
      <Steps stage={1} hasHome={s.home != null} leftAt={null} fmt={timeText} />

      <View style={{ gap: 6, marginTop: 4 }}>
        <T size={20} weight="bold" tint={color.ink}>
          {late ? `${lateMin} min past ${timeText(leaveBy)}` : `Leave by ${timeText(leaveBy)}`}
        </T>
        <Hero fit size={112} tint={color.ink}>
          {late ? clockText(now - leaveBy) : clockText(leaveBy - now)}
        </Hero>
        <T size={18} tint={color.ink}>
          {late ? 'late.' : 'until you should be out the door.'}
        </T>
        <T size={15} weight="semibold" tint={color.inkSoft}>
          {`${s.home ? "You're still at home. " : ''}${gym ? gym.label : 'The gym'} is ${travel} min away. ${
            late ? `The full screen comes at ${timeText(leaveBy + TAKEOVER_AFTER_MIN * 60_000)}.` : `Leave on time and you're there by ${timeText(leaveBy + travel * 60_000)}.`
          }`}
        </T>
      </View>

      <Card bg={color.black} pad={20} style={{ gap: 0 }}>
        <T size={19} weight="bold" style={{ lineHeight: 25 }}>
          {messageFor(levelAt(s.dismissedAt!, now), s)}
        </T>
      </Card>

      <View style={{ flex: 1, minHeight: 4 }} />
      <GymChips s={s} onPick={onPickGym} tone="yellow" />
      <Button label="I'm at the gym" onPress={onCheckIn} bg={color.ink} fg={color.yellow} height={64} />
      <SkipLink onPress={onSkip} />
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
    <View style={{ flex: 1, backgroundColor: color.yellow, paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 24, gap: 14 }}>
      <Steps stage={2} hasHome leftAt={left} fmt={timeText} />

      <View style={{ gap: 6, marginTop: 4 }}>
        <T size={20} weight="bold" tint={color.ink}>
          {`On your way to ${gym ? gym.label : 'the gym'}`}
        </T>
        <Hero fit size={112} tint={color.ink}>
          {clockText(over ? now - eta : eta - now)}
        </Hero>
        <T size={18} tint={color.ink}>
          {over ? 'past when you should have arrived.' : 'until you arrive.'}
        </T>
        <T size={15} weight="semibold" tint={color.inkSoft}>
          {`Reminders are off. Check-in unlocks within ${s.gymRadius} m.`}
        </T>
      </View>

      <View style={{ flex: 1 }} />
      <GymChips s={s} onPick={onPickGym} tone="yellow" />
      <Button label="I'm at the gym" onPress={onCheckIn} bg={color.ink} fg={color.yellow} height={64} />
      <SkipLink onPress={onSkip} />
    </View>
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
    <ScrollView
      style={{ flex: 1, backgroundColor: color.black }}
      contentContainerStyle={{ flexGrow: 1, paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 24, gap: 14 }}
      keyboardShouldPersistTaps="handled"
    >
      <Tape />
      <T size={15} weight="semibold" tint={color.text2}>
        {lateMin > 0
          ? `${s.home ? "You haven't left home. " : ''}This stays until you leave. You're ${lateMin} minutes late.`
          : 'Before you skip, read this.'}
      </T>

      <View style={{ gap: 20, marginTop: 6 }}>
        <Hero size={56} tint={color.yellow}>
          {`Day ${s.streak + 1} starts at the gym.`}
        </Hero>
        <View style={{ gap: 6 }}>
          <T size={15} tint={color.text2}>
            You wrote this:
          </T>
          <T size={24} weight="bold" style={{ lineHeight: 30 }}>
            {s.reason}
          </T>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: 8 }} />
      <Button label="I'm at the gym" onPress={onCheckIn} />
      {onBack ? <Button label="Back to countdown" onPress={onBack} bg={color.surface2} fg={color.text} height={54} /> : null}
      <T size={15} weight="semibold">
        Skipping today? Say why.
      </T>
      <TextInput
        value={why}
        onChangeText={setWhy}
        placeholder="Type your reason"
        placeholderTextColor={color.text2}
        style={{ height: 54, borderRadius: 16, backgroundColor: color.surface, paddingHorizontal: 18, fontFamily: font.body, fontSize: 16, color: color.text }}
      />
      <Button
        label={waitLeft > 0 ? `Skip today unlocks in 0:${pad(waitLeft)}` : 'Skip today'}
        onPress={onSkip}
        bg={color.surface}
        fg={color.text2}
        disabled={!canSkip}
        height={54}
      />
    </ScrollView>
  );
}

/* ---------- Cleared ---------- */

export function ClearedScreen({ s, onClose }: { s: State; onClose: () => void }) {
  const gym = activeGym(s);
  return (
    <View style={{ flex: 1, backgroundColor: color.black, paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 28, gap: 14 }}>
      <View
        style={{
          alignSelf: 'flex-start',
          height: 36,
          paddingHorizontal: 14,
          borderRadius: 18,
          backgroundColor: color.okBg,
          justifyContent: 'center',
        }}
      >
        <T size={14} weight="bold" tint={color.ok}>
          ✓ Checked in at {timeText(s.checkedInAt!)}
          {gym ? `, ${gym.label}` : ''}
        </T>
      </View>

      <View style={{ gap: 2, marginTop: 8 }}>
        <T size={22} weight="semibold" tint={color.text2}>
          Day
        </T>
        <Hero size={220} tint={color.yellow}>
          {String(s.streak)}
        </Hero>
        <T size={18}>in a row. No more reminders until tomorrow.</T>
      </View>

      <View style={{ flex: 1 }} />
      <T size={15} tint={color.text2} style={{ textAlign: 'center' }}>
        {s.alarmAt != null ? `Next alarm: ${dayName(s.alarmAt)} at ${timeText(s.alarmAt)}.` : 'No alarm is set.'}
      </T>
      <Button label="Done" onPress={onClose} />
    </View>
  );
}
