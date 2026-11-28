import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import {
  atMinutes,
  DEFAULT_MEAL_TIMES,
  MAX_MEAL_TIMES,
  recentMeals,
  DAY_KCAL,
  DayType,
  dayTypeOf,
  EAT_HOURS,
  Goal,
  nextMealBudget,
  slotsFor,
  suggestMeals,
  weekPlan,
  hasProfile,
  isMinor,
  Sex,
  GOAL_KCAL,
  GOAL_LABEL,
  MIN_KCAL,
  suggestedRestKcal,
  targetFor,
  fastState,
  Food,
  hm,
  loadFood,
  Meal,
  mealProblem,
  Hit,
  parseNum,
  rescheduleFast,
  rescheduleMeals,
  Saved,
  scaleFor,
  searchFoods,
  todaysMeals,
  totalsOf,
  updateFood,
} from './food';
import { time12, timeText } from './phase';
import { dishesAsSaved, findDishes, scaleDish, type Dish } from './localFoods';
import { useTimePicker } from './timePicker';
import { safetyOf } from './goalCore';
import { GoalWeightCard } from './goalScreens';
import { color, font } from './theme';
import { Button, Card, Chevron, Chip, Hero, LinkButton, Row, Stepper, T, Toggle, topInset } from './ui';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const DAY_NAME: Record<DayType, string> = { gym: 'Gym day', run: 'Run day', rest: 'Rest day' };
const page = { paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 24, gap: 16 } as const;

