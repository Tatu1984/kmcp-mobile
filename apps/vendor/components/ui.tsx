import * as React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "../lib/theme";

/**
 * The whole visual vocabulary of this app.
 *
 * Deliberately small. An attendant uses four screens all day in bright sun,
 * often one-handed and sometimes wearing gloves, so the useful variation is in
 * size and contrast rather than in shape. Nothing here is smaller than
 * `theme.minTouch`, and nothing relies on colour alone to carry meaning.
 */

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingBottom: insets.bottom + theme.space(2),
  };

  if (!scroll) {
    return <View style={[styles.screen, padding, style]}>{children}</View>;
  }

  return (
    <ScrollView
      style={styles.screenScroll}
      contentContainerStyle={[styles.screen, padding, style]}
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
  disabled,
  busy,
  size = "large",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "success";
  disabled?: boolean;
  busy?: boolean;
  size?: "large" | "medium";
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
        variantStyle[variant],
        pressed && !inactive && styles.buttonPressed,
        inactive && styles.buttonDisabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={theme.colour.primaryText} />
      ) : (
        <Text style={[styles.buttonLabel, size === "medium" && styles.buttonLabelMedium]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
    >
      {children}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  error,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <TextInput
        placeholderTextColor={theme.colour.textMuted}
        {...props}
        style={[styles.input, error ? styles.inputError : null, props.style]}
      />
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** A label above a value. The commonest thing on every screen here. */
export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.statValue, toneStyle[tone]]}>{value}</Text>
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/**
 * A number plate, rendered the way it appears on the vehicle.
 *
 * The single most important thing on any screen in this app: it is what the
 * attendant checks against the car in front of them, so it is the largest.
 */
export function Plate({ value, size = "large" }: { value: string; size?: "large" | "small" }) {
  return (
    <Text style={size === "large" ? styles.plateLarge : styles.plateSmall} numberOfLines={1}>
      {value}
    </Text>
  );
}

export function Pill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <View style={[styles.pill, pillStyle[tone]]}>
      <Text style={[styles.pillLabel, pillLabelStyle[tone]]}>{label}</Text>
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

export function Banner({
  tone,
  title,
  body,
}: {
  tone: "info" | "warning" | "danger" | "success";
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

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={theme.colour.primary} />
      {label ? <Text style={styles.loadingLabel}>{label}</Text> : null}
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
  },
  buttonLarge: { minHeight: 60, paddingHorizontal: theme.space(3) },
  buttonMedium: { minHeight: theme.minTouch, paddingHorizontal: theme.space(2) },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { ...theme.text.title, color: theme.colour.primaryText },
  buttonLabelMedium: { ...theme.text.body, color: theme.colour.primaryText },

  card: {
    backgroundColor: theme.colour.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colour.border,
    padding: theme.space(2),
    gap: theme.space(1),
  },
  cardPressed: { backgroundColor: theme.colour.surfaceAlt },

  field: { gap: theme.space(0.75) },
  fieldLabel: { ...theme.text.label, color: theme.colour.textMuted },
  input: {
    minHeight: 60,
    backgroundColor: theme.colour.surface,
    borderWidth: 1,
    borderColor: theme.colour.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(2),
    color: theme.colour.text,
    fontSize: 20,
    fontWeight: "600",
  },
  inputError: { borderColor: theme.colour.danger },
  fieldHint: { ...theme.text.small, color: theme.colour.textMuted },
  fieldError: { ...theme.text.small, color: theme.colour.danger },

  stat: { gap: theme.space(0.5) },
  statLabel: { ...theme.text.label, color: theme.colour.textMuted },
  statValue: { ...theme.text.title, color: theme.colour.text },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.space(2),
    paddingVertical: theme.space(1),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colour.border,
  },
  rowLabel: { ...theme.text.body, color: theme.colour.textMuted, flexShrink: 1 },
  rowValue: { ...theme.text.body, color: theme.colour.text, textAlign: "right", flexShrink: 1 },

  plateLarge: { ...theme.text.display, color: theme.colour.text },
  plateSmall: { fontSize: 20, fontWeight: "700", letterSpacing: 0.5, color: theme.colour.text },

  pill: {
    paddingHorizontal: theme.space(1.25),
    paddingVertical: theme.space(0.5),
    borderRadius: theme.radius.pill,
    alignSelf: "flex-start",
  },
  pillLabel: { ...theme.text.small, fontWeight: "700" },

  empty: { padding: theme.space(3), alignItems: "center", gap: theme.space(1) },
  emptyTitle: { ...theme.text.title, color: theme.colour.text, textAlign: "center" },
  emptyBody: { ...theme.text.body, color: theme.colour.textMuted, textAlign: "center" },

  banner: {
    borderRadius: theme.radius.md,
    padding: theme.space(1.5),
    gap: theme.space(0.5),
    borderWidth: 1,
  },
  bannerTitle: { ...theme.text.body, color: theme.colour.text, fontWeight: "700" },
  bannerBody: { ...theme.text.small, color: theme.colour.textMuted },

  loading: { padding: theme.space(4), alignItems: "center", gap: theme.space(1.5) },
  loadingLabel: { ...theme.text.body, color: theme.colour.textMuted },
});

const variantStyle = StyleSheet.create({
  primary: { backgroundColor: theme.colour.primary },
  secondary: {
    backgroundColor: theme.colour.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colour.border,
  },
  danger: { backgroundColor: theme.colour.danger },
  success: { backgroundColor: theme.colour.success },
});

const toneStyle = StyleSheet.create({
  default: { color: theme.colour.text },
  success: { color: theme.colour.success },
  warning: { color: theme.colour.warning },
  danger: { color: theme.colour.danger },
});

const pillStyle = StyleSheet.create({
  default: { backgroundColor: theme.colour.surfaceAlt },
  info: { backgroundColor: "#1E3A8A" },
  success: { backgroundColor: "#14532D" },
  warning: { backgroundColor: "#78350F" },
  danger: { backgroundColor: "#7F1D1D" },
});

const pillLabelStyle = StyleSheet.create({
  default: { color: theme.colour.textMuted },
  info: { color: "#BFDBFE" },
  success: { color: "#BBF7D0" },
  warning: { color: "#FDE68A" },
  danger: { color: "#FECACA" },
});

const bannerStyle = StyleSheet.create({
  info: { backgroundColor: "#172554", borderColor: "#1E40AF" },
  success: { backgroundColor: "#052E16", borderColor: "#166534" },
  warning: { backgroundColor: "#2A1A05", borderColor: "#92400E" },
  danger: { backgroundColor: "#2A0A0A", borderColor: "#991B1B" },
});
