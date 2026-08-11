import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";
import { Platform } from "react-native";
import {
  ApiClient,
  OfflineCache,
  OfflineQueue,
  createApi,
  type Api,
  type TokenPair,
} from "@kmcp/api";

/**
 * One client, one queue, for the whole app.
 *
 * Tokens are held in memory and mirrored into the secure store, so a handset
 * that is locked, backgrounded or restarted mid-shift does not sign the
 * attendant out — losing a session at the kerb means queueing at a depot to get
 * back in.
 */

const TOKEN_KEY = "kmcp.tokens";
const DEVICE_KEY = "kmcp.device";

let tokens: TokenPair | null = null;
let deviceId = "";
let signedOutHandler: (() => void) | null = null;

export const apiBaseUrl = (): string => process.env.EXPO_PUBLIC_API_URL ?? "";

/** True when the app has somewhere to talk to at all. */
export const isConfigured = (): boolean => apiBaseUrl().length > 0;

/**
 * A stable identifier for this handset.
 *
 * Attendant accounts are bound to one device — that is what stops a login being
 * shared around a depot — so this has to survive an app restart. It is derived
 * from the OS install id where there is one, and generated and stored otherwise.
 */
export async function loadDeviceId(): Promise<string> {
  if (deviceId) return deviceId;

  const stored = await SecureStore.getItemAsync(DEVICE_KEY);
  if (stored) {
    deviceId = stored;
    return deviceId;
  }

  const native =
    Platform.OS === "android"
      ? Application.getAndroidId()
      : await Application.getIosIdForVendorAsync();

  deviceId = native ?? `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await SecureStore.setItemAsync(DEVICE_KEY, deviceId);
  return deviceId;
}

export async function loadTokens(): Promise<TokenPair | null> {
  if (tokens) return tokens;
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  tokens = raw ? (JSON.parse(raw) as TokenPair) : null;
  return tokens;
}

export async function saveTokens(next: TokenPair | null): Promise<void> {
  tokens = next;
  if (next) await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(next));
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** The handset id this app is bound to. Empty until initialise() has run. */
export const getDeviceId = (): string => deviceId;

export function onSignedOut(handler: () => void): void {
  signedOutHandler = handler;
}

export const client = new ApiClient({
  baseUrl: apiBaseUrl(),
  getDeviceId: () => deviceId,
  getTokens: () => tokens,
  setTokens: (next) => {
    tokens = next;
    // Fire and forget: the in-memory copy is already correct, and blocking a
    // request on a disk write would be the wrong trade at a kerb.
    void saveTokens(next);
  },
  onSignedOut: () => signedOutHandler?.(),
});

export const queue = new OfflineQueue(client);
export const api: Api = createApi(client, queue);

/**
 * Reference data kept for working through an outage — zones with their
 * boundaries, rate cards, and the holiday calendar. Filled at sign-in and at
 * shift open, which are the two moments a handset is reliably somewhere with
 * signal and about to go somewhere without it.
 */
export const cache = new OfflineCache();

/** Called once at startup, before anything is sent. */
export async function initialise(): Promise<void> {
  await loadDeviceId();
  await loadTokens();
  await queue.load();
  await cache.load();
}
