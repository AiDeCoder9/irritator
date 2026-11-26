import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { clockText, DAY_NAMES, dayName, leaveByOf, pad, timeText } from './phase';
import type { State } from './store';
import { color, font, SKIP_WAIT_SEC, TAKEOVER_AFTER_MIN } from './theme';
import { Button, HeatBar, Hero, Screen, Stepper, T, topInset } from './ui';

type Patch = (p: Partial<State>) => void;

/* ---------- Alarm setup (idle and waiting) ---------- */

export function SetupScreen({
  s,
  now,
  notes,
  onChange,
  onSet,
  onTest,
  onCancel,
  onBattery,
}: {
  s: State;
  now: number;
  notes: string[];
  onChange: Patch;
  onSet: () => void;
  onTest: () => void;
  onCancel: () => void;
  onBattery: () => void;
}) {
  const waiting = s.alarmAt != null;
  const stepMinute = (d: number) => onChange({ alarmMinute: (s.alarmMinute + d + 60) % 60 });
  const stepHour = (d: number) => onChange({ alarmHour: (s.alarmHour + d + 24) % 24 });

  return (
    <View style={{ flex: 1, backgroundColor: color.concrete }}>
      <ScrollView contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 28, paddingBottom: 40, gap: 22 }}>
        <Hero size={72} tint={color.graphite}>
          Alarm
        </Hero>

        {waiting ? (
          <View style={{ gap: 4 }}>
            <T size={22} weight="bold" tint={color.graphite}>
              Rings {dayName(s.alarmAt!)} at {timeText(s.alarmAt!)}
            </T>
            <T size={17} tint={color.iron}>
              In {clockText(s.alarmAt! - now)} (mm:ss). Day {s.streak + 1} is waiting.
            </T>
          </View>
        ) : (
          <T size={17} tint={color.iron}>
            Day {s.streak + 1} starts when this rings.
          </T>
        )}

        <View style={{ gap: 14 }}>
          <T size={17} weight="semibold" tint={color.graphite}>
            Alarm time
          </T>
          <Stepper label="hour" value={pad(s.alarmHour)} onDec={() => stepHour(-1)} onInc={() => stepHour(1)} />
          <Stepper label="minute" value={pad(s.alarmMinute)} onDec={() => stepMinute(-5)} onInc={() => stepMinute(5)} />
        </View>

        <View style={{ gap: 10 }}>
          <T size={17} weight="semibold" tint={color.graphite}>
            Repeat on
          </T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = s.days[d];
              const onlyOne = on && s.days.filter(Boolean).length === 1;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityLabel={DAY_NAMES[d]}
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    if (onlyOne) return;
                    const next = [...s.days];
                    next[d] = !on;
                    onChange({ days: next });
                  }}
                  style={{
                    width: 42,
                    height: 48,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: color.graphite,
                    backgroundColor: on ? color.graphite : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: font.semibold, fontSize: 15, color: on ? color.white : color.graphite }}>
                    {DAY_NAMES[d].slice(0, 2)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <T size={15} tint={color.iron}>
            At least one day stays on. Changes apply the next time you press Set alarm or Update alarm.
          </T>
        </View>

        <View style={{ gap: 10 }}>
          <T size={17} weight="semibold" tint={color.graphite}>
            Time to leave after the alarm
          </T>
          <Stepper
            label="minutes"
            value={String(s.countdownMin)}
            atMin={s.countdownMin <= 5}
            atMax={s.countdownMin >= 30}
            onDec={() => onChange({ countdownMin: Math.max(5, s.countdownMin - 5) })}
            onInc={() => onChange({ countdownMin: Math.min(30, s.countdownMin + 5) })}
          />
          <T size={15} tint={color.iron}>
            Pick 5 to 30 minutes, in steps of 5. The countdown starts when you dismiss the alarm.
          </T>
        </View>

        <View style={{ gap: 10 }}>
          <T size={17} weight="semibold" tint={color.graphite}>
            Days done in a row
          </T>
          <Stepper
            label="days"
            value={String(s.streak)}
            atMin={s.streak <= 0}
            onDec={() => onChange({ streak: Math.max(0, s.streak - 1) })}
            onInc={() => onChange({ streak: Math.min(999, s.streak + 1) })}
          />
          <T size={15} tint={color.iron}>
            Today will be day {s.streak + 1}. Change this to match your real streak. Checking in adds one; skipping resets it to 0.
          </T>
        </View>

        <View style={{ gap: 8 }}>
          <T size={17} weight="semibold" tint={color.graphite}>
            Your reason
          </T>
          <TextInput
            value={s.reason}
            onChangeText={(t) => onChange({ reason: t })}
            multiline
            style={{
              minHeight: 64,
              borderWidth: 2,
              borderColor: color.graphite,
              borderRadius: 12,
              padding: 14,
              fontFamily: font.body,
              fontSize: 17,
              color: color.graphite,
            }}
          />
          <T size={15} tint={color.iron}>
            Shown on the full-screen motivation screen when you're late.
          </T>
        </View>

        {notes.map((n) => (
          <T key={n} size={16} weight="semibold" tint={color.graphite}>
            {n}
          </T>
        ))}

        <View style={{ gap: 12 }}>
          <Button label={waiting ? 'Update alarm' : 'Set alarm'} onPress={onSet} bg={color.graphite} fg={color.white} />
          <Button label="Test: ring in 30 seconds" onPress={onTest} outline={color.graphite} fg={color.graphite} />
          <Button label="Battery settings" onPress={onBattery} outline={color.graphite} fg={color.graphite} />
          {waiting ? <Button label="Cancel alarm" onPress={onCancel} fg={color.graphite} /> : null}
        </View>

        <T size={15} tint={color.iron}>
          Samsung: also open Settings, Battery, Background usage limits, Never sleeping apps, and add IRRITATOR.
        </T>
      </ScrollView>
    </View>
  );
}

