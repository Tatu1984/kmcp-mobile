import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalisePlate } from "@kmcp/api";

/**
 * The number plates this person has told us are theirs.
 *
 * These are kept on the handset, and that is a stopgap that should be removed
 * rather than a design. `Vehicle.ownerUserId` exists in the schema and is
 * indexed; what does not exist is any route a citizen can use to write it, so
 * there is nowhere on the server to put this yet.
 *
 * Being local has one consequence worth stating plainly, because it is the sort
 * of thing that gets discovered by a user rather than by a developer: a plate
 * added here is gone when the app is reinstalled, and does not follow the
 * account to a second phone. The Vehicles screen says so.
 *
 * Nothing is invented in the meantime. A plate here is something a person
 * typed; it is used only as the key for a real lookup against real sessions.
 * When `POST /me/vehicles` exists, this file becomes a one-time migration and
 * then goes away.
 */

const KEY = "kmcp.citizen.plates.v1";

export async function loadPlates(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    // A corrupt list must not stop the app starting. An empty one is
    // recoverable in ten seconds by typing the plate again.
    return [];
  }
}

/** Adds a plate, normalised, without duplicating one already there. */
export async function addPlate(plate: string): Promise<string[]> {
  const normalised = normalisePlate(plate);
  if (!normalised) return loadPlates();

  const existing = await loadPlates();
  if (existing.includes(normalised)) return existing;

  const next = [...existing, normalised];
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
  return next;
}

export async function removePlate(plate: string): Promise<string[]> {
  const next = (await loadPlates()).filter((p) => p !== plate);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
  return next;
}

/**
 * Whether a string looks like an Indian registration.
 *
 * Permissive on purpose. This only decides whether the "Add" button is enabled;
 * the server is what decides whether a plate exists, and a validator here that
 * is stricter than reality would lock somebody out of their own car over a
 * series it has never heard of — Bharat series, defence plates, older formats.
 */
export function looksLikePlate(plate: string): boolean {
  const clean = normalisePlate(plate);
  return clean.length >= 6 && clean.length <= 12 && /^[A-Z]{2}/.test(clean);
}
