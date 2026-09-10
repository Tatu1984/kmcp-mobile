import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ApiError,
  MISSING,
  formatMoney,
  gapOf,
  type Paise,
  type WalletBalance,
  type WalletEntry,
} from "@kmcp/api";

import {
  Banner,
  Button,
  Card,
  Label,
  Loading,
  Money,
  Screen,
  Sub,
  Unavailable,
} from "../../components/ui";
import { api } from "../../lib/api";
import { useRazorpayCheckout } from "../../lib/checkout";
import { useSession } from "../../lib/session";
import { theme } from "../../lib/theme";

/**
 * The wallet.
 *
 * None of this exists on the server. `WALLET` is a value in the `PaymentMode`
 * enum and nothing else — there is no balance, no ledger table, no top-up and
 * no refund path — so this screen spends most of its life explaining itself.
 *
 * It would have been easy, and wrong, to render the design with zeroes in it: a
 * balance of ₹0.00 and an empty list of transactions is a screen that says "you
 * have no money and have never spent any", which is a specific false claim
 * about somebody's finances rather than an absence of data. Whatever else is
 * uncertain here, this app will not tell a person their money is gone.
 *
 * The layout below is exactly the one the design calls for, and it renders in
 * full the moment `GET /me/wallet` answers.
 */

/** The top-up amounts on the chips. Fixed, and in paise like everything else. */
const TOP_UPS: Paise[] = [20_000, 50_000, 100_000];