/* ---------- Alarm ringing ---------- */

export function RingingScreen({ now, onDismiss }: { now: number; onDismiss: () => void }) {
  useKeepAwake();
  return (
    <Screen bg={color.concrete}>
      <T size={16} weight="semibold" tint={color.graphite}>
        Alarm
      </T>
      <View style={{ gap: 6 }}>
        <T size={22} weight="bold" tint={color.graphite}>
          Time to get up
        </T>
        <Hero tint={color.graphite}>{timeText(now)}</Hero>
        <T size={19} tint={color.graphite}>
          Dismiss the alarm and your countdown starts.
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
}: {
  s: State;
  now: number;
  onCheckIn: () => void;
}) {
  useKeepAwake();
  const leaveBy = leaveByOf(s)!;
  const late = now >= leaveBy;
  const msLeft = leaveBy - now;
  const lateMin = Math.floor((now - leaveBy) / 60_000);
  const takeoverIn = leaveBy + TAKEOVER_AFTER_MIN * 60_000 - now;

  return (
    <Screen bg={color.amber}>
      <View style={{ gap: 10 }}>
        <HeatBar level={late ? 2 : 1} fill={color.graphite} track={color.graphite} />
        <T size={16} weight="semibold" tint={color.graphite}>
          {late
            ? `Nag level 2 of 3. The full screen appears in ${clockText(takeoverIn)}.`
            : 'Nag level 1 of 3. A louder one comes at your leave-by time.'}
        </T>
      </View>

      <View style={{ gap: 6 }}>
        <T size={22} weight="bold" tint={color.graphite}>
          {late ? `${lateMin} min past ${timeText(leaveBy)}` : `Leave by ${timeText(leaveBy)}`}
        </T>
        <Hero tint={color.graphite}>{late ? clockText(now - leaveBy) : clockText(msLeft)}</Hero>
        <T size={22} tint={color.graphite}>
          {late ? 'late.' : 'until you should be out the door.'}
        </T>
        <T size={19} tint={color.graphite} style={{ marginTop: 18, maxWidth: 320 }}>
          You dismissed the alarm at {timeText(s.dismissedAt!)} and gave yourself {s.countdownMin} minutes.
        </T>
      </View>

      <View style={{ gap: 14 }}>
        <T size={16} tint={color.graphite}>
          Skip today and your streak resets to 0.
        </T>
        <Button label="Test: I'm at the gym" onPress={onCheckIn} bg={color.graphite} fg={color.white} />
      </View>
    </Screen>
  );
}

/* ---------- Motivation screen (level 3) ---------- */

export function TakeoverScreen({
  s,
  now,
  onCheckIn,
  onSkip,
}: {
  s: State;
  now: number;
  onCheckIn: () => void;
  onSkip: () => void;
}) {
  useKeepAwake();
  const [why, setWhy] = useState('');
  const [mountedAt] = useState(Date.now());
  const [, force] = useState(0);
  useEffect(() => {
    force((n) => n + 1);
  }, [now]);

  const waitLeft = Math.max(0, SKIP_WAIT_SEC - Math.floor((now - mountedAt) / 1000));
  const canSkip = waitLeft === 0 && why.trim().length >= 3;
  const leaveBy = leaveByOf(s)!;
  const lateMin = Math.floor((now - leaveBy) / 60_000);

  return (
    <Screen bg={color.graphite}>
      <View style={{ gap: 10 }}>
        <HeatBar level={3} fill={color.amber} track={color.amber} />
        <T size={16} weight="semibold" tint={color.mist}>
          Nag level 3 of 3. It stops when you leave.
        </T>
      </View>

      <View style={{ gap: 22 }}>
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
        <T size={17} tint={color.mist}>
          It's {lateMin} minutes past {timeText(leaveBy)}. Skip today and your streak resets to 0.
        </T>
      </View>

      <View style={{ gap: 14 }}>
        <Button label="Test: I'm at the gym" onPress={onCheckIn} bg={color.amber} fg={color.graphite} />
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
        Cleared for today. No more nags until tomorrow.
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
            ? `Next alarm: ${dayName(s.alarmAt)} at ${timeText(s.alarmAt)}. You get ${s.countdownMin} minutes to leave.`
            : 'No alarm is set.'}
        </T>
        <Button label="Done" onPress={onClose} bg={color.white} fg={color.graphite} />
      </View>
    </Screen>
  );
}
