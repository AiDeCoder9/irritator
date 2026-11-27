import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { timeText } from './phase';
import { color, font } from './theme';
import { Button, Card, Chip, Hero, LinkButton, Row, Stepper, T, Toggle, topInset } from './ui';
import {
  baseGoal,
  goalOf,
  loadWater,
  logDrink,
  mlText,
  planReminders,
  rescheduleWater,
  scheduledWater,
  setWeight,
  suggestedGoal,
  todaysDrinks,
  totalOf,
  undoLast,
  updateWater,
  Water,
} from './water';

const page = { paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 24, gap: 16 } as const;

/** Water lives in storage, because the notification buttons change it with the app closed. Re-read it every few seconds. */
export function useWater() {
  const [w, setW] = useState<Water>(loadWater);
  // What Android really has scheduled, and any error from scheduling. Shown in water settings so a silent failure can't hide.
  const [status, setStatus] = useState<{ count: number; next: number | null; error: string | null }>({ count: -1, next: null, error: null });

  const sync = useCallback(async () => {
    try {
      await rescheduleWater();
      const s = await scheduledWater();
      setStatus({ ...s, error: null });
    } catch (e) {
      setStatus({ count: 0, next: null, error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    sync();
    const id = setInterval(() => setW(loadWater()), 3000);
    return () => clearInterval(id);
  }, [sync]);

  /** Change, save, then move the reminders to match. */
  const change = useCallback(
    (fn: (w: Water) => Water) => {
      setW(updateWater(fn));
      sync();
    },
    [sync],
  );
  const drink = useCallback(
    (ml: number) => {
      setW(logDrink(ml));
      sync();
    },
    [sync],
  );
  const undo = useCallback(() => {
    setW(undoLast());
    sync();
  }, [sync]);
  return { w, change, drink, undo, status };
}

type WaterApi = ReturnType<typeof useWater>;

export function WaterScreen({ api, now, onSettings }: { api: WaterApi; now: number; onSettings: () => void }) {
  const { w, drink, undo, status } = api;
  const total = totalOf(w, now);
  const goal = goalOf(w, now);
  const bump = w.bumps?.[new Date(now).getDay()] ?? 0;
  const pct = Math.min(1, total / goal);
  const drinks = todaysDrinks(w, now);
  const next = w.enabled ? planReminders(w, now, 1)[0] : null;
  const reached = total >= goal;
  const noun = w.container === 'glass' ? 'glass' : 'bottle';

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ ...page, flexGrow: 1 }}>
        <Hero size={30} tint={color.text}>
          Water
        </Hero>

        <Card pad={24} radius={32} style={{ gap: 10 }}>
          <T size={14} weight="bold" tint={color.text2}>
            {reached ? 'Goal reached' : 'Today'}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <Hero size={72} tint={color.water} fit>
              {mlText(total)}
            </Hero>
          </View>
          <T size={16} tint={color.text2}>
            of {mlText(goal)}
            {w.weightKg == null ? ' (a starter goal)' : ''}
            {bump > 0 ? `, includes ${mlText(bump)} for training today` : ''}
          </T>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`${Math.round(pct * 100)} percent of today's goal`}
            style={{ height: 14, borderRadius: 7, backgroundColor: color.surface2, overflow: 'hidden', marginTop: 6 }}
          >
            <View style={{ width: `${pct * 100}%`, height: 14, borderRadius: 7, backgroundColor: color.water }} />
          </View>
        </Card>

        {w.weightKg == null ? (
          <Pressable accessibilityRole="button" onPress={onSettings} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Card pad={18} style={{ gap: 4 }}>
              <T size={17} weight="bold">
                Add your weight for a real goal
              </T>
              <T size={14} tint={color.text2}>
                The goal is worked out from your weight. You can change it any time.
              </T>
            </Card>
          </Pressable>
        ) : null}

        <Button label={`Drank 1 ${noun}, ${mlText(w.sizeMl)}`} onPress={() => drink(w.sizeMl)} height={64} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button label={`Half, ${mlText(Math.round(w.sizeMl / 2))}`} onPress={() => drink(Math.round(w.sizeMl / 2))} bg={color.surface2} fg={color.text} height={54} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Undo last" onPress={undo} bg={color.surface2} fg={drinks.length ? color.text : color.text2} disabled={!drinks.length} height={54} />
          </View>
        </View>

        {status.error ? (
          <T size={14} weight="semibold" tint={color.yellow}>
            {status.error}
          </T>
        ) : null}
        <T size={14} tint={color.text2}>
          {w.enabled ? (next ? `Next reminder ${timeText(next)}.` : '') : 'Reminders are off.'}
        </T>

        {drinks.length ? (
          <Card pad={8}>
            {[...drinks].reverse().slice(0, 6).map((d, i) => (
              <Row key={`${d.t}-${i}`} first={i === 0} title={mlText(d.ml)} right={<T size={15} tint={color.text2}>{timeText(d.t)}</T>} />
            ))}
          </Card>
        ) : null}

        <View style={{ flex: 1, minHeight: 4 }} />
        <LinkButton label="Water settings" onPress={onSettings} />
      </ScrollView>
    </View>
  );
}

const SIZES = [200, 250, 330, 500, 750, 1000];
const hour12 = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;

