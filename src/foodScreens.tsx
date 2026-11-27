import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import {
  EAT_HOURS,
  fastState,
  Food,
  hm,
  loadFood,
  Meal,
  mealProblem,
  parseNum,
  rescheduleFast,
  Saved,
  todaysMeals,
  totalsOf,
  updateFood,
} from './food';
import { time12, timeText } from './phase';
import { useTimePicker } from './timePicker';
import { color, font } from './theme';
import { Button, Card, Chevron, Chip, Hero, LinkButton, Row, T, Toggle, topInset } from './ui';

const page = { paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 24, gap: 16 } as const;

/** Food lives in storage like water does. Changes save at once and the fasting notifications follow. */
export function useFood() {
  const [f, setF] = useState<Food>(loadFood);
  const [undo, setUndo] = useState<Meal | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    rescheduleFast().catch(() => {});
    return () => void (timer.current && clearTimeout(timer.current));
  }, []);

  const change = useCallback((fn: (f: Food) => Food) => {
    setF(updateFood(fn));
    rescheduleFast().catch(() => {});
  }, []);

  const saveMeal = useCallback(
    (meal: Meal, keep: boolean) =>
      change((x) => {
        const meals = x.meals.some((m) => m.id === meal.id) ? x.meals.map((m) => (m.id === meal.id ? meal : m)) : [...x.meals, meal];
        const already = x.saved.some((s) => s.name.toLowerCase() === meal.name.toLowerCase());
        const saved: Saved[] = keep && !already ? [{ id: `s${meal.t}`, name: meal.name, kcal: meal.kcal, protein: meal.protein }, ...x.saved] : x.saved;
        return { ...x, meals, saved };
      }),
    [change],
  );

  const removeMeal = useCallback(
    (meal: Meal) => {
      change((x) => ({ ...x, meals: x.meals.filter((m) => m.id !== meal.id) }));
      setUndo(meal);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setUndo(null), 6000);
    },
    [change],
  );

  const restore = useCallback(() => {
    if (!undo) return;
    change((x) => ({ ...x, meals: [...x.meals, undo] }));
    setUndo(null);
  }, [undo, change]);

  const removeSaved = useCallback((id: string) => change((x) => ({ ...x, saved: x.saved.filter((s) => s.id !== id) })), [change]);

  return { f, change, saveMeal, removeMeal, restore, undo, removeSaved };
}
type FoodApi = ReturnType<typeof useFood>;

/* ---------- Food tab ---------- */

