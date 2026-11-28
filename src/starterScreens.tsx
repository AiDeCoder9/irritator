import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { stepsSince } from './health';
import { time12 } from './phase';
import { ymd } from './progressCore';
import {
  addLog,
  cancelWalkEnd,
  doneOn,
  fullWeeks,
  goalMinutes,
  loadStarter,
  MAX_GOAL,
  MAX_START,
  MIN_START,
  notifyWalkEnd,
  rescheduleStarter,
  type Starter,
  starterLine,
  stepsNeeded,
  streakDays,
  updateStarter,
  walkCheck,
  weekStart,
} from './starter';
import { useTimePicker } from './timePicker';
import { color } from './theme';
import { Button, Card, Chevron, Chip, Hero, LinkButton, Row, Stepper, T, Toggle, topInset } from './ui';

const DAY = 86_400_000;
const page = { paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 24, gap: 16 } as const;

/** Starter mode state lives in storage. Changes save at once and the reminders follow. */
export function useStarter() {
  const [st, setSt] = useState<Starter>(loadStarter);
  useEffect(() => {
    rescheduleStarter().catch(() => {});
  }, []);
  const change = useCallback((fn: (s: Starter) => Starter) => {
    setSt(updateStarter(fn));
    rescheduleStarter().catch(() => {});
  }, []);
  return { st, change };
}
export type StarterApi = ReturnType<typeof useStarter>;

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The Today screen in Starter mode. */
export function StarterScreen({
  api,
  now,
  onWater,
  onFood,
  onGoals,
  onHealth,
  onSettings,
}: {
  api: StarterApi;
  now: number;
  onWater: () => void;
  onFood?: () => void;
  onGoals: () => void;
  onHealth: () => void;
  onSettings: () => void;
}) {
  const { st, change } = api;
  const goal = goalMinutes(st, now);
  const done = doneOn(st.log, now);
  const run = st.run;
  const [steps, setSteps] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // While a walk runs, read the steps taken since it started.
  const startAt = run?.startAt;
  useEffect(() => {
    if (startAt == null) {
      setSteps(null);
      return;
    }
    let alive = true;
    const look = () => stepsSince(startAt).then((n) => alive && setSteps(n));
    look();
    const id = setInterval(look, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [startAt]);

  const start = () => {
    setMessage(null);
    const at = Date.now();
    change((x) => ({ ...x, run: { startAt: at, minutes: goalMinutes(x, at) } }));
    notifyWalkEnd(at + goal * 60_000).catch(() => {});
  };
  const cancel = () => {
    change((x) => ({ ...x, run: null }));
    cancelWalkEnd().catch(() => {});
  };
  const record = (how: 'walk' | 'other', minutes: number, n: number | null) => {
    change((x) => ({ ...x, run: null, log: addLog(x.log, { date: ymd(Date.now()), minutes, steps: n, how }) }));
    cancelWalkEnd().catch(() => {});
    setMessage(null);
  };
  const finish = async () => {
    if (!run) return;
    const n = await stepsSince(run.startAt);
    const c = walkCheck(run, Date.now(), n);
    if (c.kind === 'ok') return record('walk', run.minutes, c.steps);
    if (c.kind === 'few') return setMessage(`Your phone counted ${c.steps} steps. A ${run.minutes} minute walk is about ${c.needed}. Walk a little more and tap Finish again, or tap "I moved another way".`);
    if (c.kind === 'stale') return cancel();
  };

  const check = run ? walkCheck(run, now, steps) : null;
  const week = weekStart(now);
  const streak = streakDays(st.log, now);
  const next = Math.min(MAX_GOAL, goal + 2);
  const full = fullWeeks(st, now);

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={page}>
        <Hero size={36} tint={color.text}>
          Move today
        </Hero>

        <Card bg={color.yellow} pad={22} radius={28} style={{ gap: 8 }}>
          {done ? (
            <>
              <T size={15} weight="bold" tint={color.inkSoft}>
                Done today
              </T>
              <Hero size={46} tint={color.ink} fit>
                Nice work.
              </Hero>
            </>
          ) : run && check ? (
            <>
              <T size={15} weight="bold" tint={color.inkSoft}>
                {check.kind === 'running' ? 'Keep walking' : 'Time is up'}
              </T>
              <Hero size={64} tint={color.ink} fit>
                {check.kind === 'running' ? clock(check.leftMs) : '0:00'}
              </Hero>
              <T size={15} weight="semibold" tint={color.inkSoft}>
                {steps == null ? 'Steps are not available, so time is what counts.' : `${steps} steps so far. About ${stepsNeeded(run.minutes)} is a ${run.minutes} minute walk.`}
              </T>
            </>
          ) : (
            <>
              <T size={15} weight="bold" tint={color.inkSoft}>
                Today's walk
              </T>
              <Hero size={64} tint={color.ink} fit>
                {`${goal} min`}
              </Hero>
              <T size={15} weight="semibold" tint={color.inkSoft}>
                Any pace. Outside, or up and down the stairs.
              </T>
            </>
          )}
        </Card>

        {done ? null : run ? (
          <>
            <Button label="Finish" onPress={finish} disabled={check?.kind === 'running'} />
            <LinkButton label="Cancel this walk" onPress={cancel} tint={color.text2} />
          </>
        ) : (
          <Button label="Start my walk" onPress={start} />
        )}
        {message ? (
          <T size={15} weight="semibold" tint={color.yellow}>
            {message}
          </T>
        ) : null}
        {done || (run && check?.kind === 'running') ? null : (
          <LinkButton label="I moved another way (cycling, yoga, sport)" onPress={() => record('other', goal, null)} tint={color.text2} />
        )}

        <Card pad={18} style={{ gap: 12 }}>
          <T size={16} weight="bold">
            {starterLine(st, now)}
          </T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((n, i) => {
              const ts = week + i * DAY + DAY / 2;
              const on = doneOn(st.log, ts);
              return (
                <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: on ? color.yellow : color.surface2, alignItems: 'center', justifyContent: 'center' }}>
                    <T size={14} weight="bold" tint={on ? color.ink : color.text2}>
                      {on ? '✓' : ''}
                    </T>
                  </View>
                  <T size={12} tint={color.text2}>
                    {n}
                  </T>
                </View>
              );
            })}
          </View>
          {streak > 0 ? <T size={14} tint={color.text2}>{`${streak} ${streak === 1 ? 'day' : 'days'} in a row.`}</T> : null}
          <T size={13} tint={color.text2}>
            {goal >= MAX_GOAL ? `You are at the top goal of ${MAX_GOAL} minutes.` : `Finish a full week and the walk grows to ${next} minutes. ${full > 0 ? `${full} full ${full === 1 ? 'week' : 'weeks'} so far.` : ''}`}
          </T>
        </Card>

        <Card pad={8}>
          <Row first title="Water" sub="Log a glass" right={<Chevron />} onPress={onWater} />
          {onFood ? <Row title="Food" sub="Meals and reminders" right={<Chevron />} onPress={onFood} /> : null}
          <Row title="Goals" sub="Weight, BMI, water" right={<Chevron />} onPress={onGoals} />
          <Row title="Count my steps" sub="Connect Health Connect for a steps check" right={<Chevron />} onPress={onHealth} />
          <Row title="Starter mode settings" sub="Reminder time, days a week, starting minutes" right={<Chevron />} onPress={onSettings} />
        </Card>
      </ScrollView>
    </View>
  );
}

