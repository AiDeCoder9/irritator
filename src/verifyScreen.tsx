import { useKeepAwake } from 'expo-keep-awake';
import { View } from 'react-native';

import { activeGym } from './gym';
import type { State } from './store';
import { color } from './theme';
import { Button, Card, Hero, LinkButton, T, topInset } from './ui';
import { endsAt, STEPS_MIN, timerText } from './verifyCore';

/** Shown after "I'm at the gym": the timer, the steps so far, and a Finish button once the time is up. */
export function VerifyScreen({
  s,
  now,
  steps,
  canFallback,
  onFinish,
  onFallback,
  onCancel,
}: {
  s: State;
  now: number;
  /** Steps since the check started, or null when they cannot be read. */
  steps: number | null;
  canFallback: boolean;
  onFinish: () => void;
  onFallback: () => void;
  onCancel: () => void;
}) {
  useKeepAwake();
  const v = s.verify!;
  const done = now >= endsAt(v);
  const gym = activeGym(s);
  const pct = Math.min(1, steps == null ? 0 : steps / STEPS_MIN);
  return (
    <View style={{ flex: 1, backgroundColor: color.black, paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 28, gap: 14 }}>
      <View style={{ alignSelf: 'flex-start', height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: color.okBg, justifyContent: 'center' }}>
        <T size={14} weight="bold" tint={color.ok}>
          {`✓ At ${gym ? gym.label : 'the gym'}`}
        </T>
      </View>

      <View style={{ gap: 2, marginTop: 8 }}>
        <T size={20} weight="semibold" tint={color.text2}>
          {done ? 'Time is up' : 'Train. Day is not done yet.'}
        </T>
        <Hero size={done ? 120 : 150} tint={color.yellow} fit>
          {timerText(v, now)}
        </Hero>
      </View>

      <Card pad={18} style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T size={14} weight="semibold" tint={color.text2}>
            Steps
          </T>
          <T size={20} weight="bold">
            {steps == null ? 'Not connected' : `${Math.min(steps, 9999)} / ${STEPS_MIN}`}
          </T>
        </View>
        {steps != null ? (
          <View style={{ height: 8, borderRadius: 4, backgroundColor: color.surface2, overflow: 'hidden' }}>
            <View style={{ width: `${pct * 100}%`, height: 8, backgroundColor: color.yellow }} />
          </View>
        ) : null}
        <T size={13} tint={color.text2}>
          {steps == null
            ? 'Steps cannot be read, so this check uses time and location only. Connect Health Connect in Settings to count steps too.'
            : 'Steps come from Health Connect and can arrive a few minutes late.'}
        </T>
      </Card>

      <View style={{ flex: 1 }} />
      <Button label={done ? 'Finish check-in' : 'Finish unlocks when the time is up'} onPress={onFinish} disabled={!done} />
      {canFallback ? <LinkButton label="Steps not showing? Finish with location only" onPress={onFallback} tint={color.yellow} /> : null}
      <LinkButton label="I left. Cancel this check" onPress={onCancel} tint={color.text2} />
    </View>
  );
}
