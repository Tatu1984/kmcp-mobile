import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ApiError,
  formatDuration,
  formatMoney,
  formatPlate,
  formatTime,
  provisionalFare,
  type EndedSession,
  type ProvisionalQuote,
  type Payment,
  type Session,
} from "@kmcp/api";

import { Banner, Button, Card, Loading, Pill, Plate, Row, Stat } from "../../components/ui";
import { PlateCamera, type Capture } from "../../components/plate-camera";
import { api, cache } from "../../lib/api";
import { useLocation } from "../../lib/location";
import { useSession } from "../../lib/session";
import { theme } from "../../lib/theme";

/**
 * One session, from running to paid.
 *
 * The screen moves through three states and never goes back: running, ended and
 * awaiting cash, then paid with a receipt number. Each is a separate act by the
 * attendant, because ending the parking and taking the money are separate
 * things that can fail independently — a car can leave before the cash is
 * counted, and the fare must survive that.
 */
export default function SessionScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { refreshShift } = useSession();
  const location = useLocation(false);

  const [session, setSession] = React.useState<Session | EndedSession | null>(null);
  const [payment, setPayment] = React.useState<Payment | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [capture, setCapture] = React.useState<Capture | null>(null);
  /** What to charge when the server could not price it. Never overrides a real quote. */
  const [estimate, setEstimate] = React.useState<ProvisionalQuote | null>(null);

  React.useEffect(() => {
    if (!code) return;
    let cancelled = false;

    void (async () => {
      try {
        const found = await api.sessions.get(code);
        if (!cancelled) setSession(found);
      } catch (cause) {
        if (!cancelled) {
          setLoadError(
            cause instanceof ApiError ? cause.message : "Could not load this session.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  const quote = session && "quote" in session ? session.quote : null;
  const running = session?.status === "ACTIVE" || session?.status === "OVERSTAY";
  // The server's figure whenever there is one; the provisional estimate only
  // when there is not.
  const owed = session?.payableAmount ?? estimate?.payableAmount ?? null;

  async function end() {
    if (!session) return;
    setBusy(true);
    setError(null);

    try {
      let evidenceMediaId: string | undefined;
      if (capture) {
        try {
          const media = await api.media.upload(capture.uri, "SESSION_EVIDENCE_END");
          evidenceMediaId = media.id;
        } catch {
          setError("The photograph could not be uploaded. Ending without it.");
        }
      }

      const fix = await location.locate();
      const ended = await api.sessions.end(session.code, {
        location: fix ? { lat: fix.lat, lng: fix.lng } : undefined,
        evidenceMediaId,
      });

      if (ended) {
        setSession(ended);
      } else {
        // Queued. The server has not priced it, so quote from the cached rate
        // card instead — an attendant with a driver in front of them needs a
        // number, and the server's re-price on sync is still what stands.
        const endedAt = new Date();
        setSession({ ...session, status: "COMPLETED", endAt: endedAt.toISOString() });

        const quoted = await provisionalFare(cache, {
          zoneId: session.zoneId,
          vehicleType: session.vehicleType?.code ?? "CAR",
          startAt: new Date(session.startAt),
          endAt: endedAt,
        });

        if (quoted) {
          setEstimate(quoted);
        } else {
          setError(
            "Saved on this handset, but there is no rate card cached for this zone, so the fare cannot be worked out here.",
          );
        }
      }
      await refreshShift();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not end the session.");
    } finally {
      setBusy(false);
    }
  }

  async function collect() {
    if (!session) return;
    setBusy(true);
    setError(null);

    try {
      const result = await api.payments.collectCash(session.id);
      if (result) {
        setPayment(result);
      } else {
        setError("Saved on this handset. The receipt will be issued when you have signal.");
      }
      await refreshShift();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not record the payment.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Banner tone="danger" title="Session not found" body={loadError} />
        <Button label="Back to the kerb" variant="secondary" onPress={() => router.replace("/(tabs)")} />
      </ScrollView>
    );
  }

  if (!session) return <Loading label="Loading session…" />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.head}>
          <Plate value={formatPlate(session.plateNumber)} />
          {running ? (
            <Pill tone={session.isOverstay ? "warning" : "info"} label={session.isOverstay ? "Overstay" : "Running"} />
          ) : (
            <Pill tone="success" label="Ended" />
          )}
        </View>
        <Text style={styles.code}>{session.code}</Text>
        <View style={styles.stats}>
          <Stat
            label="Parked for"
            value={formatDuration(session.elapsedMinutes ?? session.durationMinutes)}
          />
          <Stat label="Since" value={formatTime(session.startAt)} />
        </View>
        {session.zone?.name ? <Text style={styles.zone}>{session.zone.name}</Text> : null}
      </Card>

      {error ? <Banner tone="warning" title={error} /> : null}

      {/* ------------------------------------------------- the fare, once known */}
      {quote ? (
        <Card>
          <Text style={styles.sectionLabel}>WHAT IS OWED</Text>
          {quote.lines.map((line, i) => (
            <Row key={`${line.code}-${i}`} label={line.label} value={formatMoney(line.amount)} />
          ))}
          {quote.discountAmount > 0 ? (
            <Row label="Discount" value={`− ${formatMoney(quote.discountAmount)}`} />
          ) : null}
          {quote.penaltyAmount > 0 ? (
            <Row label="Overstay penalty" value={formatMoney(quote.penaltyAmount)} />
          ) : null}
          {quote.taxAmount > 0 ? (
            <Row label={`Tax (${quote.taxPercent}%)`} value={formatMoney(quote.taxAmount)} />
          ) : null}
          <View style={styles.total}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatMoney(quote.payableAmount)}</Text>
          </View>
          {quote.waivedByPass ? <Pill tone="success" label="Covered by a pass" /> : null}
          {quote.cappedByDailyLimit ? <Pill tone="info" label="Daily cap applied" /> : null}
          <Text style={styles.tariff}>
            {quote.tariffName} · {formatDuration(quote.chargeableMinutes)} chargeable of{" "}
            {formatDuration(quote.durationMinutes)}
          </Text>
        </Card>
      ) : null}

      {/* ------------------------- the provisional fare, when there is no signal */}
      {!quote && estimate ? (
        <Card>
          <Banner
            tone="warning"
            title="Provisional — worked out on this handset"
            body={`Rate card cached ${formatTime(estimate.tariffFetchedAt)}. The server prices this properly when it syncs, and any difference shows on your shift.`}
          />
          {estimate.lines.map((line, i) => (
            <Row key={`${line.code}-${i}`} label={line.label} value={formatMoney(line.amount)} />
          ))}
          {estimate.taxAmount > 0 ? (
            <Row label={`Tax (${estimate.taxPercent}%)`} value={formatMoney(estimate.taxAmount)} />
          ) : null}
          <View style={styles.total}>
            <Text style={styles.totalLabel}>To collect</Text>
            <Text style={styles.totalValue}>{formatMoney(estimate.payableAmount)}</Text>
          </View>
          {estimate.assumptions.map((line) => (
            <Text key={line} style={styles.assumption}>
              • {line}
            </Text>
          ))}
        </Card>
      ) : null}

      {/* ------------------------------------------------------------ receipt */}
      {payment ? (
        <Card>
          <Banner
            tone="success"
            title={`${formatMoney(payment.amount)} collected`}
            body={
              payment.receipt
                ? `Receipt ${payment.receipt.number}`
                : "The receipt number will follow when this reaches the server."
            }
          />
          <Button label="Done" onPress={() => router.replace("/(tabs)")} />
        </Card>
      ) : running ? (
        <View style={styles.actions}>
          <Button
            label={capture ? "Photograph taken — retake" : "Photograph on exit"}
            variant={capture ? "success" : "secondary"}
            size="medium"
            onPress={() => setCameraOpen(true)}
            disabled={busy}
          />
          <Button label="End parking" onPress={() => void end()} busy={busy} />
        </View>
      ) : (
        <View style={styles.actions}>
          {owed && owed > 0 ? (
            <Button
              label={`Collect ${formatMoney(owed)} cash${estimate && !quote ? " (provisional)" : ""}`}
              variant="success"
              onPress={() => void collect()}
              busy={busy}
            />
          ) : (
            <Banner
              tone="info"
              title="Nothing to collect"
              body="This session has no fare outstanding."
            />
          )}
          <Button
            label="Back to the kerb"
            variant="secondary"
            size="medium"
            onPress={() => router.replace("/(tabs)")}
            disabled={busy}
          />
        </View>
      )}

      <PlateCamera
        visible={cameraOpen}
        onCancel={() => setCameraOpen(false)}
        onCapture={(shot) => {
          setCapture(shot);
          setCameraOpen(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colour.bg },
  content: { padding: theme.space(2), gap: theme.space(1.5), paddingBottom: theme.space(6) },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.space(1) },
  code: { ...theme.text.small, color: theme.colour.textMuted, letterSpacing: 1 },
  stats: { flexDirection: "row", gap: theme.space(4), marginTop: theme.space(0.5) },
  zone: { ...theme.text.body, color: theme.colour.textMuted },
  sectionLabel: { ...theme.text.label, color: theme.colour.textMuted },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: theme.space(1.5),
  },
  totalLabel: { ...theme.text.title, color: theme.colour.text },
  totalValue: { ...theme.text.display, color: theme.colour.text },
  tariff: { ...theme.text.small, color: theme.colour.textMuted },
  assumption: { ...theme.text.small, color: theme.colour.warning },
  actions: { gap: theme.space(1) },
});
