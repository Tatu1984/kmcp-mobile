import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SessionProvider } from "../lib/session";
import { theme } from "../lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.colour.surface },
            headerTintColor: theme.colour.text,
            headerTitleStyle: { fontWeight: "700" },
            contentStyle: { backgroundColor: theme.colour.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="session/start" options={{ title: "Start parking" }} />
          <Stack.Screen name="session/[code]" options={{ title: "Session" }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
