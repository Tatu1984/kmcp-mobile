import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ApiError,
  formatDuration,
  formatMoney,
  formatPlate,
  normalisePlate,
  type PlateLookup,
} from "@kmcp/api";

import { Banner, Button, Card, Empty, Field, Loading, Pill, Plate, Row } from "../../components/ui";
import { api } from "../../lib/api";
import { theme } from "../../lib/theme";

/**
 * Looking a vehicle up.
 *
 * Used for the two questions an attendant is actually asked at a kerb: "is this
 * car paid for?" and "has this one been here before?". Both are answered by the
 * plate, which is the only identifier anybody standing beside a vehicle has.
 */
export default function Search() {
  const router = useRouter();
  const [plate, setPlate] = React.useState("");
  const [result, setResult] = React.useState<PlateLookup | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const normalised = normalisePlate(plate);
  const canSearch = normalised.length >= 4 && !busy;

  async function search() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.sessions.lookup(normalised));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not look that plate up.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Field
        label="Number plate"
        value={plate}
        onChangeText={setPlate}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="WB 02 AB 1234"
        maxLength={14}
        style={styles.plateInput}
        onSubmitEditing={() => canSearch && void search()}
        returnKeyType="search"
      />

      <Button label="Look up" onPress={() => void search()} disabled={!canSearch} busy={busy} />

      {error ? <Banner tone="danger" title={error} /> : null}
      {busy ? <Loading /> : null}

      {result ? (
        <>
          {/* ------------------------------------------- parked right now */}
          {result.active ? (
            <Card onPress={() => router.push(`/session/${result.active!.code}`)}>
              <View style={styles.head}>
                <Plate value={formatPlate(result.active.plateNumber)} size="small" />
                <Pill
                  tone={result.active.isOverstay ? "warning" : "info"}
                  label={result.active.isOverstay ? "Overstaying" : "Parked now"}
                />
              </View>
              <Row
                label="Parked for"
                value={formatDuration(result.active.elapsedMinutes ?? result.active.durationMinutes)}
              />
              <Row label="Zone" value={result.active.zone?.name ?? "—"} />
              <Text style={styles.tap}>Tap to end this session</Text>
            </Card>
          ) : (
            <Banner
              tone="info"
              title="Not parked right now"
              body="No live session anywhere on the network for this plate."
            />
          )}

          {/* ------------------------------------------------ the vehicle */}
          {result.vehicle ? (
            <Card>
              <Text style={styles.sectionLabel}>VEHICLE</Text>
              <Row label="Type" value={result.vehicle.vehicleType.label} />
              {result.vehicle.makeModel ? (
                <Row label="Make" value={result.vehicle.makeModel} />
              ) : null}
              {result.vehicle.colour ? <Row label="Colour" value={result.vehicle.colour} /> : null}
              {result.vehicle.isBlacklisted ? (
                <Banner
                  tone="danger"
                  title="This vehicle is blacklisted"
                  body="Do not start a session. Refer the driver to the zone officer."
                />
              ) : null}
            </Card>
          ) : null}

          {/* --------------------------------------------------- history */}
          {result.recent.length > 0 ? (
            <Card>
              <Text style={styles.sectionLabel}>RECENT PARKING</Text>
              {result.recent.map((visit) => (
                <Row
                  key={visit.id}
                  label={`${visit.zone.name} · ${new Date(visit.startAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                  value={formatMoney(visit.payableAmount)}
                />
              ))}
            </Card>
          ) : result.known ? null : (
            <Empty title="No history" body="This plate has not been seen on the network before." />
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colour.bg },
  content: { padding: theme.space(2), gap: theme.space(1.5), paddingBottom: theme.space(6) },
  plateInput: { fontSize: 30, fontWeight: "700", letterSpacing: 2, minHeight: 72 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.space(1) },
  sectionLabel: { ...theme.text.label, color: theme.colour.textMuted },
  tap: { ...theme.text.small, color: theme.colour.primary },
});
