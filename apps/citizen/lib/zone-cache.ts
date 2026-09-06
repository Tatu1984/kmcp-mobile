import { deriveAvailability } from "./availability";
import type { Availability, CachedZone, GeoPolygon, NearbyZone, SlotType } from "@kmcp/api";

/**
 * The car parks the map last fetched, kept in memory for the screen after it.
 *
 * This exists because of a specific hole in the API rather than for speed.
 * `GET /zones/nearby` is public and returns a car park's name, hours, capacity
 * and live availability; `GET /zones/:id`, which would return the same plus the
 * boundary, is behind `zone.read` and answers 403 to a citizen. So the detail
 * screen cannot fetch the zone it is about — but the map already has it, and
 * handing it over is both correct and free.
 *
 * In memory only, and deliberately. Occupancy is the whole point of these
 * figures, and a stale one sends somebody to a full car park. A cold start with
 * no map fetch behind it falls through to `zones.byId`, which fails until that
 * endpoint opens up, and the screen says so rather than guessing.
 */

/**
 * What a screen needs to know about a car park, from whichever endpoint could
 * answer.
 *
 * Two shapes arrive — `NearbyZone` from the public search, `CachedZone` from
 * the guarded detail route — and they overlap almost entirely. Reconciling them
 * once here means no screen has to know which one it got.
 */
export interface ZoneView {
  id: string;
  code: string;
  name: string;
  centerLat: number;
  centerLng: number;
  capacity: number;
  openTime: string;
  closeTime: string;
  allowedVehicleTypeIds: SlotType[];
  occupied: number;
  available: number;
  availability: Availability;
  /** The real lot outline. Only ever present on the guarded route. */
  boundary: GeoPolygon | null;
}

let remembered = new Map<string, ZoneView>();

export function rememberZones(zones: NearbyZone[]): void {
  remembered = new Map(zones.map((zone) => [zone.id, fromNearby(zone)]));
}

export function recallZone(zoneId: string): ZoneView | null {
  return remembered.get(zoneId) ?? null;
}

function fromNearby(zone: NearbyZone): ZoneView {
  return {
    id: zone.id,
    code: zone.code,
    name: zone.name,
    centerLat: zone.centerLat,
    centerLng: zone.centerLng,
    capacity: zone.capacity,
    openTime: zone.openTime,
    closeTime: zone.closeTime,
    allowedVehicleTypeIds: zone.allowedVehicleTypeIds,
    occupied: zone.occupied,
    available: zone.available,
    availability: zone.availability,
    boundary: null,
  };
}

/**
 * The guarded route's shape, reconciled.
 *
 * `CachedZone` carries occupancy only when it came from the server rather than
 * from disk, so the three live figures are optional there. When they are
 * missing the counts fall back to capacity and the verdict is derived — the
 * one place in this app that computes an availability rather than being told
 * one, and only because there is nothing else to show.
 */
export function toZoneView(zone: CachedZone): ZoneView {
  const occupied = zone.occupied ?? 0;
  const available = zone.available ?? Math.max(0, zone.capacity - occupied);
  return {
    id: zone.id,
    code: zone.code,
    name: zone.name,
    centerLat: zone.centerLat,
    centerLng: zone.centerLng,
    capacity: zone.capacity,
    openTime: zone.openTime,
    closeTime: zone.closeTime,
    allowedVehicleTypeIds: zone.allowedVehicleTypeIds,
    occupied,
    available,
    availability: zone.availability ?? deriveAvailability(available, zone.capacity),
    boundary: zone.boundary ?? null,
  };
}
