import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { GOAL_LABEL, isMinor, type Food, type Targets } from './foodCore';
import { dateText, milestones, bmiBand, BMI_NOTE, bmiOf, goalLine, goalPlan, goalProblem, HEALTH_FLAGS, safetyOf, type HealthFlag } from './goalCore';
import { color, font } from './theme';
import { Button, Card, Hero, LinkButton, Row, Stepper, T, topInset } from './ui';
import { goalOf, mlText, type Water } from './waterCore';
import { statsOf } from './progressCore';
import type { State } from './store';

type Api = { f: Food; change: (fn: (f: Food) => Food) => void };

function Option({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 16,
        paddingHorizontal: 18,
        backgroundColor: on ? color.yellow : color.surface2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 16, color: on ? color.ink : color.text }}>{label}</Text>
      <Text style={{ fontFamily: font.bold, fontSize: 18, color: color.ink }}>{on ? '✓' : ''}</Text>
    </Pressable>
  );
}

/** The safety questions. Shown once, and any time from Settings. */
export function SafetyScreen({ api, onBack, first }: { api: Api; onBack: () => void; first: boolean }) {
  const { f, change } = api;
  const tg = f.targets;
  const safety = safetyOf(tg.health);
  const toggle = (id: HealthFlag) =>
    change((x) => {
      const has = x.targets.health.includes(id);
      const health = has ? x.targets.health.filter((h) => h !== id) : [...x.targets.health, id];
      const ed = health.includes('ed');
      return {
        ...x,
        // An eating disorder history turns off fasting and weight goals.
        fast: ed ? { ...x.fast, enabled: false } : x.fast,
        targets: { ...x.targets, health, goalKg: ed ? null : x.targets.goalKg },
      };
    });
  const none = () => change((x) => ({ ...x, targets: { ...x.targets, health: [] } }));
  const done = () => {
    change((x) => ({ ...x, targets: { ...x.targets, healthAsked: true } }));
    onBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}>
        {first ? null : <LinkButton label="‹ Back" onPress={onBack} tint={color.text2} />}
        <Hero size={34} tint={color.text}>
          Health and safety
        </Hero>
        <T size={15} tint={color.text2}>
          This app gives calorie numbers and a fasting timer. Do any of these apply to you? Pick all that do. The answer stays on your phone.
        </T>
        <View style={{ gap: 8 }}>
          {HEALTH_FLAGS.map((h) => (
            <Option key={h.id} label={h.label} on={tg.health.includes(h.id)} onPress={() => toggle(h.id)} />
          ))}
          <Option label="None of these" on={tg.health.length === 0} onPress={none} />
        </View>
        {safety.notice ? (
          <Card pad={16} style={{ gap: 6 }}>
            <T size={14} weight="semibold" tint={color.yellow}>
              {safety.notice}
            </T>
          </Card>
        ) : null}
        <T size={13} tint={color.text2}>
          Not medical advice. If you are under 18, pregnant, or have a health condition, ask a doctor before setting a calorie goal or fasting.
        </T>
        <Button label={first ? 'Save and continue' : 'Save'} onPress={done} />
      </ScrollView>
    </View>
  );
}

/** Goal weight and the date it gives. Used inside Daily targets. */
export function GoalWeightCard({ api, weightKg }: { api: Api; weightKg: number | null }) {
  const { f, change } = api;
  const tg = f.targets;
  const set = (kg: number | null) => change((x) => ({ ...x, targets: { ...x.targets, goalKg: kg, commit: null } }));
  const start = weightKg == null ? 70 : tg.goal === 'build' ? weightKg + 3 : weightKg - 3;
  const kg = tg.goalKg;
  const problem = kg == null ? null : goalProblem({ goalKg: kg, weightKg, heightCm: tg.heightCm, goal: tg.goal, minor: isMinor(tg) });
  const plan = kg != null && !problem && weightKg != null ? goalPlan({ goalKg: kg, weightKg, goal: tg.goal, now: Date.now() }) : null;
  const bump = (d: number) => set(Math.round(Math.min(250, Math.max(40, (kg ?? start - d) + d)) * 2) / 2);

  return (
    <Card pad={16} style={{ gap: 12 }}>
      <T size={15} weight="bold">
        Goal weight (optional)
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T size={16} weight="semibold" tint={kg == null ? color.text2 : color.text}>
          {kg == null ? 'Not set' : `${kg} kg`}
        </T>
        <Stepper label="Goal weight" value="" onDec={() => bump(-0.5)} onInc={() => bump(0.5)} atMin={kg != null && kg <= 40} atMax={kg != null && kg >= 250} />
      </View>
      {kg != null ? <LinkButton label="Clear goal" onPress={() => set(null)} /> : null}
      {problem ? (
        <T size={14} weight="semibold" tint={color.yellow}>
          {problem}
        </T>
      ) : plan ? (
        <T size={14} tint={color.text2}>
          {goalLine(plan, kg as number)}
        </T>
      ) : (
        <T size={14} tint={color.text2}>
          {tg.goal === 'maintain' ? 'Set your goal to lose or build to use a goal weight.' : weightKg == null ? 'Add your weight in Water settings first.' : 'Pick a weight to reach.'}
        </T>
      )}
      <T size={13} tint={color.text2}>
        {`The date uses a steady, safe pace: ${tg.goal === 'build' ? '0.25' : '0.5'} kg a week. It is an estimate and never faster than the cap. Your skip screen shows it, so skipping has a visible cost.`}
      </T>
    </Card>
  );
}


