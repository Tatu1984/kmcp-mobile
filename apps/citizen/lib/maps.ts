import { Platform } from "react-native";

/**
 * Whether there is a map to draw at all.
 *
 * Android's Google Maps will not render a single tile without an API key. It
 * does not throw and it does not warn — it draws a blank grey rectangle with
 * the Google logo in the corner, which looks exactly like a map that has failed
 * to load, or like an area with no roads in it. That is the worst possible
 * failure for the main screen of this app, so the key is checked up front and
 * the map screen falls back to something that says what is wrong.
 *
 * iOS uses Apple Maps and needs no key, so it is never in this state.
 *
 * The key itself is never hardcoded: it comes from `EXPO_PUBLIC_GOOGLE_MAPS_KEY`
 * through `app.config.ts`, and is read here only to find out whether one was
 * supplied. Nothing in the app ever sends it anywhere itself.
 */
export const googleMapsKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "").trim();

export const canRenderMap = Platform.OS !== "android" || googleMapsKey.length > 0;

/**
 * What to tell somebody when there is no map.
 *
 * Written for the person holding the phone rather than the person who forgot
 * the key: they cannot fix it, so the message says what they get instead.
 */
export const noMapTitle = "Map unavailable — no API key configured";
export const noMapBody =
  "This build has no Google Maps key, so the map cannot be drawn. The car parks below are live and complete; only the picture is missing.";

/**
 * A geo: link the phone's own maps app will open.
 *
 * Deliberately not a Google Maps URL. `geo:` is honoured by whatever the person
 * has chosen as their maps app, and a citizen who has decided not to use Google
 * Maps should not be forced into it by a municipal parking app. The label is
 * carried as a query so the pin arrives named rather than as a bare coordinate.
 */
export function directionsUrl(lat: number, lng: number, label: string): string {
  const encoded = encodeURIComponent(label);
  return Platform.OS === "ios"
    ? `maps://?daddr=${lat},${lng}&q=${encoded}`
    : `geo:${lat},${lng}?q=${lat},${lng}(${encoded})`;
}
