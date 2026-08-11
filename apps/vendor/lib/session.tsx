import * as React from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { primeCache } from "@kmcp/api";
import type { Principal, Shift } from "@kmcp/api";

import {
  api,
  cache,
  getDeviceId,
  initialise,
  isConfigured,
  loadTokens,
  onSignedOut,
  queue,
  saveTokens,
} from "./api";

/**
 * Who is signed in, what shift they are on, and what has not reached the server.
 *
 * All three are needed almost everywhere — a session cannot be started without
 * an attendant, cash cannot be collected without a shift to collect it against,
 * and nothing may be closed while work is still queued — so they are resolved
 * once here rather than fetched per screen.
 */

interface SessionState {
  ready: boolean;
  configured: boolean;
  user: Principal | null;
  shift: Shift | null;
  queued: number;
  rejected: number;
  syncing: boolean;
  /** True while the handset believes it can reach the network at all. */
  online: boolean;
  /** How stale the cached zones and rate cards are, in hours. */
  cacheAgeHours: number | null;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshShift: () => Promise<void>;
  sync: () => Promise<void>;
  refreshCache: () => Promise<void>;
}

const SessionContext = React.createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [user, setUser] = React.useState<Principal | null>(null);
  const [shift, setShift] = React.useState<Shift | null>(null);
  const [online, setOnline] = React.useState(true);
  const [cacheAgeHours, setCacheAgeHours] = React.useState<number | null>(null);
  const [queueState, setQueueState] = React.useState({ pending: 0, rejected: 0, syncing: false });

  const refreshShift = React.useCallback(async () => {
    try {
      setShift(await api.shifts.current());
    } catch {
      // A shift we cannot fetch is not a shift that does not exist. Leave what
      // we last knew rather than telling an attendant their shift has gone.
    }
  }, []);

  const refreshCache = React.useCallback(async () => {
    try {
      await primeCache(api, cache);
    } catch {
      // Priming is best-effort. Failing it leaves the previous copy in place,
      // which is exactly what it is for.
    }
    setCacheAgeHours(cache.ageHours());
  }, []);

  const loadUser = React.useCallback(async () => {
    const me = (await api.auth.me()) as unknown as Principal;
    setUser(me);
    await refreshShift();
    await refreshCache();
  }, [refreshShift, refreshCache]);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      await initialise();
      onSignedOut(() => {
        setUser(null);
        setShift(null);
      });

      const unsubscribe = queue.subscribe((state) => {
        if (!cancelled) setQueueState(state);
      });

      setCacheAgeHours(cache.ageHours());

      const tokens = await loadTokens();
      if (tokens && isConfigured()) {
        try {
          await loadUser();
        } catch {
          // An expired session on a cold start is ordinary. Show the login
          // screen rather than an error.
        }
      }
      if (!cancelled) setReady(true);
      return unsubscribe;
    })();

    return () => {
      cancelled = true;
    };
  }, [loadUser]);

  /**
   * Drain the queue on the events that actually mean something changed —
   * signal returning, or the attendant opening the app — rather than on a timer
   * that fires uselessly all day and misses the moment a kerb finds a bar of
   * signal. The slow timer stays as a backstop for a handset left face-up on a
   * dashboard with work outstanding.
   */
  React.useEffect(() => {
    if (!user) return;

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      const reachable = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(reachable);
      if (reachable && queue.state().pending > 0) void queue.sync();
    });

    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active" && queue.state().pending > 0) void queue.sync();
    });

    const timer = setInterval(() => {
      if (queue.state().pending > 0) void queue.sync();
    }, 120_000);

    return () => {
      unsubscribeNet();
      subscription.remove();
      clearInterval(timer);
    };
  }, [user]);

  const signIn = React.useCallback(
    async (phone: string, password: string) => {
      const result = await api.auth.loginWithPhone(phone, password, getDeviceId());
      if (result.tokens) await saveTokens(result.tokens);
      await loadUser();
    },
    [loadUser],
  );

  const signOut = React.useCallback(async () => {
    const tokens = await loadTokens();
    if (tokens?.refreshToken) await api.auth.logout(tokens.refreshToken).catch(() => undefined);
    await saveTokens(null);
    setUser(null);
    setShift(null);
    // The cache is deliberately kept: it holds no personal data, only zones and
    // rate cards, and the next attendant on this handset can start work with it.
  }, []);

  const value: SessionState = {
    ready,
    configured: isConfigured(),
    user,
    shift,
    queued: queueState.pending,
    rejected: queueState.rejected,
    syncing: queueState.syncing,
    online,
    cacheAgeHours,
    signIn,
    signOut,
    refreshShift,
    refreshCache,
    sync: async () => {
      await queue.sync();
      await refreshShift();
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = React.useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
