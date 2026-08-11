import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ApiError, formatMoney, formatTime } from "@kmcp/api";

import { Banner, Button, Card, Field, Loading, Pill, Row, Stat } from "../../components/ui";
import { api, queue } from "../../lib/api";
import { useLocation } from "../../lib/location";
import { useSession } from "../../lib/session";
import { theme } from "../../lib/theme";

/**
 * The shift: opening one, and closing it against a cash count.
 *
 * The close is deliberately a count and not a confirmation. The expected figure
 * is shown *after* the attendant has entered what they are holding, never
 * before — pre-filling it would turn counting the money into agreeing with the
 * system, which is the whole thing a reconciliation is meant to test.
 */
export default function ShiftScreen() {
  const { user, shift, refreshShift, refreshCache, signOut, queued, rejected, syncing, sync, online, cacheAgeHours } =
    useSession();
  const location = useLocation(false);

  const [cash, setCash] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [closed, setClosed] = React.useState<{ variance: number; matched: boolean } | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const fix = await location.locate();
      await api.shifts.open(fix ? { location: { lat: fix.lat, lng: fix.lng } } : {});
      await refreshShift();
      // Opening a shift is the last moment this handset is reliably somewhere
      // with signal before it goes somewhere without it.
      await refreshCache();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not open a shift.");
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (!shift) return;
    setBusy(true);
    setError(null);
    try {
      // Rupees on screen, paise on the wire — the only place this app converts.
      const paise = Math.round(Number(cash) * 100);
      const fix = await location.locate();
      const result = await api.shifts.close(
        shift.id,
        paise,
        fix ? { lat: fix.lat, lng: fix.lng } : undefined,
      );

      if (result) {
        const variance = result.varianceAmount ?? 0;
        setClosed({ variance, matched: variance === 0 });
      } else {
        setError("Saved on this handset. The shift will close when you have signal.");
      }
      await refreshShift();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not close the shift.");
    } finally {
      setBusy(false);
    }
  }

  const declared = Number(cash);
  /**
   * Nothing may close while work is still queued.
   *
   * The expected figure is computed by the server from the payments it has
   * seen. Closing with sessions still on the handset would compare a real cash
   * count against an incomplete expectation and raise a variance against a
   * named person for work they did correctly.
   */
  const unsynced = queued > 0;
  const canClose =
    cash.length > 0 && Number.isFinite(declared) && declared >= 0 && !busy && !unsynced;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <Text style={styles.name}>{user?.name ?? "Attendant"}</Text>
        <Text style={styles.role}>{user?.phone ?? ""}</Text>
        <View style={styles.head}>
          <Pill tone={online ? "success" : "warning"} label={online ? "Online" : "No signal"} />
          {cacheAgeHours === null ? (
            <Pill tone="danger" label="No offline rates" />
          ) : cacheAgeHours > 24 ? (
            <Pill tone="warning" label={`Rates ${Math.floor(cacheAgeHours)}h old`} />
          ) : (
            <Pill tone="default" label="Rates current" />
          )}
        </View>
        <Button
          label="Refresh offline rates"
          variant="secondary"
          size="medium"
          onPress={() => void refreshCache()}
          disabled={!online}
        />
      </Card>

      {rejected > 0 ? (
        <Card>
          <Banner
            tone="danger"
            title={`${rejected} refused`}
            body="The server would not accept these. They need a supervisor, not another attempt."
          />
          {queue
            .list()
            .filter((item) => item.rejected)
            .map((item) => (
              <View key={item.id} style={styles.rejected}>
                <Text style={styles.rejectedKind}>{item.kind}</Text>
                <Text style={styles.rejectedReason}>{item.lastError ?? "Refused"}</Text>
                <Button
                  label="Discard"
                  variant="secondary"
                  size="medium"
                  onPress={() => void queue.discard(item.id)}
                />
              </View>
            ))}
        </Card>
      ) : null}

      {queued > 0 ? (
        <Card>
          <Banner
            tone="info"
            title={`${queued} waiting to send`}
            body="Saved here until there is signal. Nothing is lost."
          />
          <Button
            label={syncing ? "Sending…" : "Send now"}
            variant="secondary"
            size="medium"
            onPress={() => void sync()}
            busy={syncing}
          />
        </Card>
      ) : null}

      {closed ? (
        <Card>
          <Banner
            tone={closed.matched ? "success" : "warning"}
            title={closed.matched ? "Shift closed and balanced" : "Shift closed with a variance"}
            body={
              closed.matched
                ? "What you handed in matched what the sessions say you took."
                : `${formatMoney(Math.abs(closed.variance))} ${closed.variance < 0 ? "short" : "over"}. Your supervisor will verify the deposit.`
            }
          />
        </Card>
      ) : !shift ? (
        <Card>
          <Text style={styles.sectionLabel}>NOT ON SHIFT</Text>
          <Text style={styles.body}>
            Open a shift before you start taking cash. Everything you collect is counted against it.
          </Text>
          {error ? <Banner tone="danger" title={error} /> : null}
          <Button label="Open shift" onPress={() => void open()} busy={busy} />
        </Card>
      ) : (
        <>
          <Card>
            <View style={styles.head}>
              <Text style={styles.sectionLabel}>ON SHIFT</Text>
              <Pill tone="success" label={`since ${formatTime(shift.startAt)}`} />
            </View>
            <View style={styles.stats}>
              <Stat label="Sessions" value={String(shift.sessionsCount)} />
              <Stat label="Digital" value={formatMoney(shift.digitalTotal)} />
            </View>
            {shift.zone?.name ? <Row label="Zone" value={shift.zone.name} /> : null}
          </Card>

          <Card>
            <Text style={styles.sectionLabel}>CLOSING THE SHIFT</Text>
            <Text style={styles.body}>
              Count the cash you are handing in and enter it. The expected figure is shown once you
              have — that is the point of counting it.
            </Text>

            <Field
              label="Cash you are handing in (₹)"
              value={cash}
              onChangeText={setCash}
              keyboardType="decimal-pad"
              placeholder="0"
              editable={!busy}
              style={styles.cashInput}
            />

            {cash.length > 0 ? (
              <View style={styles.compare}>
                <Row label="You counted" value={formatMoney(Math.round(declared * 100))} />
                <Row label="Sessions say" value={formatMoney(shift.cashExpected)} />
                <Row
                  label="Difference"
                  value={formatMoney(Math.round(declared * 100) - shift.cashExpected)}
                />
              </View>
            ) : null}

            {unsynced ? (
              <Banner
                tone="warning"
                title={`${queued} action${queued === 1 ? "" : "s"} have not reached the server`}
                body="The expected figure is worked out from what the server has seen, so closing now would flag a variance you did not cause. Send them first."
              />
            ) : null}

            {error ? <Banner tone="danger" title={error} /> : null}

            <Button
              label="Close shift"
              variant="danger"
              onPress={() => void close()}
              disabled={!canClose}
              busy={busy}
            />
          </Card>
        </>
      )}

      <Button label="Sign out" variant="secondary" size="medium" onPress={() => void signOut()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colour.bg },
  content: { padding: theme.space(2), gap: theme.space(1.5), paddingBottom: theme.space(6) },
  name: { ...theme.text.title, color: theme.colour.text },
  role: { ...theme.text.body, color: theme.colour.textMuted },
  sectionLabel: { ...theme.text.label, color: theme.colour.textMuted },
  body: { ...theme.text.body, color: theme.colour.textMuted },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stats: { flexDirection: "row", gap: theme.space(4) },
  cashInput: { fontSize: 30, fontWeight: "700", minHeight: 72 },
  compare: { marginTop: theme.space(0.5) },
  rejected: { gap: theme.space(0.5), paddingVertical: theme.space(1) },
  rejectedKind: { ...theme.text.body, color: theme.colour.text, fontWeight: "700" },
  rejectedReason: { ...theme.text.small, color: theme.colour.textMuted },
});
