import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * A config file rather than `app.json`, because one value in it has to come
 * from the environment.
 *
 * Google Maps on Android will not draw a tile without an API key, and a key
 * committed to a repository is a key that ends up billed to somebody else. So
 * it is read from `EXPO_PUBLIC_GOOGLE_MAPS_KEY` at build time and left absent
 * when nobody has set one — the map screen checks for exactly that and explains
 * itself instead of rendering a grey rectangle nobody can interpret. Apple Maps
 * needs no key, so iOS is unaffected either way.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

  return {
    ...config,
    name: "KMCP Parking",
    slug: "kmcp-citizen",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "kmcpparking",
    // Light, deliberately, and not a preference: the whole app is built around
    // a map, and a map on a dark ground is unreadable in daylight.
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: false,
      bundleIdentifier: "in.gov.kmc.parking.citizen",
    },
    android: {
      package: "in.gov.kmc.parking.citizen",
      permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
      // Omitted entirely when there is no key. An empty string here is worse
      // than nothing: the native module treats it as a real key and fails at
      // runtime somewhere far from the cause.
      ...(googleMapsKey ? { config: { googleMaps: { apiKey: googleMapsKey } } } : {}),
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-status-bar",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "KMCP uses your location to show the car parks nearest to you. It is never sent anywhere but the search for nearby bays.",
        },
      ],
    ],
    experiments: { typedRoutes: true },
  };
};
