import * as React from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ApiError,
  MISSING,
  formatDuration,
  formatMoney,
  formatPlate,
  formatTime,
  gapOf,
  type Session,
  type WalletBalance,
} from "@kmcp/api";

import {
  Banner,
  Button,
  Card,
  Chip,
  Empty,
  Label,
  Loading,
  Money,
  Plate,
  Row,
  Screen,
  Sub,
  Unavailable,
} from "../../components/ui";
import { api } from "../../lib/api";
import { useRazorpayCheckout } from "../../lib/checkout";
import { useSession } from "../../lib/session";
import { theme } from "../../lib/theme";

/**
 * Your car is parked, and what it will cost.
 *
 * A citizen never starts a parking session — an attendant does, at the kerb —
 * so this screen finds their car by matching a registered plate against active
 * sessions. That is the join, and it is the reason the app asks for a number
 * plate at all.
 *
 * The most important thing on it is the thing it refuses to do. While a session
 * is running the server holds no price for it: `payableAmount` is null until
 * `POST /sessions/:id/end` prices it, and there is no citizen-callable quote.
 * This screen could multiply an hourly rate by an elapsed time and print a
 * number — and that number would be wrong the moment a peak rule, a daily cap,
 * a holiday or a pass applied. So it shows the time, which it knows, and says
 * where the fare comes from. The rule the attendant app is built on holds here
 * too: the server prices, the device reports and asks.
 */
