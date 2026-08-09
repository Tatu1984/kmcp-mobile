import type { ApiClient } from "./client";
import type { OfflineQueue } from "./queue";
import { newEventId } from "./queue";
import type {
  EndedSession,
  LoginResponse,
  Media,
  MediaPurpose,
  Payment,
  PlateLookup,
  Session,
  Shift,
  SlotType,
  UploadTicket,
  Zone,
} from "./types";

/**
 * Every call the field apps make.
 *
 * The ones that change something go through the queue; the ones that only read
 * go straight out, because stale reads are cheap and a queued read is useless.
 */
export function createApi(client: ApiClient, queue: OfflineQueue) {
  return {
    auth: {
      login: (email: string, password: string, deviceFingerprint: string) =>
        client.post<LoginResponse>(
          "/auth/login",
          { email, password, deviceFingerprint, platform: "android" },
          { anonymous: true },
        ),

      loginWithPhone: (phone: string, password: string, deviceFingerprint: string) =>
        client.post<LoginResponse>(
          "/auth/login",
          { phone, password, deviceFingerprint, platform: "android" },
          { anonymous: true },
        ),

      me: () => client.get<Record<string, unknown>>("/auth/me"),

      logout: (refreshToken: string) =>
        client.post("/auth/logout", { refreshToken }, { anonymous: true }),
    },

    zones: {
      /** Which zone the attendant is standing in. The server decides, not the phone. */
      resolve: (lat: number, lng: number) =>
        client.get<Zone & { alternatives: { id: string; code: string; name: string }[] }>(
          "/zones/resolve",
          { query: { lat, lng } },
        ),

      nearby: (lat: number, lng: number, radius = 500) =>
        client.get<Zone[]>("/zones/nearby", { query: { lat, lng, radius }, anonymous: true }),
    },

    sessions: {
      lookup: (plateNumber: string) =>
        client.get<PlateLookup>(`/sessions/plate/${encodeURIComponent(plateNumber)}`),

      /** One session by its human-quotable code, or its id. */
      get: (idOrCode: string) => client.get<Session>(`/sessions/${encodeURIComponent(idOrCode)}`),

      mine: (attendantId: string) =>
        client.get<Session[]>("/sessions", {
          query: { attendantId, status: "ACTIVE", pageSize: 100 },
        }),

      /**
       * Starts a session. Queued when offline — the clientEventId is what makes
       * a replay return the original session rather than a second charge.
       */
      start: (input: {
        zoneId: string;
        plateNumber: string;
        vehicleType: SlotType;
        location?: { lat: number; lng: number };
        evidenceMediaId?: string;
        slotId?: string;
      }) => {
        const id = newEventId();
        return queue.submit<Session>({
          id,
          kind: "session.start",
          path: "/sessions/start",
          body: { ...input, clientEventId: id, source: "ATTENDANT_APP", startedAt: new Date().toISOString() },
        });
      },

      end: (idOrCode: string, input: { location?: { lat: number; lng: number }; evidenceMediaId?: string } = {}) => {
        const id = newEventId();
        return queue.submit<EndedSession>({
          id,
          kind: "session.end",
          path: `/sessions/${idOrCode}/end`,
          body: { ...input, clientEventId: id, endedAt: new Date().toISOString() },
        });
      },
    },

    payments: {
      /** Cash captures immediately; the receipt comes back with it. */
      collectCash: (sessionId: string) => {
        const id = newEventId();
        return queue.submit<Payment>({
          id,
          kind: "payment.collect",
          path: "/payments/collect",
          body: { sessionId, mode: "CASH", idempotencyKey: id },
        });
      },

      collectDigital: (sessionId: string, mode: "UPI_QR" | "UPI_INTENT" | "CARD") => {
        const id = newEventId();
        // Not queued: a gateway order is worthless once the payer has walked
        // away, so this either happens now or does not happen.
        return client.post<Payment>("/payments/collect", {
          sessionId,
          mode,
          idempotencyKey: id,
        });
      },
    },

    shifts: {
      current: () => client.get<Shift | null>("/shifts/current"),

      open: (input: { zoneId?: string; location?: { lat: number; lng: number } } = {}) =>
        client.post<Shift>("/shifts/open", input),

      close: (id: string, cashDeposited: number, location?: { lat: number; lng: number }) => {
        const eventId = newEventId();
        return queue.submit<Shift>({
          id: eventId,
          kind: "shift.close",
          path: `/shifts/${id}/close`,
          body: { cashDeposited, location },
        });
      },
    },

    media: {
      /**
       * Uploads a photograph straight to storage.
       *
       * The bytes never pass through the API, which is what makes this survivable
       * on a bad connection — a 4 MB photograph fighting a function timeout is
       * how evidence gets lost.
       */
      upload: async (uri: string, purpose: MediaPurpose, mimeType = "image/jpeg") => {
        // Read the file before asking for a ticket, so the size sent is the
        // size that will actually be uploaded. The server rejects a zero, and a
        // caller guessing at the length of a photograph it has not opened is
        // exactly how that zero gets sent.
        const file = await fetch(uri);
        const blob = await file.blob();
        const sizeBytes = blob.size;
        if (!sizeBytes) throw new Error("The photograph is empty.");

        const ticket = await client.post<UploadTicket>("/media/uploads", {
          purpose,
          mimeType,
          sizeBytes,
        });

        const put = await fetch(ticket.uploadUrl, {
          method: ticket.method,
          headers: ticket.headers,
          body: blob,
        });
        if (!put.ok) throw new Error(`Storage rejected the photograph (${put.status}).`);

        return client.post<Media>("/media/uploads/confirm", {
          key: ticket.key,
          purpose,
          mimeType,
          sizeBytes,
          capturedAt: new Date().toISOString(),
        });
      },
    },
  };
}

export type Api = ReturnType<typeof createApi>;