/** Settings for Starter mode. */
export function StarterSettingsScreen({ api, onBack, onPermissions }: { api: StarterApi; onBack: () => void; onPermissions: () => Promise<string[]> }) {
  const { st, change } = api;
  const tp = useTimePicker('Reminder time');
  const set = (p: Partial<Starter>) => change((x) => ({ ...x, ...p }));
  const [missing, setMissing] = useState<string[]>([]);
  const toggle = async () => {
    if (!st.enabled) setMissing(await onPermissions().catch(() => []));
    set({ enabled: !st.enabled });
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ ...page, gap: 18 }}>
        <View>
          <LinkButton label="‹ Settings" onPress={onBack} />
          <Hero size={34} tint={color.text}>
            Starter mode
          </Hero>
        </View>
        <T size={15} tint={color.text2}>
          For starting from zero. No morning alarm. A short walk a few days a week, a reminder in the evening, and a goal that grows slowly. Your gym alarms stay as they are; turn them off in Schedule if you do not want them.
        </T>

        <Card pad={8}>
          <Row first title="Starter mode" right={<Toggle on={st.enabled} onPress={toggle} label="Starter mode" />} />
          <Row title="Reminder time" sub="One more an hour later if you have not walked" right={<T size={17} weight="bold" tint={color.yellow}>{time12(Math.floor(st.remindMin / 60), st.remindMin % 60)}</T>} onPress={() => tp.open(Math.floor(st.remindMin / 60), st.remindMin % 60, (h, m) => set({ remindMin: h * 60 + m }))} />
        </Card>
        {missing.map((m) => (
          <T key={m} size={14} weight="semibold" tint={color.yellow}>
            {m}
          </T>
        ))}

        <View style={{ gap: 10 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            Days a week that make a full week
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[3, 4, 5, 6, 7].map((n) => (
              <Chip key={n} label={String(n)} a11y={`${n} days a week`} on={st.perWeek === n} onPress={() => set({ perWeek: n })} />
            ))}
          </View>
        </View>

        <Card pad={16} style={{ gap: 10 }}>
          <T size={15} weight="bold">
            Starting walk
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T size={16} weight="semibold">{`${st.startMin} minutes`}</T>
            <Stepper label="Starting minutes" value="" onDec={() => set({ startMin: Math.max(MIN_START, st.startMin - 1) })} onInc={() => set({ startMin: Math.min(MAX_START, st.startMin + 1) })} atMin={st.startMin <= MIN_START} atMax={st.startMin >= MAX_START} />
          </View>
          <T size={13} tint={color.text2}>
            Each full week in a row adds 2 minutes, up to 30. Miss a week and it just stops growing, it never drops. A walk counts when the timer ends and your phone counted about 60 steps a minute.
          </T>
        </Card>
      </ScrollView>
      {tp.sheet}
    </View>
  );
}
