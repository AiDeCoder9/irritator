import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { lastDays, statsOf, ymd, type Cell } from './progressCore';
import type { State } from './store';
import { color, font } from './theme';
import { Button, Card, Chevron, Hero, LinkButton, Row, T, topInset } from './ui';
import { formOf } from './formCore';
import { nudgeFor, weightChange, weightRate } from './weightCore';
import { MIN_KCAL, isMinor, suggestedRestKcal, type Targets } from './foodCore';
import { goalOf, type Water } from './waterCore';
import { goalLine, goalPlan, goalProblem, safetyOf } from './goalCore';

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

const DAYMS = 86_400_000;

function FormCard({ s, now }: { s: State; now: number }) {
  const f = formOf(s.history, s.days, now);
  return (
    <Card pad={18} style={{ gap: 8 }}>
      <T size={14} weight="semibold" tint={color.text2}>
        Form
      </T>
      <Hero size={44} tint={color.text} fit>
        {f.hasHistory ? `${f.score} / 100` : '50 / 100'}
      </Hero>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: color.surface2, overflow: 'hidden' }}>
        <View style={{ width: `${f.score}%`, height: 8, backgroundColor: color.yellow }} />
      </View>
      <T size={14} tint={color.text2}>
        A day done adds 5. A scheduled day missed takes 3, then 5, 7 and up to 11 if you keep missing. After 2 missed days in a row, your first day back adds 8. Excused days and rest days change nothing. It is a motivation score, not a fitness test.
      </T>
    </Card>
  );
}

function WeightCard({ water, targets, now, onLogWeight, onApply }: { water: Water; targets: Targets; now: number; onLogWeight: (kg: number) => void; onApply: (delta: number) => void }) {
  const [text, setText] = useState('');
  const log = [...water.weightLog].sort((a, b) => a.t - b.t);
  const last = log[log.length - 1];
  const change = weightChange(log, now);
  const kg = water.weightKg;
  const entered = parseFloat(text.replace(',', '.'));
  const valid = Number.isFinite(entered) && entered >= 30 && entered <= 250;
  const due = targets.lastAdjust == null || now - targets.lastAdjust >= 14 * DAYMS;
  const rate = weightRate(log, now, targets.lastAdjust ?? 0);
  const rest = targets.restKcal ?? suggestedRestKcal(targets.goal, kg, targets);
  const nudge = nudgeFor({ goal: targets.goal, perWeek: rate?.perWeek ?? null, weightKg: kg ?? last?.kg ?? 70, rest, floor: MIN_KCAL, minor: isMinor(targets) });
  const bars = log.slice(-12);
  const lo = Math.min(...bars.map((b) => b.kg));
  const hi = Math.max(...bars.map((b) => b.kg));
  const save = () => {
    if (!valid) return;
    onLogWeight(entered);
    setText('');
  };
  return (
    <Card pad={18} style={{ gap: 12 }}>
      <T size={14} weight="semibold" tint={color.text2}>
        Weight
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Hero size={44} tint={color.text} fit>
          {last ? `${last.kg} kg` : '–'}
        </Hero>
        {change != null ? (
          <T size={15} tint={color.text2}>
            {change === 0 ? 'no change in 4 weeks' : `${change > 0 ? '+' : ''}${change} kg in 4 weeks`}
          </T>
        ) : null}
      </View>
      {bars.length >= 2 ? (
        <View accessible accessibilityLabel="Weight over time" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 48 }}>
          {bars.map((b, i) => (
            <View key={i} style={{ flex: 1, height: 10 + (hi === lo ? 14 : ((b.kg - lo) / (hi - lo)) * 38), borderRadius: 4, backgroundColor: i === bars.length - 1 ? color.yellow : color.surface2 }} />
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <TextInput
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          placeholder={last ? `${last.kg}` : '70.0'}
          placeholderTextColor={color.text2}
          accessibilityLabel="Weight in kilograms"
          style={{ flex: 1, borderRadius: 14, backgroundColor: color.surface2, padding: 14, fontFamily: font.body, fontSize: 17, color: color.text }}
        />
        <View style={{ minWidth: 130 }}>
          <Button label="Save today" onPress={save} disabled={!valid} height={52} />
        </View>
      </View>
      {safetyOf(targets.health).noSuggest ? null : nudge.kind === 'up' || nudge.kind === 'down' ? (
        due ? (
          <View style={{ gap: 8 }}>
            <T size={15}>{nudge.message}</T>
            <T size={15} weight="semibold">
              {`Try ${nudge.delta > 0 ? '+' : '−'}${Math.abs(nudge.delta)} kcal: rest day ${rest} → ${rest + nudge.delta}.`}
            </T>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ minWidth: 120 }}>
                <Button label="Apply" onPress={() => onApply(nudge.delta)} height={52} />
              </View>
              <LinkButton label="Not now" onPress={() => onApply(0)} />
            </View>
          </View>
        ) : null
      ) : (
        <T size={14} tint={color.text2}>
          {nudge.message}
        </T>
      )}
    </Card>
  );
}

function GoalCard({ water, targets, now }: { water: Water; targets: Targets; now: number }) {
  const kg = targets.goalKg;
  if (kg == null) return null;
  const w = water.weightKg;
  const bad = goalProblem({ goalKg: kg, weightKg: w, heightCm: targets.heightCm, goal: targets.goal, minor: isMinor(targets) });
  const plan = !bad && w != null ? goalPlan({ goalKg: kg, weightKg: w, goal: targets.goal, now }) : null;
  return (
    <Card pad={18} style={{ gap: 6 }}>
      <T size={14} weight="semibold" tint={color.text2}>
        Goal weight
      </T>
      <Hero size={36} tint={color.text} fit>
        {`${kg} kg`}
      </Hero>
      <T size={15} tint={bad ? color.yellow : color.text2}>
        {bad ?? goalLine(plan, kg)}
      </T>
    </Card>
  );
}

export function ProgressScreen({
  s,
  water,
  now,
  targets,
  onLogWeight,
  onApply,
  onReview,
  onGoals,
}: {
  s: State;
  water: Water;
  now: number;
  targets: Targets;
  onLogWeight: (kg: number) => void;
  onApply: (delta: number) => void;
  onReview: () => void;
  onGoals: () => void;
}) {
  const st = statsOf(s.history, s.days, s.streak, s.bestStreak, now);
  const cells = lastDays(s.history, s.days, now, 14);

  // Water days: how many of the last 7 days reached today's goal (past goals are not stored yet).
  let waterDays = 0;
  for (let i = 0; i < 7; i++) {
    const date = ymd(now - i * DAY);
    const goal = goalOf(water, now - i * DAY);
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

        <FormCard s={s} now={now} />

        {safetyOf(targets.health).hideWeight ? null : (
          <>
            <WeightCard water={water} targets={targets} now={now} onLogWeight={onLogWeight} onApply={onApply} />
            <GoalCard water={water} targets={targets} now={now} />
          </>
        )}

        <Card pad={8}>
          <Row first title="Goals" sub="Weight, BMI, calories, water, gym days" right={<Chevron />} onPress={onGoals} />
          <Row title="Weekly review" sub="The last 7 days in one place" right={<Chevron />} onPress={onReview} />
        </Card>

        <T size={13} tint={color.text2}>
          History starts the day this screen was added. Earlier days are not counted. A missed day counts as a skip. Excused days don't count for or against you.
        </T>
      </ScrollView>
    </View>
  );
}