export default function Parked() {
  const { plate } = useLocalSearchParams<{ plate: string }>();
  const router = useRouter();
  const { user } = useSession();

  const [session, setSession] = React.useState<Session | null>(null);
  const [wallet, setWallet] = React.useState<WalletBalance | null>(null);
  const [lookupGap, setLookupGap] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [payNote, setPayNote] = React.useState<string | null>(null);
  const [paySuccess, setPaySuccess] = React.useState<string | null>(null);
  const [payingWallet, setPayingWallet] = React.useState(false);
  const [payingGateway, setPayingGateway] = React.useState(false);

  const { open, modal } = useRazorpayCheckout();

  /**
   * Two attempts, in the order they should exist.
   *
   * `GET /me/sessions?status=ACTIVE` is the right call — it is scoped to the
   * signed-in citizen and cannot be pointed at somebody else's plate. It
   * does not exist yet. The plate lookup is what the attendant app uses and
   * it does exist, but it is guarded by `session.read` and returns any
   * vehicle's session to whoever asks, which is precisely why a citizen
   * must not be given it as it stands.
   */
  const fetchSession = React.useCallback(async (): Promise<void> => {
    if (!plate) return;

    try {
      const mine = await api.me.sessions("ACTIVE");
      const match = mine.find((s) => s.plateNumber === plate);
      if (match) {
        setSession({
          id: match.id,
          code: match.code,
          zoneId: match.zone.id,
          plateNumber: match.plateNumber,
          status: match.status,
          startAt: match.startAt,
          endAt: match.endAt,
          durationMinutes: match.durationMinutes,
          payableAmount: match.payableAmount,
          taxAmount: 0,
          penaltyAmount: 0,
          zone: match.zone,
        });
        return;
      }
      setSession(null);
      return;
    } catch (cause) {
      if (!gapOf(cause)) {
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Could not check whether your car is parked.",
        );
        return;
      }
      // Fall through to the attendant-era lookup below.
    }

    try {
      const found = await api.sessions.lookup(plate);
      setSession(found.active);
    } catch (cause) {
      if (gapOf(cause)) {
        setLookupGap(
          `${MISSING.mySessions!.because}\n\nThe lookup that would answer this today, ${MISSING.plateLookup!.route}, is staff-only: it returns any vehicle's session to whoever asks, which is exactly why a citizen must not be handed it as it stands.\n\nNeeds: ${MISSING.mySessions!.route}`,
        );
      } else {
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Could not check whether your car is parked.",
        );
      }
    }
  }, [plate]);

  React.useEffect(() => {
    if (!plate || !user) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    void (async () => {
      await fetchSession();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [plate, user, fetchSession]);

  const refreshWallet = React.useCallback(async () => {
    try {
      setWallet(await api.wallet.balance());
    } catch {
      // Left null. There is no wallet on the server at all, so the pay
      // button says so rather than offering to spend a balance nobody holds.
    }
  }, []);

  React.useEffect(() => {
    if (!user) return;
    void refreshWallet();
  }, [user, refreshWallet]);

  if (loading) return <Loading label="Looking for your car" />;

  // Finding a specific person's car means knowing which person is asking. The
  // map does not need an account; this does, and says so rather than returning
  // an empty answer that reads as "your car is not parked".
  if (!user) {
    return (
      <Screen>
        <Card raise>
          <Label>Sign in first</Label>
          <Sub style={styles.footnote}>
            {`We match ${formatPlate(plate ?? "")} against the sessions attendants have started. That needs an account, so we know whose car to look for.`}
          </Sub>
        </Card>
        <Button label="Sign in" onPress={() => router.push("/sign-in")} />
        <Button
          label="Back to the map"
          variant="ghost"
          size="medium"
          onPress={() => router.replace("/(tabs)")}
        />
      </Screen>
    );
  }

  const owed = session?.payableAmount ?? null;

  return (
    <Screen>
      <Stack.Screen options={{ title: plate ? formatPlate(plate) : "Your car" }} />

      {error ? <Banner tone="crit" title={error} /> : null}

      {lookupGap ? (
        <Unavailable title="Finding your car needs a citizen-scoped read" body={lookupGap} />
      ) : null}

      {!session && !lookupGap && !error ? (
        <>
          <Empty
            title="This car is not parked right now"
            body={`No live session anywhere on the network for ${formatPlate(plate ?? "")}. When an attendant starts one, it appears here.`}
          />
          <Button
            label="Back to the map"
            variant="ghost"
            onPress={() => router.replace("/(tabs)")}
          />
        </>
      ) : null}

      {session ? (
        <>
          {/* ------------------------------------------------ the vehicle */}
          <Card raise style={styles.vehicle}>
            <Label>Your car is parked</Label>
            <Plate>{formatPlate(session.plateNumber)}</Plate>
            <Sub>
              {session.zone?.name ?? "Unknown car park"} · started {formatTime(session.startAt)}
            </Sub>
          </Card>

          {/* ------------------------------------------------ the running figure */}
          <View style={styles.hero}>
            <Label>{owed === null ? "Parked for" : "Running total"}</Label>
            {owed === null ? (
              <>
                <Money>{formatDuration(session.elapsedMinutes ?? session.durationMinutes)}</Money>
                <Sub style={styles.heroSub}>
                  since {formatTime(session.startAt)}
                  {session.isOverstay ? " · over the maximum stay" : ""}
                </Sub>
              </>
            ) : (
              <>
                <Money>{formatMoney(owed)}</Money>
                <Sub style={styles.heroSub}>
                  {formatDuration(session.durationMinutes ?? session.elapsedMinutes)}
                  {session.penaltyAmount > 0
                    ? ` · includes ${formatMoney(session.penaltyAmount, { decimals: false })} overstay`
                    : ""}
                </Sub>
              </>
            )}
          </View>

          {session.isOverstay ? (
            <Chip tone="warn" label="Over the maximum stay — a penalty will apply" />
          ) : null}

          {/* ------------------------------------------------ the fare lines */}
          {owed === null ? (
            <Unavailable
              title="The fare is worked out when the session ends"
              body={
                "While a car is parked the server holds no price for it — peak rules, the daily cap, holidays and passes are all applied at the end, together. There is no running quote a citizen can ask for.\n\n" +
                "This phone could multiply an hourly rate by the time so far, and the figure would be wrong. It is not going to do that."
              }
            />
          ) : (
            <Card style={styles.tight}>
              {session.grossAmount !== null && session.grossAmount !== undefined ? (
                <Row label="Parking" value={formatMoney(session.grossAmount)} />
              ) : null}
              {session.penaltyAmount > 0 ? (
                <Row label="Overstay penalty" value={formatMoney(session.penaltyAmount)} />
              ) : null}
              {session.taxAmount > 0 ? (
                <Row label="Tax" value={formatMoney(session.taxAmount)} />
              ) : null}
              <Row label="To pay" value={formatMoney(owed)} emphasis last />
            </Card>
          )}

          {/* ------------------------------------------------------ paying */}
          <View style={styles.pay}>
            <Button
              label={
                owed === null
                  ? "Pay from wallet"
                  : `Pay ${formatMoney(owed)} from wallet`
              }
              busy={payingWallet}
              disabled={payingGateway}
              onPress={() => void payFromWallet(session.id)}
            />

            <Sub style={styles.balance}>
              {wallet
                ? `Balance ${formatMoney(wallet.balance)}${
                    owed === null
                      ? ""
                      : ` — ${formatMoney(wallet.balance - owed)} after this`
                  }`
                : "There is no wallet on the server yet, so there is no balance to spend."}
            </Sub>

            <Button
              label="Pay by UPI instead"
              variant="ghost"
              size="medium"
              busy={payingGateway}
              disabled={payingWallet}
              onPress={() => void payByGateway(session.id)}
            />

            {paySuccess ? <Banner tone="good" title={paySuccess} /> : null}
            {payNote ? <Banner tone="crit" title="That payment did not go through" body={payNote} /> : null}
          </View>

          {modal}

          <Sub style={styles.disclaimer}>
            Whatever you pay, the amount is the server's. Nothing on this phone decides what parking
            costs — it asks, and reports the answer.
          </Sub>
        </>
      ) : null}
    </Screen>
  );

  /** Pays for `sessionId` straight out of the wallet balance. Captures immediately, no checkout. */
  async function payFromWallet(sessionId: string): Promise<void> {
    setPayNote(null);
    setPaySuccess(null);
    setPayingWallet(true);
    try {
      await api.wallet.paySession(sessionId);
      await Promise.all([fetchSession(), refreshWallet()]);
      setPaySuccess("Paid from your wallet.");
    } catch (cause) {
      setPayNote(
        gapOf(cause)
          ? `${MISSING.wallet!.because}\n\nNeeds: ${MISSING.wallet!.route}`
          : cause instanceof ApiError
            ? cause.message
            : "That payment did not go through.",
      );
    } finally {
      setPayingWallet(false);
    }
  }

  /** Pays for `sessionId` through the gateway checkout sheet, then confirms it server-side. */
  async function payByGateway(sessionId: string): Promise<void> {
    setPayNote(null);
    setPaySuccess(null);
    setPayingGateway(true);
    try {
      const payment = await api.payments.payOwnSession(sessionId);

      if (payment.gatewayKeyId && payment.gatewayOrder) {
        const result = await open({
          gatewayKeyId: payment.gatewayKeyId,
          gatewayOrder: payment.gatewayOrder,
          description: `Parking — ${formatMoney(payment.amount)}`,
        });

        if (result.status === "cancelled") {
          setPayingGateway(false);
          return;
        }
        if (result.status === "error") {
          setPayNote(result.message);
          setPayingGateway(false);
          return;
        }

        await api.payments.verify(payment.id, {
          razorpayOrderId: result.razorpayOrderId,
          razorpayPaymentId: result.razorpayPaymentId,
          razorpaySignature: result.razorpaySignature,
        });
      }

      await fetchSession();
      setPaySuccess("Payment received.");
    } catch (cause) {
      setPayNote(
        gapOf(cause)
          ? `${MISSING.payment!.because}\n\nNeeds a citizen-scoped variant of ${MISSING.payment!.route}.`
          : cause instanceof ApiError
            ? cause.message
            : "That payment could not be started.",
      );
    } finally {
      setPayingGateway(false);
    }
  }
}

const styles = StyleSheet.create({
  vehicle: { gap: theme.space(0.75) },

  hero: { alignItems: "center", paddingVertical: theme.space(1.75), gap: theme.space(0.75) },
  heroSub: { textAlign: "center" },

  tight: { paddingVertical: theme.space(0.5), gap: 0 },

  pay: { marginTop: "auto", gap: theme.space(1.125), paddingTop: theme.space(2) },
  balance: { textAlign: "center", fontSize: 13, marginTop: -theme.space(0.5) },

  footnote: { fontSize: 13, lineHeight: 19 },
  disclaimer: { fontSize: 12.5, lineHeight: 18, textAlign: "center" },
});
