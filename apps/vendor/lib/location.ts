import * as React from "react";
import * as Location from "expo-location";

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export type LocationState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; fix: Fix }
  | { status: "denied" }
  | { status: "failed"; reason: string };

/**
 * Where the handset is.
 *
 * The server decides whether that is inside the zone — this only reports what
 * the device observed. A phone that could choose its own answer to "am I
 * allowed to start a session here" is a phone that can start sessions anywhere.
 *
 * Balanced accuracy rather than the highest available: a kerb is tens of metres
 * across, and the high-accuracy mode costs seconds an attendant does not have
 * with a driver waiting.
 */
export function useLocation(auto = true): LocationState & { locate: () => Promise<Fix | null> } {
  const [state, setState] = React.useState<LocationState>({ status: "idle" });

  const locate = React.useCallback(async (): Promise<Fix | null> => {
    setState({ status: "locating" });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setState({ status: "denied" });
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const fix: Fix = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy ?? null,
      };
      setState({ status: "ready", fix });
      return fix;
    } catch (error) {
      setState({
        status: "failed",
        reason: error instanceof Error ? error.message : "Could not get a position.",
      });
      return null;
    }
  }, []);

  React.useEffect(() => {
    if (auto) void locate();
  }, [auto, locate]);

  return { ...state, locate };
}
