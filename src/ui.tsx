import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { color, font } from './theme';

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export const topInset = (RNStatusBar.currentHeight ?? 24) + 12;

export function Screen({ bg, children }: { bg: string; children: ReactNode }) {
  return <View style={[styles.screen, { backgroundColor: bg, paddingTop: topInset }]}>{children}</View>;
}

/** Big numbers and headings. Sora, tight tracking. */
export function Hero({
  children,
  size = 120,
  tint,
  fit,
}: {
  children: ReactNode;
  size?: number;
  tint: string;
  /** One line only: shrink the text to fit the width instead of wrapping. */
  fit?: boolean;
}) {
  return (
    <Text
      {...(fit ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.4 } : {})}
      style={{
        fontFamily: font.display,
        fontSize: size,
        lineHeight: size * 1.08,
        letterSpacing: -size * 0.035,
        color: tint,
        fontVariant: ['tabular-nums'],
      }}
    >
      {children}
    </Text>
  );
}

export function T({
  children,
  size = 16,
  weight = 'body',
  tint = color.text,
  style,
}: {
  children: ReactNode;
  size?: number;
  weight?: 'body' | 'semibold' | 'bold';
  tint?: string;
  style?: TextStyle;
}) {
  return (
    <Text style={[{ fontFamily: font[weight], fontSize: size, lineHeight: size * 1.4, color: tint }, style]}>
      {children}
    </Text>
  );
}

/** A rounded surface. No borders, no shadows: depth comes from the surface color. */
export function Card({ children, bg = color.surface, pad = 20, radius = 24, style }: { children: ReactNode; bg?: string; pad?: number; radius?: number; style?: ViewStyle }) {
  return <View style={[{ backgroundColor: bg, borderRadius: radius, padding: pad, gap: 12 }, style]}>{children}</View>;
}

/** A row inside a Card with pad 8. Hairline above every row but the first. */
export function Row({
  title,
  sub,
  right,
  onPress,
  first,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  onPress?: () => void;
  first?: boolean;
}) {
  const body = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={17} weight="semibold">
          {title}
        </T>
        {sub ? (
          <T size={14} tint={color.text2}>
            {sub}
          </T>
        ) : null}
      </View>
      {right}
    </>
  );
  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: first ? 0 : 1,
    borderColor: color.line,
  };
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.6 : 1 }]}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

export const Chevron = () => (
  <T size={22} weight="bold" tint={color.text2}>
    ›
  </T>
);

export function Button({
  label,
  onPress,
  bg = color.yellow,
  fg = color.ink,
  disabled,
  height = 60,
}: {
  label: string;
  onPress: () => void;
  bg?: string;
  fg?: string;
  disabled?: boolean;
  height?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        { height, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: bg },
        { opacity: disabled ? 0.55 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      <Text style={{ fontFamily: font.bold, fontSize: 18, color: fg }}>{label}</Text>
    </Pressable>
  );
}

/** Quiet text button. */
export function LinkButton({ label, onPress, tint = color.text2 }: { label: string; onPress: () => void; tint?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ fontFamily: font.semibold, fontSize: 15, color: tint }}>{label}</Text>
    </Pressable>
  );
}

/** One-tap choice pill. On a yellow screen pass tone="yellow". */
export function Chip({
  label,
  on,
  onPress,
  a11y,
  disabled,
  tone = 'dark',
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  a11y?: string;
  disabled?: boolean;
  tone?: 'dark' | 'yellow';
}) {
  const yellow = tone === 'yellow';
  const bg = on ? (yellow ? color.ink : color.yellow) : yellow ? color.yellowDeep : color.surface2;
  const fg = on ? (yellow ? color.yellow : color.ink) : yellow ? color.ink : color.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected: on }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 48,
        borderRadius: 999,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 15, color: fg, paddingHorizontal: 6 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Toggle({ on, onPress, label, tone = 'dark' }: { on: boolean; onPress: () => void; label: string; tone?: 'dark' | 'yellow' }) {
  const yellow = tone === 'yellow';
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 56,
        height: 32,
        borderRadius: 16,
        padding: 3,
        justifyContent: 'center',
        alignItems: on ? 'flex-end' : 'flex-start',
        backgroundColor: on ? (yellow ? color.ink : color.yellow) : yellow ? color.yellowDeep : color.surface2,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: on ? (yellow ? color.yellow : color.ink) : yellow ? color.ink : color.text2,
        }}
      />
    </Pressable>
  );
}

