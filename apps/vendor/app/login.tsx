import * as React from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { ApiError } from "@kmcp/api";

import { Banner, Button, Field, Screen } from "../components/ui";
import { useSession } from "../lib/session";
import { getDeviceId } from "../lib/api";
import { theme } from "../lib/theme";

/**
 * Sign-in for an attendant.
 *
 * By mobile number, not email: an attendant has a phone and often no work email
 * at all. The account is bound to this handset, so the first sign-in on a new
 * device is refused until an administrator releases the binding — which is what
 * stops one login being passed around a depot.
 */
export default function Login() {
  const { user, signIn } = useSession();
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (user) return <Redirect href="/(tabs)" />;

  const canSubmit = phone.trim().length >= 10 && password.length >= 6 && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(phone.trim(), password);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.isAuthError
            ? "That mobile number and password did not match."
            : cause.message
          : "Could not reach the server. Check your connection and try again.",
      );
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <View style={styles.header}>
          <Text style={styles.brand}>KMCP</Text>
          <Text style={styles.title}>Attendant sign-in</Text>
          <Text style={styles.subtitle}>
            Kolkata Municipal Corporation Parking
          </Text>
        </View>

        {error ? <Banner tone="danger" title={error} /> : null}

        <Field
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="98XXXXXXXX"
          maxLength={10}
          editable={!busy}
        />

        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          placeholder="••••••••"
          editable={!busy}
          onSubmitEditing={() => canSubmit && void submit()}
          returnKeyType="go"
        />

        <Button label="Sign in" onPress={() => void submit()} disabled={!canSubmit} busy={busy} />

        <View style={styles.footer}>
          <Text style={styles.footnote}>
            This handset is registered as {getDeviceId().slice(0, 18) || "unknown"}…
          </Text>
          <Text style={styles.footnote}>
            Your account is bound to this device. If you have changed phones, ask your supervisor to
            release the old one.
          </Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colour.bg },
  header: { gap: theme.space(0.5), paddingVertical: theme.space(4) },
  brand: {
    ...theme.text.label,
    color: theme.colour.primary,
    fontSize: 15,
    letterSpacing: 2,
  },
  title: { ...theme.text.display, color: theme.colour.text },
  subtitle: { ...theme.text.body, color: theme.colour.textMuted },
  footer: { marginTop: "auto", gap: theme.space(1), paddingTop: theme.space(3) },
  footnote: { ...theme.text.small, color: theme.colour.textMuted },
});
