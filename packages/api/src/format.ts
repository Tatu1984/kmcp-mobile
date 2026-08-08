import type { Paise } from "./types";

/**
 * Display helpers.
 *
 * Formatting lives in the shared package so the vendor and citizen apps show a
 * fare the same way. A citizen disputing a charge should not find the amount
 * written differently on the attendant's handset from their own.
 */

/** Paise to rupees. Absent is "—", never "₹0" — those mean different things. */
export function formatMoney(paise: Paise | null | undefined, opts?: { decimals?: boolean }): string {
  if (paise === null || paise === undefined) return "—";
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: opts?.decimals === false ? 0 : 2,
    maximumFractionDigits: opts?.decimals === false ? 0 : 2,
  })}`;
}

/** "2h 15m" — how long a vehicle has been parked, read at arm's length. */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Groups an Indian plate the way it appears on the vehicle. */
export function formatPlate(plate: string): string {
  const clean = plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const match = clean.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  return match ? [match[1], match[2], match[3], match[4]].filter(Boolean).join(" ") : plate;
}

export const normalisePlate = (plate: string): string =>
  plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