export function Stepper({
  label,
  value,
  onDec,
  onInc,
  atMin,
  atMax,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
  atMin?: boolean;
  atMax?: boolean;
}) {
  const btn = (sign: string, a11y: string, off: boolean | undefined, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: color.surface2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: off ? 0.4 : 1,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <Text style={{ fontFamily: font.bold, fontSize: 24, color: color.text }}>{sign}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {btn('−', `Decrease ${label}`, atMin, onDec)}
      <Text style={{ fontFamily: font.display, fontSize: 22, color: color.text, minWidth: 36, textAlign: 'center' }}>{value}</Text>
      {btn('+', `Increase ${label}`, atMax, onInc)}
    </View>
  );
}

/** Yellow and black caution tape. The one decorative detail in the app. */
export function Tape({ height = 14 }: { height?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height, borderRadius: height / 2, backgroundColor: color.black, overflow: 'hidden', flexDirection: 'row' }}
    >
      {Array.from({ length: 40 }, (_, i) => (
        <View key={i} style={{ width: height, height, marginRight: height, backgroundColor: color.yellow, transform: [{ skewX: '-35deg' }] }} />
      ))}
    </View>
  );
}

/** Awake, left home, at the gym. For yellow screens. Without a saved home there are two stages. */
export function Steps({ stage, hasHome, leftAt, fmt }: { stage: 1 | 2; hasHome: boolean; leftAt: number | null; fmt: (ts: number) => string }) {
  const labels = hasHome ? ['Awake', leftAt != null ? `Left ${fmt(leftAt)}` : 'Leave home', 'At the gym'] : ['Awake', 'At the gym'];
  const done = hasHome ? (stage === 2 ? 2 : 1) : 1;
  return (
    <View accessible accessibilityLabel={`Progress: ${labels.slice(0, done).join(', then ')}`} style={{ flexDirection: 'row' }}>
      {labels.map((l, i) => (
        <View key={l} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: i < done ? color.ink : 'transparent',
              borderWidth: i < done ? 0 : 2.5,
              borderColor: color.ink,
            }}
          >
            {i < done ? <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.yellow }}>✓</Text> : null}
          </View>
          <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 12, color: color.ink }}>
            {l}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Floating pill navigation. */
type Tab = 'today' | 'food' | 'water' | 'progress' | 'settings';
export function TabBar({ active, onTab }: { active: Tab; onTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'food', label: 'Food' },
    { id: 'water', label: 'Water' },
    { id: 'progress', label: 'Progress' },
    { id: 'settings', label: 'Settings' },
  ];
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 18, paddingTop: 6, backgroundColor: color.black }}>
      <View style={{ flexDirection: 'row', gap: 4, backgroundColor: color.surface, borderRadius: 999, padding: 6, borderWidth: 1, borderColor: color.line }}>
        {items.map((it) => {
          const on = it.id === active;
          return (
            <Pressable
              key={it.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => onTab(it.id)}
              style={({ pressed }) => ({
                flex: 1,
                height: 52,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? color.yellow : 'transparent',
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: on ? color.ink : color.text2 }}>{it.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Each new screen fades in with a small rise (220ms, strong ease-out). Reduced motion: fade only. */
export function FadeIn({ children, fill = true }: { children: ReactNode; fill?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((r) => {
        if (!alive) return;
        setReduce(r);
        Animated.timing(v, {
          toValue: 1,
          duration: r ? 150 : 220,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: true,
        }).start();
      });
    return () => {
      alive = false;
    };
  }, [v]);
  return (
    <Animated.View
      style={{
        flex: fill ? 1 : undefined,
        opacity: v,
        transform: [{ translateY: reduce ? 0 : v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingBottom: 28, justifyContent: 'space-between', gap: 14 },
});
