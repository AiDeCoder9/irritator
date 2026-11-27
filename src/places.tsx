import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { currentPlace, findAddress } from './gym';
import type { Gym, Home, State } from './store';
import { color, font } from './theme';
import { Button, Chip, FadeIn, T } from './ui';

type Props = { s: State; onChange: (p: Partial<State>) => void };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Editing = { kind: 'home' } | { kind: 'gym'; gym: Gym | null } | null;

/** Home, the gyms you go to, and the forms to change them. Used in setup and in Settings. */
export function Places({ s, onChange }: Props) {
  const [editing, setEditing] = useState<Editing>(null);
  const [undo, setUndo] = useState<Gym | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  if (editing) {
    return (
      <FadeIn fill={false} key={editing.kind}>
        <PlaceForm
          kind={editing.kind}
          initial={editing.kind === 'gym' ? editing.gym : s.home}
          onCancel={() => setEditing(null)}
          onSave={(v) => {
            if (editing.kind === 'home') {
              onChange({ home: { lat: v.lat, lng: v.lng, label: v.label } });
            } else {
              const id = editing.gym?.id ?? `g${Date.now()}`;
              const gym: Gym = { id, label: v.label, lat: v.lat, lng: v.lng, travelMin: v.travelMin };
              const gyms = editing.gym ? s.gyms.map((g) => (g.id === id ? gym : g)) : [...s.gyms, gym];
              onChange({ gyms, activeGymId: s.activeGymId ?? id });
            }
            setEditing(null);
          }}
        />
      </FadeIn>
    );
  }

  const remove = (g: Gym) => {
    const gyms = s.gyms.filter((x) => x.id !== g.id);
    onChange({ gyms, activeGymId: s.activeGymId === g.id ? (gyms[0]?.id ?? null) : s.activeGymId });
    setUndo(g);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), 6000);
  };

  const restore = () => {
    if (!undo) return;
    onChange({ gyms: [...s.gyms, undo], activeGymId: s.activeGymId ?? undo.id });
    setUndo(null);
  };

  return (
    <View style={{ gap: 18 }}>
      <View>
        <T size={15} weight="semibold" tint={color.iron}>
          Home
        </T>
        <Row
          title={s.home ? s.home.label : 'Not set'}
          sub={s.home ? 'Used to see you leave.' : 'Optional. Lets the app see you leave.'}
          action={s.home ? 'Change' : 'Set'}
          onPress={() => setEditing({ kind: 'home' })}
        />
      </View>

      <View>
        <T size={15} weight="semibold" tint={color.iron}>
          Gyms
        </T>
        {s.gyms.map((g) => (
          <Row
            key={g.id}
            title={g.label}
            sub={`${g.travelMin} min away`}
            action="Edit"
            onPress={() => setEditing({ kind: 'gym', gym: g })}
            onRemove={() => remove(g)}
          />
        ))}
        <Row title="Add a gym" plus onPress={() => setEditing({ kind: 'gym', gym: null })} last />
      </View>

      {undo ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: color.graphite,
            borderRadius: 12,
            paddingLeft: 16,
          }}
        >
          <T size={15} tint={color.white}>
            {undo.label} removed
          </T>
          <Pressable accessibilityRole="button" onPress={restore} style={{ minHeight: 48, paddingHorizontal: 16, justifyContent: 'center' }}>
            <T size={15} weight="bold" tint={color.amber}>
              Undo
            </T>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Row({
  title,
  sub,
  action,
  onPress,
  onRemove,
  plus,
  last,
}: {
  title: string;
  sub?: string;
  action?: string;
  onPress: () => void;
  onRemove?: () => void;
  plus?: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1.5,
        borderBottomWidth: last ? 1.5 : 0,
        borderColor: color.graphite,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action ? `${action} ${title}` : title}
        onPress={onPress}
        style={({ pressed }) => ({ flex: 1, minHeight: 56, justifyContent: 'center', paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
      >
        <T size={17} weight="semibold" tint={color.graphite}>
          {plus ? '+ ' : ''}
          {title}
        </T>
        {sub ? (
          <T size={14} tint={color.iron}>
            {sub}
          </T>
        ) : null}
      </Pressable>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${title}`}
          onPress={onRemove}
          style={{ minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' }}
        >
          <T size={15} weight="semibold" tint={color.iron}>
            Remove
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

function PlaceForm({
  kind,
  initial,
  onSave,
  onCancel,
}: {
  kind: 'home' | 'gym';
  initial: Gym | Home | null;
  onSave: (v: { label: string; lat: number; lng: number; travelMin: number }) => void;
  onCancel: () => void;
}) {
  const isGym = kind === 'gym';
  const [label, setLabel] = useState(initial?.label ?? '');
  const [pt, setPt] = useState<{ lat: number; lng: number } | null>(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [address, setAddress] = useState('');
  const [travel, setTravel] = useState(initial && 'travelMin' in initial ? initial.travelMin : 20);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const attempt = async (fn: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
    } catch (e) {
      setProblem(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const useHere = () =>
    attempt(async () => {
      const p = await currentPlace();
      setPt({ lat: p.lat, lng: p.lng });
    });

  const search = () =>
    attempt(async () => {
      if (address.trim().length < 3) throw new Error('Type the place and area, for example "Cult Fit, Koramangala".');
      setPt(await findAddress(address.trim()));
      if (!label.trim()) setLabel(address.trim());
    });

  const save = () => {
    if (!pt) return setProblem(isGym ? 'Save a location first.' : 'Save a location first.');
    const name = label.trim() || (isGym ? 'My gym' : 'Home');
    onSave({ label: name, lat: pt.lat, lng: pt.lng, travelMin: travel });
  };

  const input = {
    height: 52,
    borderWidth: 2,
    borderColor: color.graphite,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: font.body,
    fontSize: 17,
    color: color.graphite,
  } as const;

  return (
    <View style={{ gap: 14 }}>
      <T size={22} weight="bold" tint={color.graphite}>
        {isGym ? (initial ? 'Edit gym' : 'Add a gym') : 'Your home'}
      </T>

      <TextInput
        value={label}
        onChangeText={setLabel}
        placeholder={isGym ? 'Gym name' : 'Name, for example Home'}
        placeholderTextColor={color.iron}
        style={input}
      />

      <Button label={busy ? 'Finding you…' : 'Use my current location'} onPress={useHere} bg={color.graphite} fg={color.white} disabled={busy} />
      <T size={15} tint={color.iron}>
        {isGym ? 'Best while you stand inside the gym.' : 'Best while you are at home.'}
      </T>

      <T size={17} weight="semibold" tint={color.graphite}>
        Or type an address
      </T>
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="Place, area, city"
        placeholderTextColor={color.iron}
        returnKeyType="search"
        onSubmitEditing={search}
        style={input}
      />
      <Button label="Find address" onPress={search} outline={color.graphite} fg={color.graphite} disabled={busy} />

      {isGym ? (
        <View style={{ gap: 10 }}>
          <T size={17} weight="semibold" tint={color.graphite}>
            Minutes to travel there
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[10, 15, 20, 30, 45, 60].map((m) => (
              <Chip key={m} label={String(m)} a11y={`${m} minutes`} on={travel === m} onPress={() => setTravel(m)} />
            ))}
          </View>
        </View>
      ) : null}

      {problem ? (
        <T size={16} weight="semibold" tint={color.graphite}>
          {problem}
        </T>
      ) : null}
      {pt ? (
        <T size={16} weight="bold" tint={color.cleared}>
          Location saved
        </T>
      ) : null}

      <Button label="Save" onPress={save} bg={color.graphite} fg={color.white} />
      <Pressable accessibilityRole="button" onPress={onCancel} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <T size={16} weight="semibold" tint={color.iron} style={{ textDecorationLine: 'underline' }}>
          Cancel
        </T>
      </Pressable>
    </View>
  );
}
