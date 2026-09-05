import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ApiError,
  MISSING,
  formatDuration,
  formatMoney,
  gapOf,
  type MySession,
  type MySpendSummary,
} from "@kmcp/api";

import {
  Banner,
  Button,
  Card,
  Chip,
  Empty,
  Label,
  Loading,
  Screen,
  Sub,
  Unavailable,
} from "../../components/ui";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { theme } from "../../lib/theme";

/**
 * What you have paid for parking.
 *
 * Every figure on this screen already exists on the server, and none of it is
 * reachable. Sessions, payments and receipts are all recorded, `Payment.
 * paidByUserId` already attributes a payment to the citizen who made it, and
 * the indexes are in place — what is missing is a door: no route reads any of
 * it back to the person it belongs to.
 *
 * So the totals are the server's or they are absent. A monthly figure added up
 * on the handset from whatever happened to be fetched would disagree with the
 * receipts the moment a page boundary or a refund got involved, and a person
 * checking their own spending is the last audience to hand a number that is
 * nearly right.
 */
export default function History() {
  const router = useRouter();
  const { user } = useSession();

  const [sessions, setSessions] = React.useState<MySession[] | null>(null);
  const [summary, setSummary] = React.useState<MySpendSummary | null>(null);
  const [gap, setGap] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    void (async () => {
      const [sessionsResult, summaryResult] = await Promise.allSettled([
        api.me.sessions("COMPLETED"),
        api.me.summary(),
      ]);
      if (cancelled) return;

      if (sessionsResult.status === "fulfilled") setSessions(sessionsResult.value);
      if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);

      if (sessionsResult.status === "rejected") {
        if (gapOf(sessionsResult.reason)) setGap(true);
        else {
          setError(
            sessionsResult.reason instanceof ApiError
              ? sessionsResult.reason.message
              : "Could not load your parking history.",
          );
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <Screen>
        <Card raise>
          <Label>Sign in first</Label>
          <Sub style={styles.body}>
            Your parking history belongs to your account. Sign in with your mobile number to see it.
          </Sub>
        </Card>
        <Button label="Sign in" onPress={() => router.push("/sign-in")} />
      </Screen>
    );
  }

  if (loading) return <Loading label="Loading your parking" />;

  if (gap) {
    return (
      <Screen>
        <Unavailable
          title="Your parking history is not readable yet"
          body={`${MISSING.mySessions!.because}\n\nNeeds: ${MISSING.mySessions!.route} and ${MISSING.myPayments!.route}`}
        />
        <Card>
          <Label>Nothing is lost</Label>
          <Sub style={styles.body}>
            Every session you have parked, every payment and every receipt is recorded on the
            server, and each payment already carries the account that made it. What is missing is a
            way to read them back to you — a scoped read over tables that already exist and are
            already indexed for it.
          </Sub>
        </Card>
        {error ? <Banner tone="crit" title={error} /> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      {error ? <Banner tone="crit" title={error} /> : null}

      {/* --------------------------------------------------- this month */}
      {summary ? (
        <Card raise style={styles.summary}>
          <View>
            <Label>This month</Label>
            <Text style={styles.summaryValue}>{formatMoney(summary.totalPaid)}</Text>
          </View>
          <View style={styles.summaryRight}>
            <Label>Sessions</Label>
            <Text style={styles.summaryValue}>{summary.sessions}</Text>
          </View>
        </Card>
      ) : (
        <Unavailable
          title="The monthly total is not available"
          body={`It is deliberately not added up on this phone — a figure that disagrees with your receipts is worse than no figure.\n\nNeeds: ${MISSING.mySessions!.route}`}
        />
      )}

      {/* ------------------------------------------------------ sessions */}
      {sessions === null ? null : sessions.length === 0 ? (
        <Empty
          title="No parking yet"
          body="When an attendant starts a session for one of your vehicles, it appears here with its receipt once it is paid."
        />
      ) : (
        sessions.map((session) => <SessionCard key={session.id} session={session} />)
      )}
    </Screen>
  );
}

/** One past session: where, when, how long, and what it came to. */
function SessionCard({ session }: { session: MySession }) {
  const refunded = session.refundedAmount > 0;
  const cancelled = session.status === "CANCELLED";

  const when = new Date(session.startAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  const span =
    session.endAt === null
      ? "still parked"
      : `${time(session.startAt)}–${time(session.endAt)} · ${formatDuration(session.durationMinutes)}`;

  return (
    <Card>
      <View style={styles.sessionHead}>
        <View style={styles.sessionText}>
          <Text style={styles.sessionName} numberOfLines={1}>
            {session.zone.name}
          </Text>
          <Text style={styles.sessionMeta} numberOfLines={1}>
            {when} · {cancelled ? "cancelled" : span}
          </Text>
        </View>
        <View style={styles.sessionRight}>
          <Text style={[styles.sessionAmount, refunded && styles.sessionAmountRefunded]}>
            {formatMoney(refunded ? session.refundedAmount : session.payableAmount)}
          </Text>
          {refunded ? (
            <Chip tone="good" label="Refunded" />
          ) : session.receipt ? (
            <Chip label="Receipt" />
          ) : null}
        </View>
      </View>

      {session.receipt ? (
        <Sub style={styles.receipt}>Receipt {session.receipt.number}</Sub>
      ) : null}
    </Card>
  );
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

const styles = StyleSheet.create({
  body: { fontSize: 13.5, lineHeight: 20 },

  summary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryRight: { alignItems: "flex-end" },
  summaryValue: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colour.ink,
    fontVariant: ["tabular-nums"],
  },

  sessionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.space(1.25),
  },
  sessionText: { flex: 1, gap: 2 },
  sessionName: { fontSize: 16, fontWeight: "700", color: theme.colour.ink },
  sessionMeta: { fontSize: 13, color: theme.colour.muted },
  sessionRight: { alignItems: "flex-end", gap: theme.space(0.5) },
  sessionAmount: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.colour.ink,
    fontVariant: ["tabular-nums"],
  },
  sessionAmountRefunded: { color: theme.colour.good },

  receipt: { fontSize: 12.5 },
});