export function WaterSettingsScreen({ api, onBack }: { api: WaterApi; onBack: () => void }) {
  const { w, change, status } = api;
  const suggested = suggestedGoal(w.weightKg);
  const goal = baseGoal(w);

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ ...page, gap: 18 }}>
        <View>
          <Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 48, justifyContent: 'center' }}>
            <T size={16} weight="semibold" tint={color.text2}>
              ‹ Water
            </T>
          </Pressable>
          <Hero size={34} tint={color.text}>
            Water settings
          </Hero>
        </View>

        <Card pad={8}>
          <Row
            first
            title="Reminders"
            sub={`${hour12(w.startHour)} to ${hour12(w.endHour)}, every ${w.intervalMin} min`}
            right={<Toggle on={w.enabled} onPress={() => change((x) => ({ ...x, enabled: !x.enabled }))} label="Water reminders" />}
          />
          <Row
            title="Remind again if I don't answer"
            sub="Every 15 minutes, up to 3 times"
            right={<Toggle on={w.repeat} onPress={() => change((x) => ({ ...x, repeat: !x.repeat }))} label="Repeat reminders" />}
          />
        </Card>

        <Card pad={8}>
          <Row
            first
            title="Body weight"
            sub={w.weightKg == null ? 'Not set. Used for your goal.' : 'Update it when it changes.'}
            right={
              w.weightKg == null ? (
                <Chip label="Set 70 kg" on={false} onPress={() => change((x) => setWeight(x, 70))} />
              ) : (
                <Stepper
                  label="kilograms"
                  value={`${w.weightKg}`}
                  atMin={w.weightKg <= 30}
                  atMax={w.weightKg >= 250}
                  onDec={() => change((x) => setWeight(x, (x.weightKg ?? 70) - 1))}
                  onInc={() => change((x) => setWeight(x, (x.weightKg ?? 70) + 1))}
                />
              )
            }
          />
          <Row
            title="Daily goal (rest day)"
            sub={w.customGoalMl == null ? `Suggested from your weight: ${mlText(suggested)}` : `Your own goal. Suggested: ${mlText(suggested)}`}
            right={
              <Stepper
                label="goal"
                value={mlText(goal)}
                atMin={goal <= 1000}
                atMax={goal >= 6000}
                onDec={() => change((x) => ({ ...x, customGoalMl: Math.max(1000, baseGoal(x) - 250) }))}
                onInc={() => change((x) => ({ ...x, customGoalMl: Math.min(6000, baseGoal(x) + 250) }))}
              />
            }
          />
          {w.customGoalMl != null ? <LinkButton label="Use the suggested goal" onPress={() => change((x) => ({ ...x, customGoalMl: null }))} tint={color.yellow} /> : null}
        </Card>
        <T size={13} tint={color.text2}>
          Gym days add 500 ml and run days add 750 ml on top. The goal is an estimate, about 35 ml per kg. It is not medical advice.
        </T>

        <View style={{ gap: 10 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            What you drink from
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip label="Bottle" on={w.container === 'bottle'} onPress={() => change((x) => ({ ...x, container: 'bottle' }))} />
            <Chip label="Glass" on={w.container === 'glass'} onPress={() => change((x) => ({ ...x, container: 'glass' }))} />
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {SIZES.map((m) => (
              <Chip key={m} label={String(m)} a11y={`${m} milliliters`} on={w.sizeMl === m} onPress={() => change((x) => ({ ...x, sizeMl: m }))} />
            ))}
          </View>
          <T size={14} tint={color.text2}>
            Milliliters in one {w.container}. Past drinks keep their size.
          </T>
        </View>

        <View style={{ gap: 10 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            Minutes between reminders
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[60, 90, 120, 180].map((m) => (
              <Chip key={m} label={String(m)} a11y={`${m} minutes`} on={w.intervalMin === m} onPress={() => change((x) => ({ ...x, intervalMin: m }))} />
            ))}
          </View>
        </View>

        <Card pad={8}>
          <Row
            first
            title="First reminder"
            right={
              <Stepper
                label="start hour"
                value={hour12(w.startHour)}
                atMin={w.startHour <= 5}
                onDec={() => change((x) => ({ ...x, startHour: Math.max(5, x.startHour - 1) }))}
                onInc={() => change((x) => ({ ...x, startHour: Math.min(x.endHour - 1, x.startHour + 1) }))}
              />
            }
          />
          <Row
            title="Last reminder"
            right={
              <Stepper
                label="end hour"
                value={hour12(w.endHour)}
                atMax={w.endHour >= 23}
                onDec={() => change((x) => ({ ...x, endHour: Math.max(x.startHour + 1, x.endHour - 1) }))}
                onInc={() => change((x) => ({ ...x, endHour: Math.min(23, x.endHour + 1) }))}
              />
            }
          />
        </Card>

        <T size={13} tint={status.error ? color.yellow : color.text2}>
          {status.error
            ? `Reminders could not be scheduled: ${status.error}`
            : status.count < 0
              ? 'Checking reminders…'
              : status.count === 0
                ? 'No reminders are scheduled.'
                : `${status.count} reminders scheduled. Next at ${timeText(status.next!)}.`}
        </T>
        <T size={13} tint={color.text2}>
          {w.lastFromNotification ? `Last drink logged from a notification: ${timeText(w.lastFromNotification)}.` : 'No drink logged from a notification yet.'}
        </T>
      </ScrollView>
    </View>
  );
}