/** Food lives in storage like water does. Changes save at once and the fasting notifications follow. */
export function useFood() {
  const [f, setF] = useState<Food>(loadFood);
  const [undo, setUndo] = useState<Meal | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    rescheduleFast().catch(() => {});
    rescheduleMeals().catch(() => {});
    return () => void (timer.current && clearTimeout(timer.current));
  }, []);

  const change = useCallback((fn: (f: Food) => Food) => {
    setF(updateFood(fn));
    rescheduleFast().catch(() => {});
    rescheduleMeals().catch(() => {});
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
  onTargets,
  onPlan,
  onMealTimes,
  weightKg,
  days,
  kinds,
}: {
  api: FoodApi;
  now: number;
  weightKg: number | null;
  days: boolean[];
  kinds: ('gym' | 'run')[];
  onTargets: () => void;
  onPlan: () => void;
  onMealTimes: () => void;
  onAdd: () => void;
  onEdit: (m: Meal) => void;
  onFasting: () => void;
}) {
  const { f, removeMeal, restore, undo } = api;
  const totals = totalsOf(f, now);
  const meals = todaysMeals(f, now);
  const fs = fastState(f.fast, now);
  const day = dayTypeOf(days, kinds, now);
  const goal = targetFor(f.targets, weightKg, day);
  const eaten = Math.min(1, totals.kcal / goal.kcal);

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ ...page, flexGrow: 1 }}>
        <Hero size={30} tint={color.text}>
          Food
        </Hero>
        {safetyOf(f.targets.health).notice ? (
          <T size={14} weight="semibold" tint={color.yellow}>
            {safetyOf(f.targets.health).notice}
          </T>
        ) : null}

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

        <Pressable accessibilityRole="button" onPress={onTargets} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <Card pad={20} style={{ gap: 4 }}>
            <T size={14} weight="semibold" tint={color.text2}>
              {`${DAY_NAME[day]} target`}
            </T>
            <Hero size={44} tint={color.text} fit>
              {`${totals.kcal} / ${goal.kcal}`}
            </Hero>
            <T size={15} tint={color.text2}>
              {totals.kcal > goal.kcal ? `kcal. ${totals.kcal - goal.kcal} over.` : `kcal. ${goal.kcal - totals.kcal} left.`}
            </T>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: color.surface2, overflow: 'hidden', marginTop: 6 }}>
              <View style={{ width: `${eaten * 100}%`, height: 10, borderRadius: 5, backgroundColor: color.yellow }} />
            </View>
            <T size={15} tint={color.text2} style={{ marginTop: 6 }}>
              {goal.protein == null
                ? `${totals.protein} g protein. Add your weight in Water settings for a protein target.`
                : `${totals.protein} of ${goal.protein} g protein`}
            </T>
            {goal.protein != null && !hasProfile(weightKg, f.targets) ? (
              <T size={13} tint={color.text2}>
                Tap to add age and height for a better estimate.
              </T>
            ) : null}
          </Card>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={onPlan} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <Card pad={16} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T size={17} weight="bold">
                Meal plan
              </T>
              <T size={14} tint={color.text2}>
                What to eat next and how your week is going.
              </T>
            </View>
            <Chevron />
          </Card>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={onMealTimes} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <Card pad={16} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T size={17} weight="bold">
                Meal reminders
              </T>
              <T size={14} tint={color.text2}>
                {f.remind.enabled ? `${f.remind.times.length} meals a day: ${[...f.remind.times].sort((a, b) => a - b).map((m) => time12(Math.floor(m / 60), m % 60)).join(', ')}` : 'Off. Set your meal times to get a reminder to eat and log.'}
              </T>
            </View>
            <Chevron />
          </Card>
        </Pressable>

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
  const { f, change, saveMeal, removeSaved } = api;
  const [name, setName] = useState(initial?.name ?? '');
  const [kcal, setKcal] = useState(initial ? String(initial.kcal) : '');
  const [protein, setProtein] = useState(initial?.protein != null ? String(initial.protein) : '');
  const [keep, setKeep] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // When you ate: now, or earlier today.
  const tp = useTimePicker('When did you eat?');
  const [at, setAt] = useState<number | null>(null);
  const eatenAt = () => (at == null ? Date.now() : Math.min(Date.now(), atMinutes(Date.now(), at)));
  const recents = recentMeals(f, 10);
  const logRecent = (r: { name: string; kcal: number; protein: number | null }) => {
    const t = eatenAt();
    saveMeal({ id: `m${t}`, t, name: r.name.trim(), kcal: r.kcal, protein: r.protein }, false);
    onDone();
  };

  // Food search (USDA FoodData Central)
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Hit | null>(null);
  const [grams, setGrams] = useState('100');

  // Common local dishes (built in, works offline)
  const [dishQuery, setDishQuery] = useState('');
  const [dish, setDish] = useState<Dish | null>(null);
  const [times, setTimes] = useState(1);
  const useDish = (d: Dish, x: number) => {
    const v = scaleDish(d, x);
    setDish(d);
    setTimes(x);
    setName(x === 1 ? d.name : `${d.name} (${x === 0.5 ? 'half' : `${x}×`})`);
    setKcal(String(v.kcal));
    setProtein(String(v.protein));
    setProblem(null);
  };

  const search = async () => {
    if (query.trim().length < 2) return setProblem('Type a food to search for, like "rice" or "pizza".');
    setBusy(true);
    setProblem(null);
    setPicked(null);
    try {
      setHits(await searchFoods(query.trim(), f.fdcKey));
    } catch (e) {
      setHits(null);
      setProblem(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const applyPick = (h: Hit, g: string) => {
    const amount = parseNum(g);
    if (amount == null || amount <= 0) return;
    const s = scaleFor({ kcal: h.kcal100, protein: h.protein100 }, amount);
    setName(`${h.name} (${amount} g)`);
    setKcal(String(s.kcal));
    setProtein(s.protein == null ? '' : String(s.protein));
  };

  const save = () => {
    const k = parseNum(kcal);
    const p = parseNum(protein);
    const bad = mealProblem(name, k, protein.trim() === '' ? null : p);
    if (bad) return setProblem(bad);
    if (protein.trim() !== '' && p == null) return setProblem('Protein should be a number, or leave it empty.');
    const meal: Meal = { id: initial?.id ?? `m${Date.now()}`, t: initial?.t ?? eatenAt(), name: name.trim(), kcal: Math.round(k!), protein: p == null ? null : Math.round(p * 10) / 10 };
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

        {!initial ? (
          <Card pad={8}>
            <Row
              first
              title="When did you eat?"
              sub={at == null ? 'Tap to log a meal from earlier today' : 'Tap to change'}
              right={
                <T size={17} weight="bold" tint={color.yellow}>
                  {at == null ? 'Now' : time12(Math.floor(at / 60), at % 60)}
                </T>
              }
              onPress={() => {
                const d = new Date();
                tp.open(at == null ? d.getHours() : Math.floor(at / 60), at == null ? d.getMinutes() : at % 60, (h, m) => setAt(h * 60 + m));
              }}
            />
          </Card>
        ) : null}

        {!initial && recents.length ? (
          <View style={{ gap: 8 }}>
            <T size={14} weight="semibold" tint={color.text2}>
              Eaten before. Tap to log it
            </T>
            <Card pad={8}>
              {recents.map((r, i) => (
                <Pressable
                  key={r.name}
                  accessibilityRole="button"
                  accessibilityLabel={`Log ${r.name}, ${r.kcal} kcal`}
                  onPress={() => logRecent(r)}
                  style={({ pressed }) => ({ minHeight: 60, justifyContent: 'center', paddingHorizontal: 12, borderTopWidth: i === 0 ? 0 : 1, borderColor: color.line, opacity: pressed ? 0.6 : 1 })}
                >
                  <T size={16} weight="semibold">
                    {r.name}
                  </T>
                  <T size={13} tint={color.text2}>{`${r.kcal} kcal${r.protein != null ? `, ${r.protein} g protein` : ''}`}</T>
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null}

        {!initial ? (
          <View style={{ gap: 8 }}>
            <T size={14} weight="semibold" tint={color.text2}>
              Common dishes
            </T>
            <TextInput value={dishQuery} onChangeText={setDishQuery} placeholder="Momo, dal bhat, thukpa" placeholderTextColor={color.text2} accessibilityLabel="Search common dishes" style={input} />
            <Card pad={8}>
              {findDishes(dishQuery).length ? (
                findDishes(dishQuery).map((d, i) => (
                  <Pressable
                    key={d.name}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${d.name}`}
                    onPress={() => useDish(d, 1)}
                    style={({ pressed }) => ({ minHeight: 60, justifyContent: 'center', paddingHorizontal: 12, borderTopWidth: i === 0 ? 0 : 1, borderColor: color.line, opacity: pressed ? 0.6 : 1 })}
                  >
                    <T size={16} weight={dish?.name === d.name ? 'bold' : 'semibold'}>
                      {d.name}
                    </T>
                    <T size={13} tint={color.text2}>{`${d.serving}: about ${d.kcal} kcal, ${d.protein} g protein`}</T>
                  </Pressable>
                ))
              ) : (
                <T size={14} tint={color.text2} style={{ padding: 12 }}>
                  Not in the list. Type it below once and save it to your meals.
                </T>
              )}
            </Card>
            {dish ? (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[0.5, 1, 1.5, 2].map((x) => (
                  <Chip key={x} label={x === 0.5 ? 'Half' : `${x}×`} a11y={`${x} servings`} on={times === x} onPress={() => useDish(dish, x)} />
                ))}
              </View>
            ) : null}
            <T size={13} tint={color.text2}>
              Rough numbers for a typical serving. Change them below if yours is different.
            </T>
          </View>
        ) : null}

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


        <View style={{ gap: 8, marginTop: 8 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            Search a food
          </T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Pizza, rice, chicken"
              placeholderTextColor={color.text2}
              returnKeyType="search"
              onSubmitEditing={search}
              style={{ ...input, flex: 1 }}
            />
            <Pressable
              accessibilityRole="button"
              onPress={search}
              disabled={busy}
              style={({ pressed }) => ({ height: 54, paddingHorizontal: 18, borderRadius: 16, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
            >
              <T size={16} weight="bold">
                {busy ? '…' : 'Search'}
              </T>
            </Pressable>
          </View>
          <T size={13} tint={color.text2}>
            From the US government food database. Values are for 100 g, then scaled to what you ate. It may not know local dishes, so type those above.
          </T>
          {picked ? (
            <Card pad={16} style={{ gap: 10 }}>
              <T size={16} weight="bold">
                {picked.name}
              </T>
              <T size={13} tint={color.text2}>{`${picked.kcal100} kcal per 100 g`}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TextInput
                  value={grams}
                  onChangeText={(g) => {
                    setGrams(g);
                    applyPick(picked, g);
                  }}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Grams eaten"
                  style={{ ...input, width: 110 }}
                />
                <T size={16} tint={color.text2}>
                  grams eaten
                </T>
              </View>
              <T size={13} tint={color.text2}>
                Filled in above. Change anything you like.
              </T>
            </Card>
          ) : null}
          {hits && !picked ? (
            hits.length ? (
              <Card pad={8}>
                {hits.slice(0, 10).map((h, i) => (
                  <Pressable
                    key={`${h.name}-${i}`}
                    accessibilityRole="button"
                    onPress={() => {
                      setPicked(h);
                      setGrams('100');
                      applyPick(h, '100');
                    }}
                    style={({ pressed }) => ({ minHeight: 60, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderColor: color.line, opacity: pressed ? 0.6 : 1 })}
                  >
                    <T size={15} weight="semibold">
                      {h.name}
                    </T>
                    <T size={13} tint={color.text2}>{`${h.kcal100} kcal per 100 g`}</T>
                  </Pressable>
                ))}
              </Card>
            ) : (
              <T size={14} tint={color.text2}>
                Nothing found. Try another word, or type the meal above.
              </T>
            )
          ) : null}
          <T size={13} tint={color.text2} style={{ marginTop: 6 }}>
            Without a key you get about 50 searches a day. A free key from fdc.nal.usda.gov/api-key-signup.html allows 1,000 an hour.
          </T>
          <TextInput
            value={f.fdcKey}
            onChangeText={(k) => change((x) => ({ ...x, fdcKey: k.trim() }))}
            placeholder="USDA key (optional)"
            placeholderTextColor={color.text2}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="USDA API key, optional"
            style={input}
          />
        </View>
      </ScrollView>
      {tp.sheet}
    </View>
  );
}

/* ---------- Meal times and reminders ---------- */

export function MealTimesScreen({ api, onBack }: { api: FoodApi; onBack: () => void }) {
  const { f, change } = api;
  const r = f.remind;
  const tp = useTimePicker('Meal time');
  const set = (p: Partial<typeof r>) => change((x) => ({ ...x, remind: { ...x.remind, ...p } }));
  const times = [...r.times].sort((a, b) => a - b);
  const put = (list: number[]) => set({ times: Array.from(new Set(list)).sort((a, b) => a - b).slice(0, MAX_MEAL_TIMES) });

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
            Meal reminders
          </Hero>
        </View>

        <Card pad={8}>
          <Row first title="Remind me to eat and log" sub={`${times.length} ${times.length === 1 ? 'meal' : 'meals'} a day`} right={<Toggle on={r.enabled} onPress={() => set({ enabled: !r.enabled })} label="Meal reminders" />} />
        </Card>

        <View style={{ gap: 8 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            Your meal times
          </T>
          <Card pad={8}>
            {times.map((m, i) => (
              <View key={m} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: i === 0 ? 0 : 1, borderColor: color.line, paddingHorizontal: 12 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Meal ${i + 1} at ${time12(Math.floor(m / 60), m % 60)}. Change time`}
                  onPress={() => tp.open(Math.floor(m / 60), m % 60, (h, mi) => put([...times.filter((x) => x !== m), h * 60 + mi]))}
                  style={({ pressed }) => ({ flex: 1, minHeight: 56, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
                >
                  <T size={17} weight="bold" tint={color.yellow}>
                    {time12(Math.floor(m / 60), m % 60)}
                  </T>
                </Pressable>
                {times.length > 1 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${time12(Math.floor(m / 60), m % 60)}`} onPress={() => put(times.filter((x) => x !== m))} style={{ minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' }}>
                    <T size={14} weight="semibold" tint={color.text2}>
                      Remove
                    </T>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </Card>
          {times.length < MAX_MEAL_TIMES ? (
            <Button label="Add a meal time" bg={color.surface2} fg={color.text} height={54} onPress={() => tp.open(12, 0, (h, mi) => put([...times, h * 60 + mi]))} />
          ) : (
            <T size={13} tint={color.text2}>{`Up to ${MAX_MEAL_TIMES} meals a day.`}</T>
          )}
          {times.join() !== DEFAULT_MEAL_TIMES.join() ? <LinkButton label="Use 8:00 am, 1:00 pm, 8:00 pm" onPress={() => put(DEFAULT_MEAL_TIMES)} /> : null}
        </View>

        <Card pad={16} style={{ gap: 6 }}>
          <T size={15} weight="bold">
            How it works
          </T>
          <T size={14} tint={color.text2}>
            You get one notification at each meal time and one more 30 minutes later if you have not logged a meal. If you logged in the hour before, it stays quiet. Tap it to open Add meal, where your past meals are one tap each.
          </T>
        </Card>
      </ScrollView>
      {tp.sheet}
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

/* ---------- Daily targets ---------- */

export function TargetsScreen({ api, weightKg, onBack, backLabel = 'Food' }: { api: FoodApi; weightKg: number | null; onBack: () => void; backLabel?: string }) {
  const { f, change } = api;
  const tg = f.targets;
  const set = (p: Partial<typeof tg>) => change((x) => ({ ...x, targets: { ...x.targets, ...p } }));
  const suggested = suggestedRestKcal(tg.goal, weightKg, tg);
  const better = hasProfile(weightKg, tg);
  const bump = (key: 'age' | 'heightCm', d: number, start: number, lo: number, hi: number) =>
    set({ [key]: Math.min(hi, Math.max(lo, (tg[key] ?? start - d) + d)), restKcal: null });
  const rest = tg.restKcal ?? suggested;
  const step = (d: number) => set({ restKcal: Math.min(5000, Math.max(800, rest + d)) });

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ ...page, gap: 18 }}>
        <View>
          <Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 48, justifyContent: 'center' }}>
            <T size={16} weight="semibold" tint={color.text2}>
              ‹ {backLabel}
            </T>
          </Pressable>
          <Hero size={34} tint={color.text}>
            Daily targets
          </Hero>
        </View>

        <View style={{ gap: 10 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            Your goal
          </T>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(['lose', 'maintain', 'build'] as Goal[]).map((g) => (
              <Chip key={g} label={GOAL_LABEL[g]} on={tg.goal === g} onPress={() => set({ goal: g, restKcal: null })} />
            ))}
          </View>
          <T size={14} tint={color.text2}>
            {`Changing the goal resets rest-day calories to the estimate (${GOAL_KCAL[tg.goal] >= 0 ? '+' : ''}${GOAL_KCAL[tg.goal]} kcal for this goal).`}
          </T>
        </View>

        {safetyOf(tg.health).notice ? (
          <Card pad={16}>
            <T size={14} weight="semibold" tint={color.yellow}>
              {safetyOf(tg.health).notice}
            </T>
          </Card>
        ) : null}

        {safetyOf(tg.health).hideWeight ? null : <GoalWeightCard api={api} weightKg={weightKg} />}

        <Card pad={16} style={{ gap: 12 }}>
          <T size={15} weight="bold">
            About you (optional)
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([['male', 'Male'], ['female', 'Female']] as [Sex, string][]).map(([k, l]) => (
              <Chip key={k} label={l} on={tg.sex === k} onPress={() => set({ sex: tg.sex === k ? null : k, restKcal: null })} />
            ))}
          </View>
          <Stepper label="Age" value={tg.age == null ? 'Not set' : `${tg.age}`} onDec={() => bump('age', -1, 25, 10, 90)} onInc={() => bump('age', 1, 25, 10, 90)} atMin={tg.age != null && tg.age <= 10} atMax={tg.age != null && tg.age >= 90} />
          <Stepper label="Height" value={tg.heightCm == null ? 'Not set' : `${tg.heightCm} cm`} onDec={() => bump('heightCm', -1, 170, 120, 230)} onInc={() => bump('heightCm', 1, 170, 120, 230)} atMin={tg.heightCm != null && tg.heightCm <= 120} atMax={tg.heightCm != null && tg.heightCm >= 230} />
          {tg.sex || tg.age != null || tg.heightCm != null ? <LinkButton label="Clear these" onPress={() => set({ sex: null, age: null, heightCm: null, restKcal: null })} /> : null}
          <T size={14} tint={color.text2}>
            {better ? 'Using age, height and weight for a better estimate.' : 'Add age and height, and your weight in Water settings, for a better estimate. They stay on your phone.'}
          </T>
          {isMinor(tg) ? (
            <T size={14} weight="semibold" tint={color.yellow}>
              Under 18: no lose or build adjustment is applied. Ask a doctor about calorie goals.
            </T>
          ) : null}
        </Card>

        <Card pad={16} style={{ gap: 12 }}>
          <Stepper label="Rest-day calories" value={`${rest} kcal`} onDec={() => step(-50)} onInc={() => step(50)} atMin={rest <= 800} atMax={rest >= 5000} />
          {tg.restKcal != null ? <LinkButton label={`Use the estimate (${suggested} kcal)`} onPress={() => set({ restKcal: null })} /> : null}
          <T size={14} tint={color.text2}>
            {weightKg == null ? 'The estimate uses a default because your weight is not set yet. Add it in Water settings.' : better ? `The estimate uses your age, height and ${weightKg} kg, adjusted for your goal.` : `The estimate is about 31 kcal per kg of your ${weightKg} kg, adjusted for your goal.`}
          </T>
        </Card>

        <Card pad={16} style={{ gap: 6 }}>
          <T size={15} weight="bold">
            Training days add food
          </T>
          <T size={14} tint={color.text2}>
            {`Gym days add ${DAY_KCAL.gym} kcal and run days add ${DAY_KCAL.run} kcal on top of a rest day. Days follow your alarm week plan, so a day with no alarm is a rest day.`}
          </T>
        </Card>

        <Card pad={16} style={{ gap: 6 }}>
          <T size={15} weight="bold">
            These are estimates
          </T>
          <T size={14} tint={color.text2}>
            {`Real needs depend on age, height, sex and how active you are. The estimate never goes below ${MIN_KCAL} kcal by itself. Use it as a starting point and adjust to how you feel and how your weight moves. Not medical advice. If you are under 18, pregnant, have a health condition, or have ever had an eating disorder, ask a doctor before setting a calorie goal.`}
          </T>
        </Card>
      </ScrollView>
    </View>
  );
}

/* ---------- Meal plan ---------- */

const SHORT: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 0: 'Sun' };

export function PlanScreen({
  api,
  now,
  weightKg,
  days,
  kinds,
  onBack,
  onAdd,
}: {
  api: FoodApi;
  now: number;
  weightKg: number | null;
  days: boolean[];
  kinds: ('gym' | 'run')[];
  onBack: () => void;
  onAdd: () => void;
}) {
  const { f, saveMeal } = api;
  const day = dayTypeOf(days, kinds, now);
  const goal = targetFor(f.targets, weightKg, day);
  const eaten = totalsOf(f, now);
  const slots = slotsFor(f.fast.enabled);
  const next = nextMealBudget(goal.kcal, goal.protein, eaten, slots.length);
  // Your own saved meals first, then common dishes to fill the list.
  const own = suggestMeals(f.saved, next.kcal);
  const picks = [...own, ...suggestMeals(dishesAsSaved(f.saved), next.kcal, 3 - own.length)].slice(0, 3);
  const week = weekPlan(f, weightKg, days, kinds, now);
  const perDay = week.openCount > 0 ? Math.round((week.openTarget - Math.max(0, eaten.kcal)) / week.openCount / 10) * 10 : 0;

  const log = (s: Saved) => saveMeal({ id: `m${Date.now()}`, t: Date.now(), name: s.name, kcal: s.kcal, protein: s.protein }, false);

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ ...page, gap: 16 }}>
        <View>
          <Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 48, justifyContent: 'center' }}>
            <T size={16} weight="semibold" tint={color.text2}>
              ‹ Food
            </T>
          </Pressable>
          <Hero size={34} tint={color.text}>
            Meal plan
          </Hero>
        </View>

        <Card bg={color.yellow} pad={20} radius={28} style={{ gap: 6 }}>
          <T size={14} weight="bold" tint={color.inkSoft}>
            {next.leftKcal <= 0 ? 'Target reached for today' : 'Next meal, about'}
          </T>
          <Hero size={52} tint={color.ink} fit>
            {next.leftKcal <= 0 ? `${-next.leftKcal} over` : `${next.kcal} kcal`}
          </Hero>
          <T size={15} weight="semibold" tint={color.inkSoft}>
            {next.leftKcal <= 0
              ? 'Nothing more is needed unless you are still hungry. Tomorrow starts fresh.'
              : `${next.leftKcal} kcal left today across about ${next.slotsLeft} ${next.slotsLeft === 1 ? 'meal' : 'meals'}${next.protein != null ? `, around ${next.protein} g protein each` : ''}.`}
          </T>
        </Card>

        {next.leftKcal > 0 ? (
          <View style={{ gap: 8 }}>
            <T size={14} weight="semibold" tint={color.text2}>
              Ideas for this meal
            </T>
            {picks.length ? (
              <Card pad={8}>
                {picks.map((s, i) => (
                  <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: i === 0 ? 0 : 1, borderColor: color.line, paddingHorizontal: 12 }}>
                    <View style={{ flex: 1, minHeight: 64, justifyContent: 'center' }}>
                      <T size={16} weight="semibold">
                        {s.name}
                      </T>
                      <T size={13} tint={color.text2}>{`${s.kcal} kcal${s.protein != null ? `, ${s.protein} g protein` : ''}`}</T>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Log ${s.name}`}
                      onPress={() => log(s)}
                      style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: color.yellow, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}
                    >
                      <T size={15} weight="bold" tint={color.ink}>
                        Log
                      </T>
                    </Pressable>
                  </View>
                ))}
              </Card>
            ) : (
              <Card pad={16} style={{ gap: 8 }}>
                <T size={14} tint={color.text2}>
                  None of your meals or common dishes fit this size.
                </T>
                <LinkButton label="Add a meal" onPress={onAdd} />
              </Card>
            )}
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            {`How today splits, ${goal.kcal} kcal`}
          </T>
          <Card pad={8}>
            {slots.map((s, i) => (
              <View key={s.name} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, paddingHorizontal: 12, borderTopWidth: i === 0 ? 0 : 1, borderColor: color.line }}>
                <T size={16} weight="semibold">
                  {s.name}
                </T>
                <T size={15} tint={color.text2}>
                  {`${Math.round((goal.kcal * s.share) / 10) * 10} kcal${goal.protein != null ? `, ${Math.round(goal.protein * s.share)} g` : ''}`}
                </T>
              </View>
            ))}
          </Card>
          <T size={13} tint={color.text2}>
            {f.fast.enabled ? 'Two meals and a snack fit your eating window.' : 'A simple split. Eat in whatever order suits you.'}
          </T>
        </View>

        <View style={{ gap: 8 }}>
          <T size={14} weight="semibold" tint={color.text2}>
            This week
          </T>
          <Card pad={8}>
            {week.days.map((d, i) => {
              const dt = new Date(d.t);
              const over = d.eaten > d.target;
              return (
                <View key={d.t} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 12, borderTopWidth: i === 0 ? 0 : 1, borderColor: color.line }}>
                  <View style={{ width: 64 }}>
                    <T size={16} weight={d.when === 'today' ? 'bold' : 'semibold'} tint={d.when === 'today' ? color.yellow : color.text}>
                      {SHORT[dt.getDay()]}
                    </T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T size={14} tint={color.text2}>
                      {DAY_NAME[d.type]}
                    </T>
                  </View>
                  <T size={15} weight="semibold" tint={d.when === 'ahead' ? color.text2 : over ? color.yellow : color.text}>
                    {d.when === 'ahead' ? `${d.target}` : `${d.eaten} / ${d.target}`}
                  </T>
                </View>
              );
            })}
          </Card>
          <Card pad={16} style={{ gap: 4 }}>
            <T size={15} weight="bold">
              {`${week.eatenSoFar} of ${week.budget} kcal this week`}
            </T>
            <T size={14} tint={color.text2}>
              {week.openCount > 0
                ? `About ${Math.max(0, perDay)} kcal a day for the ${week.openCount} ${week.openCount === 1 ? 'day' : 'days'} still open, counting today. Earlier days are not made up. A day is a fresh start.`
                : 'That is the whole week.'}
            </T>
          </Card>
        </View>

        <T size={13} tint={color.text2}>
          Estimates only. The plan never tells you to eat less than your own target.
        </T>
      </ScrollView>
    </View>
  );
}
