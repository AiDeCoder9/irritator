import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { hasGym } from './gym';
import { Places } from './places';
import { DAY_NAMES, time12 } from './phase';
import { useTimePicker } from './timePicker';
import type { State } from './store';
import { color, font } from './theme';
import { Button, Card, Chip, Hero, T, topInset } from './ui';

type Props = {
  s: State;
  onChange: (p: Partial<State>) => void;
  onPermissions: () => Promise<string[]>;
  onBattery: () => void;
  onFinish: () => void;
  onSkip: () => void;
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Onboarding({ s, onChange, onPermissions, onBattery, onFinish, onSkip }: Props) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const tp = useTimePicker(s, onChange);
  const [perm, setPerm] = useState<string[] | null>(null);

  const attempt = async (fn: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
    } catch (e) {
      setProblem(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleDay = (d: number) => {
    if (s.days[d] && s.days.filter(Boolean).length === 1) return;
    const next = [...s.days];
    next[d] = !next[d];
    onChange({ days: next });
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 32, gap: 24, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 4 }}>
          <T size={16} weight="semibold" tint={color.text2}>
            Step {step} of 3
          </T>
          <Hero size={40} tint={color.text}>
            {step === 1 ? 'Where do you start and go?' : step === 2 ? 'When do you go?' : 'Allow three things'}
          </Hero>
        </View>

        {step === 1 && (
          <>
            <T size={17} tint={color.text}>
              Add the gyms you go to. When you tap "I'm at the gym", the app checks you are at one of them.
            </T>
            <Places s={s} onChange={onChange} />
            <T size={17} weight="semibold" tint={color.text}>
              How close counts as "at the gym"?
            </T>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[50, 100, 150, 200].map((m) => (
                <Chip key={m} label={`${m} m`} a11y={`${m} meters`} on={s.gymRadius === m} onPress={() => onChange({ gymRadius: m })} />
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Alarm time ${time12(s.alarmHour, s.alarmMinute)}. Tap to change.`}
              onPress={tp.open}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <Card pad={22} radius={28} style={{ gap: 4 }}>
                <Hero size={72} tint={color.text} fit>
                  {time12(s.alarmHour, s.alarmMinute)}
                </Hero>
                <T size={15} tint={color.text2}>
                  Tap the time to change it
                </T>
              </Card>
            </Pressable>
            <T size={17} weight="semibold" tint={color.text}>
              Gym days
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
            <T size={17} weight="semibold" tint={color.text}>
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
          </>
        )}

        {step === 3 && (
          <>
            <T size={17} tint={color.text}>
              Without these the alarm can stay silent.
            </T>
            <Button
              label="Allow notifications and alarms"
              onPress={() => attempt(async () => setPerm(await onPermissions()))}
              disabled={busy}
            />
            {perm?.length === 0 ? (
              <T size={16} weight="bold" tint={color.ok}>
                Done. Alarms are allowed.
              </T>
            ) : (
              perm?.map((n) => (
                <T key={n} size={16} weight="semibold" tint={color.text}>
                  {n}
                </T>
              ))
            )}
            <Button label="Open battery settings" onPress={onBattery} bg={color.surface2} fg={color.text} />
            <T size={15} tint={color.text2}>
              On Samsung: Battery, Background usage limits, Never sleeping apps, add IRRITATOR.
            </T>
            {problem ? (
              <T size={16} weight="semibold" tint={color.text}>
                {problem}
              </T>
            ) : null}
          </>
        )}

        <View style={{ flex: 1, minHeight: 8 }} />

        <View style={{ gap: 6 }}>
          {step < 3 ? (
            <Button
              label="Next"
              onPress={() => setStep(step + 1)}
              disabled={step === 1 && !hasGym(s)}
            />
          ) : (
            <Button label="Finish and turn alarm on" onPress={onFinish} />
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {step > 1 ? (
              <Pressable accessibilityRole="button" onPress={() => setStep(step - 1)} style={{ minHeight: 48, justifyContent: 'center' }}>
                <T size={16} weight="semibold" tint={color.text2}>
                  Back
                </T>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable accessibilityRole="button" onPress={onSkip} style={{ minHeight: 48, justifyContent: 'center' }}>
              <T size={16} weight="semibold" tint={color.text2}>
                Skip for now
              </T>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      {tp.sheet}
    </View>
  );
}
