import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useSession } from "../lib/session";
import { theme } from "../lib/theme";

/**
 * Decides where an attendant lands: the kerb if they are signed in, the login
 * screen if not, and an explanation if this build has no API to talk to.
 */
export default function Index() {
  const { ready, configured, user } = useSession();

  if (!configured) {
    return (
      <View style={styles.centre}>
        <Text style={styles.title}>Not configured</Text>
        <Text style={styles.body}>
          This build has no API address. Set EXPO_PUBLIC_API_URL and rebuild — the app will not
          pretend to work without it.
        </Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color={theme.colour.primary} />
      </View>
    );
  }

  return <Redirect href={user ? "/(tabs)" : "/login"} />;
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.space(3),
    backgroundColor: theme.colour.bg,
    gap: theme.space(1.5),
  },
  title: { ...theme.text.title, color: theme.colour.text },
  body: { ...theme.text.body, color: theme.colour.textMuted, textAlign: "center" },
});
