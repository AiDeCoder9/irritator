import { ScrollView, View } from 'react-native';

import type { Review } from './reviewCore';
import { color } from './theme';
import { Card, Hero, LinkButton, T, topInset } from './ui';

const nice = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function Line({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <T size={16} weight="semibold">
          {label}
        </T>
        {sub ? (
          <T size={13} tint={color.text2}>
            {sub}
          </T>
        ) : null}
      </View>
      <T size={18} weight="bold">
        {value}
      </T>
    </View>
  );
}

export function ReviewScreen({ r, onBack }: { r: Review; onBack: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}>
        <View>
          <LinkButton label="‹ Progress" onPress={onBack} />
          <Hero size={32} tint={color.text}>
            Your week
          </Hero>
          <T size={14} tint={color.text2}>{`${nice(r.from)} to ${nice(r.to)}`}</T>
        </View>

        {!r.hasData ? (
          <Card pad={20}>
            <T size={16}>Nothing to review yet. Go to the gym, log a drink or a meal, and this fills in.</T>
          </Card>
        ) : (
          <>
            {r.good ? (
              <Card bg={color.yellow} pad={20} style={{ gap: 4 }}>
                <T size={14} weight="bold" tint={color.inkSoft}>
                  Went well
                </T>
                <T size={18} weight="bold" tint={color.ink}>{`${r.good}.`}</T>
              </Card>
            ) : null}
            {r.focus ? (
              <Card pad={20} style={{ gap: 4 }}>
                <T size={14} weight="semibold" tint={color.text2}>
                  Work on
                </T>
                <T size={17}>{`${r.focus}.`}</T>
              </Card>
            ) : null}

            <Card pad={18} style={{ gap: 14 }}>
              <Line label="Gym" value={r.gymScheduled ? `${r.gymDone} of ${r.gymScheduled}` : '–'} sub={r.runs ? `${r.runs} of them runs` : 'Scheduled days you went'} />
              <Line label="Water goal" value={`${r.waterDays} of 7`} sub="Days you hit it" />
              <Line label="Food logged" value={`${r.foodLogged} of 7`} sub={r.foodLogged ? `${r.foodClose} close to target${r.avgKcal ? `, ${r.avgKcal} kcal average` : ''}` : 'Days with a meal logged'} />
              {r.weightChange != null ? <Line label="Weight" value={`${r.weightChange > 0 ? '+' : ''}${r.weightChange} kg`} sub="First to last weigh-in this week" /> : null}
              <Line label="Days in a row" value={String(r.streak)} />
            </Card>
          </>
        )}
        <T size={13} tint={color.text2}>
          Covers the 7 finished days before today. Today is not counted until it is over.
        </T>
      </ScrollView>
    </View>
  );
}