/** One place for every goal. Only collects settings that already exist. */
export function GoalsScreen({
  s,
  water,
  targets,
  now,
  onBack,
  onTargets,
  onWater,
  onCommit,
}: {
  s: State;
  water: Water;
  targets: Targets;
  now: number;
  onBack: () => void;
  onTargets: () => void;
  onWater: () => void;
  onCommit: () => void;
}) {
  const safety = safetyOf(targets.health);
  const kg = water.weightKg;
  const minor = isMinor(targets);
  const bmi = minor ? null : bmiOf(kg, targets.heightCm);
  const gk = targets.goalKg;
  const problem = gk == null ? null : goalProblem({ goalKg: gk, weightKg: kg, heightCm: targets.heightCm, goal: targets.goal, minor });
  const plan = gk != null && !problem && kg != null ? goalPlan({ goalKg: gk, weightKg: kg, goal: targets.goal, now }) : null;
  const goalBmi = gk != null && !problem && !minor ? bmiOf(gk, targets.heightCm) : null;
  const st = statsOf(s.history, s.days, s.streak, s.bestStreak, now);
  const perWeek = s.days.filter(Boolean).length;

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}>
        <View>
          <LinkButton label="‹ Progress" onPress={onBack} />
          <Hero size={34} tint={color.text}>
            Goals
          </Hero>
        </View>

        <Card bg={color.yellow} pad={20} radius={28} style={{ gap: 4 }}>
          <T size={14} weight="bold" tint={color.inkSoft}>
            Gym this week
          </T>
          <Hero size={48} tint={color.ink} fit>
            {`${st.weekDone} of ${st.weekScheduled}`}
          </Hero>
          <T size={15} weight="semibold" tint={color.inkSoft}>
            {`${perWeek} ${perWeek === 1 ? 'day' : 'days'} a week is your plan. Change days in Settings, Schedule.`}
          </T>
        </Card>

        {safety.hideWeight ? null : (
          <>
            <Card pad={18} style={{ gap: 8 }}>
              <T size={14} weight="semibold" tint={color.text2}>
                Goal weight
              </T>
              {gk == null ? (
                <T size={16}>No goal weight yet. Set one and your skip screen shows what skipping does to the date.</T>
              ) : (
                <>
                  <Hero size={40} tint={color.text} fit>
                    {`${gk} kg`}
                  </Hero>
                  <T size={15} tint={problem ? color.yellow : color.text2}>
                    {problem ?? goalLine(plan, gk)}
                  </T>
                </>
              )}
              <T size={14} tint={color.text2}>{kg == null ? 'Your weight is not set. Add it in Water settings.' : `Now ${kg} kg.`}</T>
              {plan && plan.kind === 'plan' ? (
                <Button label={targets.commit ? 'See my plan' : 'See my plan and commit'} onPress={onCommit} height={52} />
              ) : null}
              <Button label={gk == null ? 'Set a goal weight' : 'Change goal weight'} onPress={onTargets} bg={color.surface2} fg={color.text} height={52} />
            </Card>

            <Card pad={18} style={{ gap: 6 }}>
              <T size={14} weight="semibold" tint={color.text2}>
                BMI
              </T>
              {minor ? (
                <T size={15} tint={color.text2}>BMI is not shown under 18. Ask a doctor, who uses growth charts for this.</T>
              ) : bmi == null ? (
                <T size={15} tint={color.text2}>{targets.heightCm == null ? 'Add your height in Daily targets to see it.' : 'Add your weight in Water settings to see it.'}</T>
              ) : (
                <>
                  <Hero size={40} tint={color.text} fit>
                    {String(bmi)}
                  </Hero>
                  <T size={15} tint={color.text2}>{bmiBand(bmi)}</T>
                  {goalBmi != null ? <T size={14} tint={color.text2}>{`At your goal weight it would be ${goalBmi}.`}</T> : null}
                </>
              )}
              <T size={13} tint={color.text2}>{BMI_NOTE}</T>
            </Card>

            <Card pad={8}>
              <Row first title="Calorie goal" sub="Daily targets, age, height" right={<T size={15} weight="bold" tint={color.yellow}>{GOAL_LABEL[targets.goal]}</T>} onPress={onTargets} />
            </Card>
          </>
        )}

        <Card pad={8}>
          <Row first title="Water goal" sub="Tap to change in Water settings" right={<T size={15} weight="bold" tint={color.yellow}>{mlText(goalOf(water, now))}</T>} onPress={onWater} />
        </Card>
        <T size={13} tint={color.text2}>
          Goals come from the settings you already have. Changing them here or there is the same thing.
        </T>
      </ScrollView>
    </View>
  );
}


