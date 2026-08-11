import type { Api } from "./endpoints";
import type { OfflineCache } from "./cache";
import { estimateFare, type ProvisionalQuote } from "./fare";
import { withinZone } from "./geo";
import type { CachedZone, SlotType } from "./types";

/**
 * Working without signal.
 *
 * Three jobs, and one rule shared by all of them: the server's answer is used
 * whenever the server can be reached, and the cached answer is a clearly
 * labelled substitute when it cannot. Nothing here ever overrides a reply that
 * actually arrived.
 */

/** Fills the cache with everything needed to work through an outage. */
export async function primeCache(
  api: Api,
  cache: OfflineCache,
  vehicleTypes: SlotType[] = ["CAR", "TWO_WHEELER", "THREE_WHEELER"],
): Promise<{ zones: number; tariffs: number; failed: string[] }> {
  await cache.load();
  const failed: string[] = [];

  let zones: CachedZone[] = [];
  try {
    zones = await api.zones.assigned();
    await cache.putZones(zones);
  } catch {
    failed.push("zones");
    zones = cache.get().zones;
  }

  try {
    await cache.putHolidays(await api.tariffs.holidays());
  } catch {
    // The calendar is the least damaging thing to miss — a holiday rate not
    // applied is a small under-charge, and `estimateFare` says so out loud.
    failed.push("holidays");
  }

  // One rate card per open zone and the vehicle types actually seen at a kerb.
  // Fetched sequentially rather than in parallel: this runs while an attendant
  // is standing still with signal, and hammering the API from a hundred
  // handsets at shift change is a worse problem than taking a few seconds.
  let tariffs = 0;
  for (const zone of zones.filter((z) => z.status === "OPEN")) {
    for (const vehicleType of vehicleTypes) {
      if (zone.allowedVehicleTypeIds?.length && !zone.allowedVehicleTypeIds.includes(vehicleType)) {
        continue;
      }
      try {
        const tariff = await api.tariffs.applicable(zone.id, vehicleType);
        await cache.putTariff(zone.id, vehicleType, {
          ...tariff,
          fetchedAt: new Date().toISOString(),
        });
        tariffs += 1;
      } catch {
        failed.push(`tariff:${zone.code}:${vehicleType}`);
      }
    }
  }

  await cache.markPrimed();
  return { zones: zones.length, tariffs, failed };
}

export interface ResolvedZone {
  zone: CachedZone;
  /** True when this came from the cache rather than from the server. */
  offline: boolean;
  alternatives: { id: string; code: string; name: string }[];
}

/**
 * Which zone the handset is standing in, asking the server first.
 *
 * The offline path runs the server's own geometry against cached boundaries. It
 * is no more permissive than the server would be, so a session it allows is one
 * the server will accept when it syncs — the alternative, guessing generously,
 * would queue work destined to be rejected after the cash was taken.
 */
export async function resolveZone(
  api: Api,
  cache: OfflineCache,
  lat: number,
  lng: number,
): Promise<ResolvedZone | null> {
  try {
    const live = await api.zones.resolve(lat, lng);
    return {
      zone: live as unknown as CachedZone,
      offline: false,
      alternatives: live.alternatives ?? [],
    };
  } catch {
    // Fall through — a refusal and an unreachable server look the same from
    // here, and the cache can answer both safely.
  }

  const { zones, geofenceToleranceM } = await cache.load();
  const matches = zones
    .filter((z) => z.status === "OPEN")
    .filter((z) =>
      withinZone(
        { lat, lng },
        z.boundary,
        { lat: z.centerLat, lng: z.centerLng },
        geofenceToleranceM,
      ),
    );

  const nearest = matches[0];
  if (!nearest) return null;
  return {
    zone: nearest,
    offline: true,
    alternatives: matches.slice(1, 4).map((z) => ({ id: z.id, code: z.code, name: z.name })),
  };
}

/**
 * What to charge when the server could not price it.
 *
 * Returns null when there is no cached rate card for this zone and vehicle —
 * in which case the attendant genuinely cannot quote a figure, and the app must
 * say so rather than invent one.
 */
export async function provisionalFare(
  cache: OfflineCache,
  input: {
    zoneId: string;
    vehicleType: SlotType;
    startAt: Date;
    endAt: Date;
    overstayAfterMinutes?: number;
  },
): Promise<ProvisionalQuote | null> {
  const contents = await cache.load();
  const tariff = cache.tariff(input.zoneId, input.vehicleType);
  if (!tariff) return null;

  return estimateFare({
    tariff,
    startAt: input.startAt,
    endAt: input.endAt,
    zoneId: input.zoneId,
    holidays: contents.holidays,
    overstayAfterMinutes: input.overstayAfterMinutes,
  });
}
