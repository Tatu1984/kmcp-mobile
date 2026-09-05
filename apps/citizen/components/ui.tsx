import * as React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "../lib/theme";

/**
 * The whole visual vocabulary of the citizen app.
 *
 * These are the `.c-*` classes from the approved mockup, one component each,
 * so that a change to a card's padding happens in one place rather than in
 * seven screens. Two rules run through all of it and are worth stating because
 * they are easy to break by accident:
 *
 *  - nothing tappable is smaller than `theme.minTouch`;
 *  - nothing relies on colour alone. Every green, amber and red thing here is
 *    also carrying a number or a word, because a driver who cannot tell the
 *    three apart still needs to know whether there is a space.
 */

export type Tone = "good" | "warn" | "crit" | "flat";

export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const padding = { paddingBottom: insets.bottom + theme.space(2) };

  if (!scroll) return <View style={[styles.screen, padding, style]}>{children}</View>;

  return (
    <ScrollView
      style={[styles.screenScroll, style]}
      contentContainerStyle={[styles.screen, padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "large",
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress: () => void;
  /** `ghost` is an outline on the page ground; `dark` is the ink-filled button. */
  variant?: "primary" | "ghost" | "dark";
  size?: "large" | "medium";
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
}) {
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(busy) }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        size === "large" ? styles.buttonLarge : styles.buttonMedium,
        buttonVariant[variant],
        pressed && !inactive && styles.buttonPressed,
        inactive && styles.buttonDisabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={variant === "ghost" ? theme.colour.ink : theme.colour.primaryText}
        />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            size === "medium" && styles.buttonLabelMedium,
            variant === "ghost" && styles.buttonLabelGhost,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  raise = false,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  /** The bordered card recedes; the raised one is a panel that carries a figure. */
  raise?: boolean;
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const base = [styles.card, raise ? styles.cardRaise : null, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [...base, pressed && styles.cardPressed]}
    >
      {children}
    </Pressable>
  );
}

export const H1 = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.h1}>{children}</Text>
);

export const H2 = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) => (
  <Text style={[styles.h2, style]}>{children}</Text>
);

export const Sub = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) => <Text style={[styles.sub, style]}>{children}</Text>;

/** The small uppercase caption above a value. Never a value itself. */
export const Label = ({ children, style }: { children: string; style?: TextStyle }) => (
  <Text style={[styles.label, style]}>{children.toUpperCase()}</Text>
);

/** A fare or a balance, at the size the mockup gives it. */
export const Money = ({ children, style }: { children: string; style?: TextStyle }) => (
  <Text style={[styles.money, style]}>{children}</Text>
);

/** A number plate, monospaced, because it is read character by character. */
export const Plate = ({ children }: { children: string }) => (
  <Text style={styles.plate}>{children}</Text>
);

export function Field({
  label,
  hint,
  error,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={theme.colour.muted}
        {...props}
        style={[styles.input, error ? styles.inputError : null, props.style]}
      />
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Sub style={styles.fieldHint}>{hint}</Sub>
      ) : null}
    </View>
  );
}

/** A label on the left, a figure on the right, a hairline underneath. */
export function Row({
  label,
  value,
  last = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  last?: boolean;
  emphasis?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasis && styles.rowValueEmphasis]}>{value}</Text>
    </View>
  );
}

