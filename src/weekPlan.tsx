import { Pressable, Text, View } from 'react-native';

import { DAY_NAMES } from './phase';
import type { State } from './store';
import { color, font } from './theme';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** One tile per weekday. Tap to cycle: gym, run, off. At least one day stays on. */
export function WeekPlan({ s, onChange }: { s: State; onChange: (p: Partial<State>) => void }) {
  const cycle = (d: number) => {
    const days = [...s.days];
    const kinds = [...s.kinds];
    if (!days[d]) {
      days[d] = true;
      kinds[d] = 'gym';
    } else if (kinds[d] === 'gym') {
      kinds[d] = 'run';
    } else {
      if (days.filter(Boolean).length === 1) return;
      days[d] = false;
      kinds[d] = 'gym';
    }
    onChange({ days, kinds });
  };

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {ORDER.map((d) => {
        const on = s.days[d];
        const kind = s.kinds[d] ?? 'gym';
        const word = !on ? 'Off' : kind === 'run' ? 'Run' : 'Gym';
        return (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityLabel={`${DAY_NAMES[d]}: ${on ? kind : 'off'}. Tap to change.`}
            onPress={() => cycle(d)}
            style={({ pressed }) => ({
              flex: 1,
              height: 72,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              backgroundColor: on ? color.yellow : color.surface2,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Text style={{ fontFamily: font.bold, fontSize: 16, color: on ? color.ink : color.text }}>{LETTERS[d]}</Text>
            <Text style={{ fontFamily: font.semibold, fontSize: 12, color: on ? color.inkSoft : color.text2 }}>{word}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