/** The plan reveal: the date, a simple line, four checkpoints, and a commit step. */
export function CommitScreen({
  targets,
  water,
  now,
  onBack,
  onCommit,
  onUndo,
}: {
  targets: Targets;
  water: Water;
  now: number;
  onBack: () => void;
  onCommit: () => void;
  onUndo: () => void;
}) {
  const [w, setW] = useState(0);
  const kg = water.weightKg;
  const gk = targets.goalKg;
  const ok = kg != null && gk != null && !goalProblem({ goalKg: gk, weightKg: kg, heightCm: targets.heightCm, goal: targets.goal, minor: isMinor(targets) });
  const plan = ok ? goalPlan({ goalKg: gk as number, weightKg: kg as number, goal: targets.goal, now }) : null;
  const H = 120;
  const x0 = 10;
  const x1 = Math.max(x0 + 1, w - 10);
  // Weight on the left starts at the top for a loss and at the bottom for a gain.
  const y0 = targets.goal === 'build' ? H - 10 : 10;
  const y1 = targets.goal === 'build' ? 10 : H - 10;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const ms = ok && plan ? milestones(plan, kg as number, gk as number, now) : [];
  const dot = (x: number, y: number, on: boolean) => (
    <View style={{ position: 'absolute', left: x - 7, top: y - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: on ? color.yellow : color.text2 }} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}>
        <LinkButton label="‹ Goals" onPress={onBack} />
        {!plan || plan.kind !== 'plan' || gk == null || kg == null ? (
          <Card pad={18}>
            <T size={16}>Set a usable goal weight first. Your weight and goal are on the Goals screen.</T>
          </Card>
        ) : (
          <>
            <Hero size={38} tint={color.text}>
              {`Reach ${gk} kg by ${dateText(plan.date)}`}
            </Hero>
            <T size={15} tint={color.text2}>{`${plan.diffKg} kg in about ${plan.weeks} ${plan.weeks === 1 ? 'week' : 'weeks'}, at ${plan.perWeek} kg a week. That is a steady pace and never faster than the safe cap.`}</T>

            <Card pad={16} style={{ gap: 10 }}>
              <View style={{ height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityLabel={`Projected weight from ${kg} kg now to ${gk} kg`}>
                {w > 0 ? (
                  <>
                    <View style={{ position: 'absolute', left: (x0 + x1) / 2 - len / 2, top: (y0 + y1) / 2 - 1.5, width: len, height: 3, borderRadius: 2, backgroundColor: color.yellow, transform: [{ rotate: `${ang}rad` }] }} />
                    {dot(x0, y0, true)}
                    {dot(x1, y1, true)}
                    {ms.slice(0, 3).map((m) => dot(x0 + ((x1 - x0) * m.pct) / 100, y0 + ((y1 - y0) * m.pct) / 100, false))}
                  </>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T size={14} weight="bold">{`Now ${kg} kg`}</T>
                <T size={14} weight="bold" tint={color.yellow}>{`${gk} kg`}</T>
              </View>
            </Card>

            <Card pad={8}>
              {ms.map((m, i) => (
                <View key={m.pct} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderTopWidth: i === 0 ? 0 : 1, borderColor: color.line }}>
                  <T size={15} tint={color.text2}>{dateText(m.ts)}</T>
                  <T size={16} weight="bold">{`${m.kg} kg`}</T>
                </View>
              ))}
            </Card>
            <T size={13} tint={color.text2}>
              An estimate. It assumes you keep to your plan. Each skipped session moves the date back, and the skip screen shows by how much. Weight also moves up and down day to day.
            </T>

            {targets.commit && targets.commit.goalKg === gk ? (
              <>
                <Card pad={16}>
                  <T size={16} weight="bold" tint={color.yellow}>{`Committed on ${dateText(targets.commit.at)}`}</T>
                </Card>
                <LinkButton label="Undo my commitment" onPress={onUndo} tint={color.text2} />
              </>
            ) : (
              <Button label="Commit to my goal" onPress={onCommit} />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
