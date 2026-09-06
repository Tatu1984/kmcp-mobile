import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useSession } from "../lib/session";
import { theme } from "../lib/theme";

/**
 * Where somebody lands when they open the app.
 *
 * Always the map, signed in or not. `GET /zones/nearby` is public, so a
 * stranger who has just installed this can see where there is a space before
 * being asked for anything — which is the whole point of a public parking app,
 * and the opposite of the attendant app, where nothing at all happens before a
 * sign-in.
 */
export default function Index() {
  const { ready, configured } = useSession();

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

  return <Redirect href="/(tabs)" />;
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
  title: { ...theme.text.h1, color: theme.colour.ink, textAlign: "center" },
  body: { ...theme.text.sub, color: theme.colour.muted, textAlign: "center", lineHeight: 21 },
});
