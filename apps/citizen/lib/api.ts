import * as SecureStore from "expo-secure-store";
import {
  ApiClient,
  OfflineQueue,
  createApi,
  type Api,
  type TokenPair,
} from "@kmcp/api";

/**
 * One client for the whole app.
 *
 * The shape follows `apps/vendor/lib/api.ts` deliberately, but two things about
 * it are different and neither is an oversight:
 *
 * 1. There is no device binding. An attendant's account is tied to one handset
 *    because that is what stops a depot login being passed around; a citizen
 *    signing in on a borrowed phone or a replacement handset is ordinary
 *    behaviour, and refusing it would be a support queue rather than a control.
 *    The installation id below is sent because the client always sends one — it
 *    identifies an install for rate limiting, not a person.
 *
 * 2. Nothing here is queued for later. The attendant app queues because it
 *    works at kerbs with no signal and its actions must survive that; a citizen
 *    is looking at a map they cannot read offline anyway, and a payment
 *    authorised now and sent in twenty minutes is a payment nobody wants.
 */

const TOKEN_KEY = "kmcp.citizen.tokens";
const INSTALL_KEY = "kmcp.citizen.install";

let tokens: TokenPair | null = null;
let installId = "";
let signedOutHandler: (() => void) | null = null;

export const apiBaseUrl = (): string => process.env.EXPO_PUBLIC_API_URL ?? "";

/** True when this build has somewhere to talk to at all. */
export const isConfigured = (): boolean => apiBaseUrl().length > 0;

/**
 * A stable id for this installation.
 *
 * Random rather than derived from the OS, because it is not identifying the
 * handset — it exists so the server can rate-limit OTP requests per install
 * without needing a phone number to key on before one has been given.
 */
export async function loadInstallId(): Promise<string> {
  if (installId) return installId;

  const stored = await SecureStore.getItemAsync(INSTALL_KEY).catch(() => null);
  if (stored) {
    installId = stored;
    return installId;
  }

  installId = `ins_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  await SecureStore.setItemAsync(INSTALL_KEY, installId).catch(() => undefined);
  return installId;
}

export const getInstallId = (): string => installId;

export async function loadTokens(): Promise<TokenPair | null> {
  if (tokens) return tokens;
  const raw = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  tokens = raw ? (JSON.parse(raw) as TokenPair) : null;
  return tokens;
}

export async function saveTokens(next: TokenPair | null): Promise<void> {
  tokens = next;
  if (next) await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(next));
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function onSignedOut(handler: () => void): void {
  signedOutHandler = handler;
}

export const client = new ApiClient({
  baseUrl: apiBaseUrl(),
  getDeviceId: () => installId,
  getTokens: () => tokens,
  setTokens: (next) => {
    tokens = next;
    // Fire and forget: the in-memory copy is already correct and a request
    // should not wait on a disk write to proceed.
    void saveTokens(next);
  },
  onSignedOut: () => signedOutHandler?.(),
});

/**
 * Present because `createApi` takes one, and left empty on purpose.
 *
 * Nothing the citizen app does is submitted through it — see the note above.
 * It is loaded at startup all the same so that a future queued action does not
 * silently start from a half-initialised store.
 */
export const queue = new OfflineQueue(client);

export const api: Api = createApi(client, queue);

/** Called once at startup, before anything is sent. */
export async function initialise(): Promise<void> {
  await loadInstallId();
  await loadTokens();
  await queue.load();
}
