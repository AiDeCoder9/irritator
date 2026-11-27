import { ScrollView, Text, View } from 'react-native';

import { lastDays, statsOf, ymd, type Cell } from './progressCore';
import type { State } from './store';
import { color, font } from './theme';
import { Card, Hero, T, topInset } from './ui';
import { goalOf, type Water } from './waterCore';

const DAY = 86_400_000;

function Dot({ c }: { c: Cell }) {
  const done = c.state === 'done';
  const skipped = c.state === 'skipped';
  const excused = c.state === 'excused';
  const today = c.state === 'today';
  const name = { done: 'went', skipped: 'skipped', excused: 'excused', rest: 'rest day', empty: 'no record', today: 'today' }[c.state];
  return (
    <View accessible accessibilityLabel={`${c.date}, ${name}`} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: done ? color.yellow : 'transparent',
          borderWidth: done ? 0 : 1.5,
          borderColor: skipped || excused ? color.text2 : today ? color.yellow : color.line,
        }}
      >
        {done ? <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.ink }}>✓</Text> : null}
        {excused ? <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.text2 }}>–</Text> : null}
        {skipped ? <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.text2 }}>×</Text> : null}
      </View>
      <Text style={{ fontFamily: font.semibold, fontSize: 12, color: today ? color.yellow : color.text2 }}>{c.label}</Text>
    </View>
  );
}

function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <Card pad={16} style={{ flex: 1, gap: 4 }}>
      <Hero size={34} tint={color.text} fit>
        {value}
      </Hero>
      <T size={14} weight="semibold">
        {label}
      </T>
      {sub ? (
        <T size={13} tint={color.text2}>
          {sub}
        </T>
      ) : null}
    </Card>
  );
}

export function ProgressScreen({ s, water, now }: { s: State; water: Water; now: number }) {
  const st = statsOf(s.history, s.days, s.streak, s.bestStreak, now);
  const cells = lastDays(s.history, s.days, now, 14);

  // Water days: how many of the last 7 days reached today's goal (past goals are not stored yet).
  const goal = goalOf(water);
  let waterDays = 0;
  for (let i = 0; i < 7; i++) {
    const date = ymd(now - i * DAY);
    const total = water.drinks.filter((d) => ymd(d.t) === date).reduce((a, d) => a + d.ml, 0);
    if (total >= goal) waterDays++;
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}>
        <Hero size={30} tint={color.text}>
          Progress
        </Hero>

        <Card bg={color.yellow} pad={24} radius={32} style={{ gap: 6 }}>
          <T size={14} weight="bold" tint={color.inkSoft}>
            Days in a row
          </T>
          <Hero size={110} tint={color.ink} fit>
            {String(st.streak)}
          </Hero>
          <T size={15} weight="semibold" tint={color.inkSoft}>
            {st.best > st.streak ? `Your best is ${st.best}.` : st.streak > 0 ? "That's your best so far." : 'Go today and it starts again.'}
          </T>
        </Card>

        <Card pad={18} style={{ gap: 14 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            Last 14 days
          </T>
          <View style={{ flexDirection: 'row' }}>{cells.slice(0, 7).map((c) => <Dot key={c.date} c={c} />)}</View>
          <View style={{ flexDirection: 'row' }}>{cells.slice(7).map((c) => <Dot key={c.date} c={c} />)}</View>
        </Card>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat value={`${st.weekDone} of ${st.weekScheduled}`} label="This week" sub="Gym days, Monday on" />
          <Stat value={st.consistency == null ? '–' : `${st.consistency}%`} label="Consistency" sub="Scheduled days you went, last 28" />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat value={`${waterDays} of 7`} label="Water goal" sub="Days you hit your goal" />
          <Stat value={String(st.runs)} label="Runs" sub="Logged in the last 28 days" />
        </View>

        <T size={13} tint={color.text2}>
          History starts the day this screen was added. Earlier days are not counted. A missed day counts as a skip. Excused days don't count for or against you.
        </T>
      </ScrollView>
    </View>
  );
}
