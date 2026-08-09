/**
 * The shapes the API actually returns.
 *
 * Hand-written rather than generated, and deliberately narrow: these describe
 * what the field apps read, not everything the server can say. Anything absent
 * here is absent because no screen needs it yet.
 *
 * Every amount is integer paise. There is no floating point in the money path
 * anywhere in this platform, and adding one here would be the place it starts.
 */

export type Paise = number;

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta: { requestId: string; page?: number; pageSize?: number; total?: number };
  error?: { code: string; message: string; details?: { field: string; issue: string }[] };
}

export type SlotType =
  | "TWO_WHEELER"
  | "THREE_WHEELER"
  | "CAR"
  | "EV"
  | "COMMERCIAL"
  | "BUS"
  | "TRUCK"
  | "VIP"
  | "GOVERNMENT"
  | "ACCESSIBLE";

export type SessionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED" | "OVERSTAY" | "DISPUTED";

export type PaymentMode =
  | "CASH"
  | "UPI_QR"
  | "UPI_INTENT"
  | "CARD"
  | "NETBANKING"
  | "WALLET"
  | "PASS"
  | "CORPORATE";

export interface Principal {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  vendorId?: string | null;
  attendantId?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tokenType: "Bearer";
}

export interface LoginResponse {
  status: "authenticated" | "two_factor_required";
  challengeId?: string;
  tokens?: TokenPair;
  user?: Principal;
}

export interface Zone {
  id: string;
  code: string;
  name: string;
  centerLat: number;
  centerLng: number;
  capacity: number;
  occupied: number;
  available: number;
  occupancyPct: number;
  availability: "AVAILABLE" | "LIMITED" | "FULL";
  allowedVehicleTypeIds: SlotType[];
  openTime: string;
  closeTime: string;
  status: string;
  distanceMetres?: number;
}

export interface Session {
  id: string;
  code: string;
  zoneId: string;
  slotId?: string | null;
  plateNumber: string;
  status: SessionStatus;
  startAt: string;
  endAt?: string | null;
  durationMinutes?: number | null;
  payableAmount?: Paise | null;
  grossAmount?: Paise | null;
  taxAmount: Paise;
  penaltyAmount: Paise;
  evidenceStartMediaId?: string | null;
  zone?: { id: string; code: string; name: string } | null;
  vehicleType?: { code: SlotType; label: string } | null;
  elapsedMinutes?: number | null;
  isOverstay?: boolean;
  /** True when the server recognised this as a replay of an event already recorded. */
  replayed?: boolean;
}

export interface QuoteLine {
  label: string;
  code: string;
  amount: Paise;
}

export interface Quote {
  tariffName: string;
  durationMinutes: number;
  chargeableMinutes: number;
  gracePeriodMin: number;
  lines: QuoteLine[];
  grossAmount: Paise;
  discountAmount: Paise;
  penaltyAmount: Paise;
  taxAmount: Paise;
  taxPercent: number;
  payableAmount: Paise;
  cappedByDailyLimit: boolean;
  waivedByPass: boolean;
}

export interface EndedSession extends Session {
  quote: Quote;
}

export interface PlateLookup {
  plateNumber: string;
  known: boolean;
  vehicle: {
    id: string;
    plateNumber: string;
    makeModel?: string | null;
    colour?: string | null;
    isBlacklisted: boolean;
    vehicleType: { code: SlotType; label: string };
  } | null;
  active: Session | null;
  recent: {
    id: string;
    code: string;
    startAt: string;
    endAt?: string | null;
    payableAmount?: Paise | null;
    zone: { name: string };
  }[];
}

export interface Payment {
  id: string;
  sessionId?: string | null;
  mode: PaymentMode;
  amount: Paise;
  status: "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  paidAt?: string | null;
  receipt?: { id: string; number: string; issuedAt: string } | null;
  replayed?: boolean;
  /** Present for gateway modes, so a checkout sheet can be opened. */
  gatewayKeyId?: string;
  gatewayOrder?: { id: string; amount: number; currency: string };
}

export interface Shift {
  id: string;
  attendantId: string;
  zoneId?: string | null;
  startAt: string;
  endAt?: string | null;
  sessionsCount: number;
  cashExpected: Paise;
  cashDeposited?: Paise | null;
  digitalTotal: Paise;
  varianceAmount?: Paise | null;
  status: "OPEN" | "CLOSED" | "VERIFIED" | "VARIANCE_FLAGGED";
  zone?: { id: string; code: string; name: string } | null;
  alreadyOpen?: boolean;
  variance?: { amount: Paise; short: boolean; over: boolean; matched: boolean };
}

/**
 * What a photograph is for. These are the server's enum values verbatim — a
 * near-miss like "SESSION_START" is refused, so it is a type rather than a
 * string a caller has to remember.
 */
export type MediaPurpose =
  | "SESSION_EVIDENCE_START"
  | "SESSION_EVIDENCE_END"
  | "INCIDENT_PHOTO"
  | "KYC_DOCUMENT"
  | "AGREEMENT"
  | "RECEIPT"
  | "REPORT_EXPORT"
  | "PROFILE";

export interface UploadTicket {
  uploadUrl: string;
  key: string;
  bucket: string;
  expiresInSeconds: number;
  method: "PUT";
  headers: Record<string, string>;
}

export interface Media {
  id: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  purpose: string;
  createdAt: string;
}
