import * as React from "react";
import { api, getDeviceId, initialise, isConfigured, loadTokens, onSignedOut, queue, saveTokens } from "./api";
import type { Principal, Shift } from "@kmcp/api";

/**
 * Who is signed in, and what shift they are on.
 *
 * Both are needed almost everywhere in this app — a session cannot be started
 * without an attendant, and cash cannot be collected without a shift to collect
 * it against — so they are resolved once here rather than fetched per screen.
 */

interface SessionState {
  ready: boolean;
  configured: boolean;
  user: Principal | null;
  shift: Shift | null;
  queued: number;
  rejected: number;
  syncing: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshShift: () => Promise<void>;
  sync: () => Promise<void>;
}

const SessionContext = React.createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [user, setUser] = React.useState<Principal | null>(null);
  const [shift, setShift] = React.useState<Shift | null>(null);
  const [queueState, setQueueState] = React.useState({ pending: 0, rejected: 0, syncing: false });

  const refreshShift = React.useCallback(async () => {
    try {
      setShift(await api.shifts.current());
    } catch {
      // A shift we cannot fetch is not a shift that does not exist. Leave what
      // we last knew rather than telling an attendant their shift has gone.
    }
  }, []);

  const loadUser = React.useCallback(async () => {
    const me = (await api.auth.me()) as unknown as Principal;
    setUser(me);
    await refreshShift();
  }, [refreshShift]);

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

  // Drain the queue whenever the app has work outstanding. A kerb has signal in
  // patches, so this retries rather than waiting to be asked.
  React.useEffect(() => {
    if (!user || queueState.pending === 0) return;
    const timer = setInterval(() => void queue.sync(), 30_000);
    return () => clearInterval(timer);
  }, [user, queueState.pending]);

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
  }, []);

  const value: SessionState = {
    ready,
    configured: isConfigured(),
    user,
    shift,
    queued: queueState.pending,
    rejected: queueState.rejected,
    syncing: queueState.syncing,
    signIn,
    signOut,
    refreshShift,
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