export function Chip({ label, tone = "flat" }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.chip, chipStyle[tone]]}>
      <Text style={[styles.chipLabel, chipLabel[tone]]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** The small square that ties a legend entry to a bar segment. */
export const Swatch = ({ colour }: { colour: string }) => (
  <View style={[styles.swatch, { backgroundColor: colour }]} />
);

export function Banner({
  tone,
  title,
  body,
}: {
  tone: "info" | "good" | "warn" | "crit";
  title: string;
  body?: string;
}) {
  return (
    <View style={[styles.banner, bannerStyle[tone]]}>
      <Text style={styles.bannerTitle}>{title}</Text>
      {body ? <Text style={styles.bannerBody}>{body}</Text> : null}
    </View>
  );
}

/** Explains why a screen is empty, rather than showing nothing at all. */
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

/**
 * The state a screen shows when the server has no such door yet.
 *
 * Deliberately distinct from `Empty`. "You have no history" and "history is not
 * built" are different facts, and showing the first when the second is true is
 * how a person concludes the app has lost their money. Anything that would
 * otherwise be a confident zero belongs behind this.
 */
export function Unavailable({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.unavailable}>
      <Text style={styles.unavailableTitle}>{title}</Text>
      <Text style={styles.unavailableBody}>{body}</Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={theme.colour.primary} />
      {label ? <Sub>{label}</Sub> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenScroll: { flex: 1, backgroundColor: theme.colour.bg },
  screen: {
    flexGrow: 1,
    backgroundColor: theme.colour.bg,
    padding: theme.space(2),
    gap: theme.space(1.5),
  },

  button: {
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: theme.space(2.5),
  },
  buttonLarge: { minHeight: 54 },
  buttonMedium: { minHeight: theme.minTouch },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { fontSize: 18, fontWeight: "600", color: theme.colour.primaryText },
  buttonLabelMedium: { fontSize: 16 },
  buttonLabelGhost: { color: theme.colour.ink },

  card: {
    backgroundColor: theme.colour.bg,
    borderWidth: 1,
    borderColor: theme.colour.line,
    borderRadius: theme.radius.lg,
    padding: theme.space(2),
    gap: theme.space(1.125),
  },
  cardRaise: { backgroundColor: theme.colour.raise, borderColor: "transparent" },
  cardPressed: { backgroundColor: theme.colour.raise },

  h1: { ...theme.text.h1, color: theme.colour.ink },
  h2: { ...theme.text.title, color: theme.colour.ink },
  sub: { ...theme.text.sub, color: theme.colour.muted },
  label: { ...theme.text.label, color: theme.colour.muted },
  money: { ...theme.text.display, color: theme.colour.ink, fontVariant: ["tabular-nums"] },
  plate: {
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: 1,
    color: theme.colour.ink,
    fontVariant: ["tabular-nums"],
  },

  field: { gap: theme.space(0.875) },
  input: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: theme.colour.line,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(2),
    backgroundColor: theme.colour.bg,
    color: theme.colour.ink,
    fontSize: 19,
    fontWeight: "600",
  },
  inputError: { borderColor: theme.colour.crit },
  fieldHint: { fontSize: 13 },
  fieldError: { ...theme.text.small, color: theme.colour.crit },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.space(1.75),
    paddingVertical: theme.space(1.375),
    borderBottomWidth: 1,
    borderBottomColor: theme.colour.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 15, color: theme.colour.muted, flexShrink: 1 },
  rowValue: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colour.ink,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  rowValueEmphasis: { fontSize: 17, fontWeight: "700" },

  chip: {
    paddingHorizontal: theme.space(1.375),
    paddingVertical: theme.space(0.625),
    borderRadius: theme.radius.pill,
    alignSelf: "flex-start",
  },
  chipLabel: { fontSize: 13, fontWeight: "700" },

  swatch: { width: 9, height: 9, borderRadius: 2 },

  banner: {
    borderRadius: theme.radius.md,
    padding: theme.space(1.5),
    gap: theme.space(0.5),
    borderWidth: 1,
  },
  bannerTitle: { fontSize: 15, fontWeight: "700", color: theme.colour.ink },
  bannerBody: { fontSize: 13.5, color: theme.colour.muted, lineHeight: 19 },

  empty: { padding: theme.space(3), alignItems: "center", gap: theme.space(1) },
  emptyTitle: { ...theme.text.title, color: theme.colour.ink, textAlign: "center" },
  emptyBody: { ...theme.text.sub, color: theme.colour.muted, textAlign: "center" },

  unavailable: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colour.line,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colour.raise,
    padding: theme.space(2.5),
    gap: theme.space(1),
  },
  unavailableTitle: { fontSize: 16, fontWeight: "700", color: theme.colour.ink },
  unavailableBody: { fontSize: 13.5, color: theme.colour.muted, lineHeight: 20 },

  loading: { padding: theme.space(4), alignItems: "center", gap: theme.space(1.5) },
});

const buttonVariant = StyleSheet.create({
  primary: { backgroundColor: theme.colour.primary },
  ghost: {
    backgroundColor: theme.colour.bg,
    borderWidth: 1.5,
    borderColor: theme.colour.line,
  },
  dark: { backgroundColor: theme.colour.ink },
});

const chipStyle = StyleSheet.create({
  good: { backgroundColor: theme.colour.goodWash },
  warn: { backgroundColor: theme.colour.warnWash },
  crit: { backgroundColor: theme.colour.critWash },
  flat: { backgroundColor: theme.colour.raise },
});

const chipLabel = StyleSheet.create({
  good: { color: theme.colour.good },
  warn: { color: theme.colour.warn },
  crit: { color: theme.colour.crit },
  flat: { color: theme.colour.muted },
});

const bannerStyle = StyleSheet.create({
  info: { backgroundColor: theme.colour.primaryWash, borderColor: "#BFD5F8" },
  good: { backgroundColor: theme.colour.goodWash, borderColor: "#B8DFC7" },
  warn: { backgroundColor: theme.colour.warnWash, borderColor: "#F0D2AC" },
  crit: { backgroundColor: theme.colour.critWash, borderColor: "#EFC2C2" },
});