export function FoodScreen({
  api,
  now,
  onAdd,
  onEdit,
  onFasting,
}: {
  api: FoodApi;
  now: number;
  onAdd: () => void;
  onEdit: (m: Meal) => void;
  onFasting: () => void;
}) {
  const { f, removeMeal, restore, undo } = api;
  const totals = totalsOf(f, now);
  const meals = todaysMeals(f, now);
  const fs = fastState(f.fast, now);

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ ...page, flexGrow: 1 }}>
        <Hero size={30} tint={color.text}>
          Food
        </Hero>

        <Pressable accessibilityRole="button" onPress={onFasting} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          {f.fast.enabled ? (
            <Card bg={fs.eating ? color.surface : color.yellow} pad={20} radius={28} style={{ gap: 6 }}>
              <T size={14} weight="bold" tint={fs.eating ? color.ok : color.inkSoft}>
                {fs.eating ? 'Eating window open' : 'Fasting'}
              </T>
              <Hero size={52} tint={fs.eating ? color.text : color.ink} fit>
                {hm(fs.changeAt - now)}
              </Hero>
              <T size={15} weight="semibold" tint={fs.eating ? color.text2 : color.inkSoft}>
                {fs.eating ? `left to eat. Closes at ${timeText(fs.changeAt)}.` : `until you can eat. Opens at ${timeText(fs.changeAt)}.`}
              </T>
              <View style={{ height: 10, borderRadius: 5, backgroundColor: fs.eating ? color.surface2 : color.yellowDeep, overflow: 'hidden', marginTop: 6 }}>
                <View style={{ width: `${fs.progress * 100}%`, height: 10, borderRadius: 5, backgroundColor: fs.eating ? color.ok : color.ink }} />
              </View>
            </Card>
          ) : (
            <Card pad={18} style={{ gap: 4 }}>
              <T size={17} weight="bold">
                Fasting timer is off
              </T>
              <T size={14} tint={color.text2}>
                Pick an eating window and see when it opens and closes. Tap to set up.
              </T>
            </Card>
          )}
        </Pressable>

        <Card pad={20} style={{ gap: 4 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            Today
          </T>
          <Hero size={44} tint={color.text} fit>
            {`${totals.kcal} kcal`}
          </Hero>
          <T size={15} tint={color.text2}>
            {totals.count === 0 ? 'Nothing logged yet.' : `${totals.protein} g protein, ${totals.count} ${totals.count === 1 ? 'meal' : 'meals'}`}
          </T>
        </Card>

        <Button label="Add a meal" onPress={onAdd} height={60} />

        {meals.length ? (
          <Card pad={8}>
            {[...meals].reverse().map((m, i) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: i === 0 ? 0 : 1, borderColor: color.line, paddingHorizontal: 12 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${m.name}`}
                  onPress={() => onEdit(m)}
                  style={({ pressed }) => ({ flex: 1, minHeight: 64, justifyContent: 'center', paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
                >
                  <T size={17} weight="semibold">
                    {m.name}
                  </T>
                  <T size={14} tint={color.text2}>
                    {`${timeText(m.t)}, ${m.kcal} kcal${m.protein != null ? `, ${m.protein} g protein` : ''}`}
                  </T>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${m.name}`}
                  onPress={() => removeMeal(m)}
                  style={{ minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' }}
                >
                  <T size={15} weight="semibold" tint={color.text2}>
                    Remove
                  </T>
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}

        {undo ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: color.surface2, borderRadius: 16, paddingLeft: 16 }}>
            <T size={15}>{undo.name} removed</T>
            <Pressable accessibilityRole="button" onPress={restore} style={{ minHeight: 48, paddingHorizontal: 16, justifyContent: 'center' }}>
              <T size={15} weight="bold" tint={color.yellow}>
                Undo
              </T>
            </Pressable>
          </View>
        ) : null}

        <T size={13} tint={color.text2}>
          Calories are estimates. Change any number any time by tapping the meal.
        </T>
      </ScrollView>
    </View>
  );
}

/* ---------- Add or edit a meal ---------- */

const input = {
  height: 54,
  borderRadius: 16,
  backgroundColor: color.surface2,
  paddingHorizontal: 16,
  fontFamily: font.body,
  fontSize: 17,
  color: color.text,
} as const;

export function AddMealScreen({ api, initial, onDone }: { api: FoodApi; initial: Meal | null; onDone: () => void }) {
  const { f, saveMeal, removeSaved } = api;
  const [name, setName] = useState(initial?.name ?? '');
  const [kcal, setKcal] = useState(initial ? String(initial.kcal) : '');
  const [protein, setProtein] = useState(initial?.protein != null ? String(initial.protein) : '');
  const [keep, setKeep] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const save = () => {
    const k = parseNum(kcal);
    const p = parseNum(protein);
    const bad = mealProblem(name, k, protein.trim() === '' ? null : p);
    if (bad) return setProblem(bad);
    if (protein.trim() !== '' && p == null) return setProblem('Protein should be a number, or leave it empty.');
    const meal: Meal = { id: initial?.id ?? `m${Date.now()}`, t: initial?.t ?? Date.now(), name: name.trim(), kcal: Math.round(k!), protein: p == null ? null : Math.round(p * 10) / 10 };
    saveMeal(meal, keep);
    onDone();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ ...page, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View>
          <Pressable accessibilityRole="button" onPress={onDone} style={{ minHeight: 48, justifyContent: 'center' }}>
            <T size={16} weight="semibold" tint={color.text2}>
              ‹ Food
            </T>
          </Pressable>
          <Hero size={34} tint={color.text}>
            {initial ? 'Edit meal' : 'Add a meal'}
          </Hero>
        </View>

        {!initial && f.saved.length ? (
          <View style={{ gap: 8 }}>
            <T size={14} weight="semibold" tint={color.text2}>
              Your meals
            </T>
            <Card pad={8}>
              {f.saved.slice(0, 6).map((s, i) => (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: i === 0 ? 0 : 1, borderColor: color.line, paddingHorizontal: 12 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${s.name}`}
                    onPress={() => {
                      setName(s.name);
                      setKcal(String(s.kcal));
                      setProtein(s.protein != null ? String(s.protein) : '');
                      setProblem(null);
                    }}
                    style={({ pressed }) => ({ flex: 1, minHeight: 56, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
                  >
                    <T size={16} weight="semibold">
                      {s.name}
                    </T>
                    <T size={13} tint={color.text2}>{`${s.kcal} kcal${s.protein != null ? `, ${s.protein} g protein` : ''}`}</T>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Forget ${s.name}`} onPress={() => removeSaved(s.id)} style={{ minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' }}>
                    <T size={14} weight="semibold" tint={color.text2}>
                      Forget
                    </T>
                  </Pressable>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            What you ate
          </T>
          <TextInput value={name} onChangeText={setName} placeholder="Dal and rice" placeholderTextColor={color.text2} style={input} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              value={kcal}
              onChangeText={setKcal}
              placeholder="Calories"
              placeholderTextColor={color.text2}
              keyboardType="decimal-pad"
              accessibilityLabel="Calories"
              style={{ ...input, flex: 1 }}
            />
            <TextInput
              value={protein}
              onChangeText={setProtein}
              placeholder="Protein g"
              placeholderTextColor={color.text2}
              keyboardType="decimal-pad"
              accessibilityLabel="Protein in grams, optional"
              style={{ ...input, flex: 1 }}
            />
          </View>
          <T size={13} tint={color.text2}>
            A rough number is fine. Protein is optional.
          </T>
        </View>

        <Card pad={8}>
          <Row first title="Save to your meals" sub="One tap to add it again" right={<Toggle on={keep} onPress={() => setKeep(!keep)} label="Save to your meals" />} />
        </Card>

        {problem ? (
          <T size={15} weight="semibold" tint={color.yellow}>
            {problem}
          </T>
        ) : null}
        <Button label={initial ? 'Save changes' : 'Add meal'} onPress={save} />

      </ScrollView>
    </View>
  );
}

/* ---------- Fasting settings ---------- */

export function FastingScreen({ api, onBack }: { api: FoodApi; onBack: () => void }) {
  const { f, change } = api;
  const fast = f.fast;
  const tp = useTimePicker('Eating window opens');
  const set = (p: Partial<typeof fast>) => change((x) => ({ ...x, fast: { ...x.fast, ...p } }));
  const closeH = (fast.openHour * 60 + fast.openMinute + fast.eatHours * 60) % (24 * 60);

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ ...page, gap: 18 }}>
        <View>
          <Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 48, justifyContent: 'center' }}>
            <T size={16} weight="semibold" tint={color.text2}>
              ‹ Food
            </T>
          </Pressable>
          <Hero size={34} tint={color.text}>
            Fasting
          </Hero>
        </View>

        <Card pad={8}>
          <Row first title="Fasting timer" sub={`Eat for ${fast.eatHours} hours, fast for ${24 - fast.eatHours}`} right={<Toggle on={fast.enabled} onPress={() => set({ enabled: !fast.enabled })} label="Fasting timer" />} />
          <Row
            title="Eating window opens"
            sub={`Closes at ${time12(Math.floor(closeH / 60), closeH % 60)}`}
            right={<T size={17} weight="bold" tint={color.yellow}>{time12(fast.openHour, fast.openMinute)}</T>}
            onPress={() => tp.open(fast.openHour, fast.openMinute, (h, m) => set({ openHour: h, openMinute: m }))}
          />
          <Row title="Tell me when it opens and closes" right={<Toggle on={fast.notify} onPress={() => set({ notify: !fast.notify })} label="Fasting notifications" />} />
        </Card>

        <View style={{ gap: 10 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            Hours you can eat
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {EAT_HOURS.map((h) => (
              <Chip key={h} label={`${h} h`} a11y={`${h} hours eating, ${24 - h} fasting`} on={fast.eatHours === h} onPress={() => set({ eatHours: h })} />
            ))}
          </View>
          <T size={14} tint={color.text2}>
            8 hours is the common 16:8 plan. Nothing longer is offered.
          </T>
        </View>

        <Card pad={16} style={{ gap: 6 }}>
          <T size={15} weight="bold">
            Before you fast
          </T>
          <T size={14} tint={color.text2}>
            Fasting is not for everyone. Skip it, or ask a doctor first, if you are under 18, pregnant or breastfeeding, have diabetes or take medicine that needs food, or have ever had an eating disorder. Stop if you feel unwell. Water and tea are fine while you fast.
          </T>
        </Card>
      </ScrollView>
      {tp.sheet}
    </View>
  );
}
