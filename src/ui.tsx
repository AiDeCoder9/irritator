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

export function HeatBar({ level, fill, track }: { level: number; fill: string; track: string }) {
  return (
    <View style={styles.heat} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={[
            styles.seg,
            n <= level ? { backgroundColor: fill } : { borderWidth: 2, borderColor: track },
          ]}
        />
      ))}
    </View>
  );
}

export function Hero({
  children,
  size = 184,
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
        lineHeight: size * 0.9,
        letterSpacing: -2,
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
  size = 17,
  weight = 'body',
  tint,
  style,
}: {
  children: ReactNode;
  size?: number;
  weight?: 'body' | 'semibold' | 'bold';
  tint: string;
  style?: TextStyle;
}) {
  return (
    <Text style={[{ fontFamily: font[weight], fontSize: size, lineHeight: size * 1.4, color: tint }, style]}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  bg,
  fg,
  outline,
  disabled,
}: {
  label: string;
  onPress: () => void;
  bg?: string;
  fg: string;
  outline?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg ?? 'transparent',
          borderWidth: outline ? 2 : 0,
          borderColor: outline,
          opacity: disabled ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Text style={{ fontFamily: font.bold, fontSize: 20, color: fg }}>{label}</Text>
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
  return (
    <View style={styles.stepRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        disabled={atMin}
        onPress={onDec}
        style={[styles.step, atMin && styles.stepOff]}
      >
        <Text style={[styles.stepText, atMin && { color: '#6B6F78' }]}>−</Text>
      </Pressable>
      <View style={{ alignItems: 'center', flex: 1 }}>
        <Text style={{ fontFamily: font.display, fontSize: 56, lineHeight: 56, color: color.graphite }}>{value}</Text>
        <T size={15} weight="semibold" tint={color.iron}>
          {label}
        </T>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        disabled={atMax}
        onPress={onInc}
        style={[styles.step, atMax && styles.stepOff]}
      >
        <Text style={[styles.stepText, atMax && { color: '#6B6F78' }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 28, paddingBottom: 36, justifyContent: 'space-between' },
  heat: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 8, borderRadius: 4 },
  btn: { height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: color.graphite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: { borderColor: '#8D8F95' },
  stepText: { fontFamily: font.semibold, fontSize: 30, lineHeight: 34, color: color.graphite },
});

/** One-tap choice button. Big enough to hit with a thumb. */
export function Chip({
  label,
  on,
  onPress,
  a11y,
  disabled,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  a11y?: string;
  disabled?: boolean;
}) {
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
        borderRadius: 12,
        borderWidth: 2,
        borderColor: color.graphite,
        backgroundColor: on ? color.graphite : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Text style={{ fontFamily: font.semibold, fontSize: 16, color: on ? color.white : color.graphite }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Each new screen fades in with a small rise (220ms, strong ease-out). Reduced motion: fade only. */
export function FadeIn({ children }: { children: ReactNode }) {
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
        flex: 1,
        opacity: v,
        transform: [{ translateY: reduce ? 0 : v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