export default function Wallet() {
  const router = useRouter();
  const { user, online } = useSession();

  const [balance, setBalance] = React.useState<WalletBalance | null>(null);
  const [entries, setEntries] = React.useState<WalletEntry[] | null>(null);
  const [gap, setGap] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [chosen, setChosen] = React.useState<Paise>(TOP_UPS[1]!);
  const [topUpBusy, setTopUpBusy] = React.useState(false);
  const [topUpError, setTopUpError] = React.useState<string | null>(null);
  const [topUpSuccess, setTopUpSuccess] = React.useState<string | null>(null);

  const { open, modal } = useRazorpayCheckout();

  const load = React.useCallback(async () => {
    const [balanceResult, entriesResult] = await Promise.allSettled([
      api.wallet.balance(),
      api.wallet.entries(),
    ]);

    if (balanceResult.status === "fulfilled") setBalance(balanceResult.value);
    if (entriesResult.status === "fulfilled") setEntries(entriesResult.value);

    if (balanceResult.status === "rejected") {
      if (gapOf(balanceResult.reason)) setGap(true);
      else {
        setError(
          balanceResult.reason instanceof ApiError
            ? balanceResult.reason.message
            : "Could not load your wallet.",
        );
      }
    }
  }, []);

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    void (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, load]);

  const startTopUp = React.useCallback(async () => {
    setTopUpError(null);
    setTopUpSuccess(null);
    setTopUpBusy(true);
    try {
      const topUp = await api.wallet.topUp(chosen);
      const result = await open({
        gatewayKeyId: topUp.gatewayKeyId,
        gatewayOrder: topUp.gatewayOrder,
        description: `Add ${formatMoney(topUp.amount, { decimals: false })} to your wallet`,
      });

      if (result.status === "cancelled") {
        setTopUpBusy(false);
        return;
      }
      if (result.status === "error") {
        setTopUpError(result.message);
        setTopUpBusy(false);
        return;
      }

      await api.payments.verify(topUp.id, {
        razorpayOrderId: result.razorpayOrderId,
        razorpayPaymentId: result.razorpayPaymentId,
        razorpaySignature: result.razorpaySignature,
      });

      await load();
      setTopUpSuccess(`Added ${formatMoney(topUp.amount, { decimals: false })} to your wallet.`);
    } catch (cause) {
      setTopUpError(
        gapOf(cause)
          ? `${MISSING.wallet!.because}\n\nNeeds: ${MISSING.wallet!.route}`
          : cause instanceof ApiError
            ? cause.message
            : "That top-up could not be completed.",
      );
    } finally {
      setTopUpBusy(false);
    }
  }, [chosen, open, load]);

  if (!user) {
    return (
      <Screen>
        <Card raise>
          <Label>Sign in first</Label>
          <Sub style={styles.body}>
            A wallet belongs to an account. The map works without one; this does not.
          </Sub>
        </Card>
        <Button label="Sign in" onPress={() => router.push("/sign-in")} />
      </Screen>
    );
  }

  if (loading) return <Loading label="Loading your wallet" />;

  if (gap || !balance) {
    return (
      <Screen>
        <Unavailable
          title="The wallet has not been built yet"
          body={`${MISSING.wallet!.because}\n\nNeeds: ${MISSING.wallet!.route}`}
        />

        <Card>
          <Label>What it takes</Label>
          <Sub style={styles.body}>
            Two models and one rule that never bends: the balance is derived from the ledger and
            never stored as a number anything can edit. A top-up credits on the gateway's webhook, a
            session debit is a row, and a cancellation writes a compensating row rather than
            changing the original. That is what makes a balance disputed months later answerable at
            all.
          </Sub>
        </Card>

        <Card>
          <Label>Worth deciding first</Label>
          <Sub style={styles.body}>
            Holding citizens' money — even small amounts, even with no cash-out — puts KMC in a
            regulated position under RBI's prepaid instrument rules. That is a decision for whoever
            owns the contract, not something to find out after the ledger is written. Paying per
            session by UPI avoids it entirely.
          </Sub>
        </Card>

        {error ? <Banner tone="crit" title={error} /> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      {!online ? (
        <Banner
          tone="warn"
          title="You are offline"
          body="This balance was last read when you had signal. It may have moved since."
        />
      ) : null}

      <Card raise style={styles.balanceCard}>
        <Label>Balance</Label>
        <Money>{formatMoney(balance.balance)}</Money>
      </Card>

      <Card onPress={() => router.push("/passes")} accessibilityLabel="Buy a pass">
        <View style={styles.passRow}>
          <View style={styles.passRowText}>
            <Text style={styles.passRowTitle}>Buy a pass</Text>
            <Sub style={styles.body}>A season ticket for a vehicle, paid once.</Sub>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </Card>

      <Button
        label={`Add ${formatMoney(chosen, { decimals: false })}`}
        busy={topUpBusy}
        onPress={() => void startTopUp()}
      />

      <View style={styles.chips}>
        {TOP_UPS.map((amount) => {
          const on = amount === chosen;
          return (
            <Pressable
              key={amount}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Add ${formatMoney(amount, { decimals: false })}`}
              onPress={() => setChosen(amount)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>
                {formatMoney(amount, { decimals: false })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {topUpSuccess ? <Banner tone="good" title={topUpSuccess} /> : null}
      {topUpError ? <Banner tone="crit" title="That top-up did not go through" body={topUpError} /> : null}

      {modal}

      <Label>Recent</Label>
      {entries === null ? (
        <Unavailable
          title="The ledger could not be read"
          body={`Needs: ${MISSING.wallet!.route}`}
        />
      ) : entries.length === 0 ? (
        <Sub style={styles.body}>
          Nothing has moved through this wallet yet. Money you add and parking you pay for both
          appear here, each as its own row.
        </Sub>
      ) : (
        <View style={styles.ledger}>
          {entries.map((entry, index) => (
            <LedgerRow key={entry.id} entry={entry} last={index === entries.length - 1} />
          ))}
        </View>
      )}
    </Screen>
  );
}

/**
 * One ledger row.
 *
 * The sign on the amount comes from the amount itself, never from the kind —
 * a new entry kind added on the server cannot silently be totalled the wrong
 * way round here, and the arrow glyph and the colour both follow the same
 * single source.
 */
function LedgerRow({ entry, last }: { entry: WalletEntry; last: boolean }) {
  const credit = entry.amount >= 0;
  return (
    <View style={[styles.led, last && styles.ledLast]}>
      <View style={[styles.ledIcon, credit ? styles.ledIconIn : styles.ledIconOut]}>
        <Text style={[styles.ledGlyph, credit ? styles.ledGlyphIn : styles.ledGlyphOut]}>
          {credit ? "+" : "P"}
        </Text>
      </View>
      <View style={styles.ledText}>
        <Text style={styles.ledTitle} numberOfLines={1}>
          {entry.description}
        </Text>
        <Text style={styles.ledMeta} numberOfLines={1}>
          {new Date(entry.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
        </Text>
      </View>
      <Text style={[styles.ledAmount, credit && styles.ledAmountIn]}>
        {credit ? "+" : "−"}
        {formatMoney(Math.abs(entry.amount))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 13.5, lineHeight: 20 },

  balanceCard: { alignItems: "flex-start", gap: theme.space(0.5) },

  passRow: { flexDirection: "row", alignItems: "center", gap: theme.space(1.5) },
  passRowText: { flex: 1, gap: 2 },
  passRowTitle: { fontSize: 16, fontWeight: "700", color: theme.colour.ink },
  chevron: { fontSize: 22, color: theme.colour.muted },

  chips: { flexDirection: "row", gap: theme.space(1) },
  chip: {
    flex: 1,
    minHeight: theme.minTouch,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: theme.colour.line,
    borderRadius: theme.radius.md,
  },
  chipOn: { borderColor: theme.colour.primary, backgroundColor: theme.colour.primaryWash },
  chipLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colour.ink,
    fontVariant: ["tabular-nums"],
  },
  chipLabelOn: { color: theme.colour.primary },

  ledger: { },
  led: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(1.5),
    paddingVertical: theme.space(1.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colour.line,
  },
  ledLast: { borderBottomWidth: 0 },
  ledIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ledIconIn: { backgroundColor: theme.colour.goodWash },
  ledIconOut: { backgroundColor: theme.colour.raise },
  ledGlyph: { fontSize: 16, fontWeight: "700" },
  ledGlyphIn: { color: theme.colour.good },
  ledGlyphOut: { color: theme.colour.muted },
  ledText: { flex: 1, minWidth: 0, gap: 1 },
  ledTitle: { fontSize: 15, fontWeight: "600", color: theme.colour.ink },
  ledMeta: { fontSize: 12.5, color: theme.colour.muted },
  ledAmount: {
    fontSize: 15.5,
    fontWeight: "700",
    color: theme.colour.ink,
    fontVariant: ["tabular-nums"],
  },
  ledAmountIn: { color: theme.colour.good },
});
