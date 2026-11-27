import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import {
  DAY_KCAL,
  DayType,
  dayTypeOf,
  EAT_HOURS,
  Goal,
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
  Saved,
  scaleFor,
  searchFoods,
  todaysMeals,
  totalsOf,
  updateFood,
} from './food';
import { time12, timeText } from './phase';
import { useTimePicker } from './timePicker';
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
  onTargets,
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

  // Food search (USDA FoodData Central)
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Hit | null>(null);
  const [grams, setGrams] = useState('100');

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

export function TargetsScreen({ api, weightKg, onBack }: { api: FoodApi; weightKg: number | null; onBack: () => void }) {
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
              ‹ Food
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
