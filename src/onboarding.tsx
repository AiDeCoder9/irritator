import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { currentPlace, findAddress, hasGym } from './gym';
import { DAY_NAMES, time12 } from './phase';
import type { State } from './store';
import { color, font } from './theme';
import { Button, Chip, Hero, T, topInset } from './ui';

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
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
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

  const useHere = () =>
    attempt(async () => {
      const p = await currentPlace();
      onChange({ gymLat: p.lat, gymLng: p.lng, gymLabel: 'your gym (saved from your location)' });
    });

  const search = () =>
    attempt(async () => {
      if (address.trim().length < 3) throw new Error('Type the gym name and area, for example "Cult Fit, Koramangala".');
      const p = await findAddress(address.trim());
      onChange({ gymLat: p.lat, gymLng: p.lng, gymLabel: address.trim() });
    });

  const pickTime = () => {
    const d = new Date();
    d.setHours(s.alarmHour, s.alarmMinute, 0, 0);
    DateTimePickerAndroid.open({
      value: d,
      mode: 'time',
      is24Hour: false,
      onChange: (e, picked) => {
        if (e.type === 'set' && picked) onChange({ alarmHour: picked.getHours(), alarmMinute: picked.getMinutes() });
      },
    });
  };

  const toggleDay = (d: number) => {
    if (s.days[d] && s.days.filter(Boolean).length === 1) return;
    const next = [...s.days];
    next[d] = !next[d];
    onChange({ days: next });
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.concrete }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 28, paddingBottom: 32, gap: 24, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 4 }}>
          <T size={16} weight="semibold" tint={color.iron}>
            Step {step} of 3
          </T>
          <Hero size={56} tint={color.graphite}>
            {step === 1 ? 'Where is your gym?' : step === 2 ? 'When do you go?' : 'Allow three things'}
          </Hero>
        </View>

        {step === 1 && (
          <>
            <T size={17} tint={color.graphite}>
              When you tap "I'm at the gym", the app checks you are really there.
            </T>
            <Button
              label={busy ? 'Finding you…' : 'Use my current location'}
              onPress={useHere}
              bg={color.graphite}
              fg={color.white}
              disabled={busy}
            />
            <T size={15} tint={color.iron}>
              Best option. Do it while you stand inside your gym.
            </T>
            <T size={17} weight="semibold" tint={color.graphite}>
              Or type the address
            </T>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Gym name, area, city"
              placeholderTextColor={color.iron}
              returnKeyType="search"
              onSubmitEditing={search}
              style={{
                height: 52,
                borderWidth: 2,
                borderColor: color.graphite,
                borderRadius: 12,
                paddingHorizontal: 16,
                fontFamily: font.body,
                fontSize: 17,
                color: color.graphite,
              }}
            />
            <Button label="Find address" onPress={search} outline={color.graphite} fg={color.graphite} disabled={busy} />

            {problem ? (
              <T size={16} weight="semibold" tint={color.graphite}>
                {problem}
              </T>
            ) : null}
            {hasGym(s) ? (
              <T size={17} weight="bold" tint={color.cleared}>
                Gym saved: {s.gymLabel}
              </T>
            ) : null}

            <T size={17} weight="semibold" tint={color.graphite}>
              How close counts as "at the gym"?
            </T>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[50, 100, 150, 200].map((m) => (
                <Chip
                  key={m}
                  label={`${m} m`}
                  a11y={`${m} meters`}
                  on={s.gymRadius === m}
                  onPress={() => onChange({ gymRadius: m })}
                />
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Alarm time ${time12(s.alarmHour, s.alarmMinute)}. Tap to change.`}
              onPress={pickTime}
              style={({ pressed }) => ({ gap: 4, transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <Hero size={104} tint={color.graphite}>
                {time12(s.alarmHour, s.alarmMinute)}
              </Hero>
              <T size={16} tint={color.iron}>
                Tap the time to change it
              </T>
            </Pressable>
            <T size={17} weight="semibold" tint={color.graphite}>
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
          </>
        )}

        {step === 3 && (
          <>
            <T size={17} tint={color.graphite}>
              Without these the alarm can stay silent.
            </T>
            <Button
              label="Allow notifications and alarms"
              onPress={() => attempt(async () => setPerm(await onPermissions()))}
              bg={color.graphite}
              fg={color.white}
              disabled={busy}
            />
            {perm?.length === 0 ? (
              <T size={16} weight="bold" tint={color.cleared}>
                Done. Alarms are allowed.
              </T>
            ) : (
              perm?.map((n) => (
                <T key={n} size={16} weight="semibold" tint={color.graphite}>
                  {n}
                </T>
              ))
            )}
            <Button label="Open battery settings" onPress={onBattery} outline={color.graphite} fg={color.graphite} />
            <T size={15} tint={color.iron}>
              On Samsung: Battery, Background usage limits, Never sleeping apps, add IRRITATOR.
            </T>
            {problem ? (
              <T size={16} weight="semibold" tint={color.graphite}>
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
              bg={color.graphite}
              fg={color.white}
              disabled={step === 1 && !hasGym(s)}
            />
          ) : (
            <Button label="Finish and turn alarm on" onPress={onFinish} bg={color.graphite} fg={color.white} />
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {step > 1 ? (
              <Pressable accessibilityRole="button" onPress={() => setStep(step - 1)} style={{ minHeight: 48, justifyContent: 'center' }}>
                <T size={16} weight="semibold" tint={color.iron}>
                  Back
                </T>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable accessibilityRole="button" onPress={onSkip} style={{ minHeight: 48, justifyContent: 'center' }}>
              <T size={16} weight="semibold" tint={color.iron} style={{ textDecorationLine: 'underline' }}>
                Skip for now
              </T>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
