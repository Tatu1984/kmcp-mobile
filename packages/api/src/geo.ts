export interface LatLng {
  lat: number;
  lng: number;
}

/** A GeoJSON Polygon, exactly as the server stores it on `Zone.boundary`. */
export interface GeoPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}

/**
 * The same geometry the server uses, running on the handset.
 *
 * This is a deliberate exception to "nothing on a device decides anything".
 * It decides nothing: the server re-runs exactly this check when the session
 * syncs and refuses it if the point was outside. What it buys is that an
 * attendant with no signal can still start a session in a zone they are plainly
 * standing in, instead of the app stopping dead.
 *
 * Kept a faithful copy of `geo.util.ts` rather than an approximation — an
 * offline check that is *more* permissive than the server's would queue work
 * that is certain to be rejected later, which is worse than refusing it now.
 */
export function pointInPolygon(point: LatLng, polygon: GeoPolygon | null | undefined): boolean {
  const ring = polygon?.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 3) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;
    const [xi, yi] = a;
    const [xj, yj] = b;
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

const EARTH_RADIUS_M = 6_371_000;

export function distanceMetres(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

/**
 * Inside the boundary, or within `toleranceM` of the centre.
 *
 * The tolerance exists because a GPS fix at a kerb is routinely 10–20 m out,
 * and refusing those readings would block honest attendants. The default
 * matches the server's own default; the real value is configuration the app
 * caches when it can.
 */
export function withinZone(
  point: LatLng,
  boundary: GeoPolygon | null | undefined,
  centre: LatLng,
  toleranceM = 25,
): boolean {
  if (boundary && pointInPolygon(point, boundary)) return true;
  return distanceMetres(point, centre) <= toleranceM;
}
