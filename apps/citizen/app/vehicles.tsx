import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { MISSING, formatPlate } from "@kmcp/api";

import {
  Button,
  Card,
  Field,
  Label,
  Plate,
  Screen,
  Sub,
  Unavailable,
} from "../components/ui";
import { useSession } from "../lib/session";
import { looksLikePlate } from "../lib/vehicles";
import { theme } from "../lib/theme";

/**
 * The number plates this person says are theirs.
 *
 * A citizen never starts a parking session — an attendant does, at the kerb —
 * so a plate is the only handle the app has on "my car". Registering one is
 * what makes the "find my car" path work at all.
 *
 * These are held on this handset, which is a stopgap and is stated as one on
 * the screen rather than hidden. `Vehicle.ownerUserId` exists in the schema and
 * is indexed; there is simply no route a citizen can use to write it, so there
 * is nowhere on the server to put this yet. The consequence is small but real —
 * a reinstall loses them, and they do not follow the account to a second phone
 * — and it is the sort of thing that should be discovered by reading a line of
 * text, not by losing something.
 */
export default function Vehicles() {
  const router = useRouter();
  const { plates, savePlate, forgetPlate } = useSession();

  const [input, setInput] = React.useState("");
  const canAdd = looksLikePlate(input) && !plates.includes(input.replace(/[^A-Za-z0-9]/g, "").toUpperCase());

  return (
    <Screen>
      <Card raise>
        <Label>Your vehicles</Label>
        <Sub style={styles.body}>
          Add your number plate once. We use it to find your car when an attendant starts a parking
          session for it.
        </Sub>
      </Card>

      <Field
        label="Number plate"
        value={input}
        onChangeText={setInput}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="WB 02 AB 1234"
        maxLength={14}
        style={styles.plateInput}
        onSubmitEditing={() => {
          if (canAdd) void savePlate(input).then(() => setInput(""));
        }}
        returnKeyType="done"
      />

      <Button
        label="Add this plate"
        disabled={!canAdd}
        onPress={() => void savePlate(input).then(() => setInput(""))}
      />

      {plates.length > 0 ? (
        <View style={styles.list}>
          {plates.map((plate) => (
            <View key={plate} style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Find the car with plate ${formatPlate(plate)}`}
                onPress={() => router.push(`/parked/${plate}`)}
                style={({ pressed }) => [styles.rowMain, pressed && styles.rowPressed]}
              >
                <Plate>{formatPlate(plate)}</Plate>
                <Text style={styles.rowHint}>Tap to see whether it is parked</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${formatPlate(plate)}`}
                onPress={() => void forgetPlate(plate)}
                style={({ pressed }) => [styles.remove, pressed && styles.rowPressed]}
              >
                <Text style={styles.removeGlyph}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Unavailable
        title="These plates are kept on this phone"
        body={`${MISSING.myVehicles!.because}\n\nSo a plate added here is lost if the app is reinstalled, and does not follow your account to another phone.\n\nNeeds: ${MISSING.myVehicles!.route}`}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 13.5, lineHeight: 19 },
  plateInput: { fontSize: 22, letterSpacing: 2 },

  list: { gap: theme.space(1) },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: theme.space(1),
  },
  rowMain: {
    flex: 1,
    minHeight: theme.minTouch + 12,
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: theme.space(2),
    borderWidth: 1,
    borderColor: theme.colour.line,
    borderRadius: theme.radius.md,
  },
  rowPressed: { backgroundColor: theme.colour.raise },
  rowHint: { fontSize: 12.5, color: theme.colour.muted },
  remove: {
    width: theme.minTouch,
    minHeight: theme.minTouch,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colour.line,
    borderRadius: theme.radius.md,
  },
  removeGlyph: { fontSize: 22, color: theme.colour.muted, lineHeight: 26 },
});
