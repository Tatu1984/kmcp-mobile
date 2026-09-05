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
 * The centre of Kolkata, used when we do not know where the phone is.
 *
 * Refusing to show a map until permission is granted would be the wrong trade:
 * somebody who has just declined a location prompt still wants to see the car
 * parks, and the Esplanade is a defensible guess for a city parking app. The
 * map says plainly that it is showing the city centre rather than the user.
 */
export const KOLKATA: Fix = { lat: 22.5726, lng: 88.3639, accuracy: null };

/**
 * Where the phone is.
 *
 * Balanced accuracy rather than the best available. This is used to sort a list
 * of car parks by distance and to centre a map, and neither needs metres — the
 * high-accuracy mode costs seconds and battery for a precision nothing here
 * spends.
 *
 * A denial is a first-class state, not an error. It is a perfectly reasonable
 * thing for somebody to do, and every screen that uses this has to keep working
 * afterwards.
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

/** How far away a car park is, in the words a person walking would use. */
export function formatDistance(metres: number | null | undefined): string {
  if (metres === null || metres === undefined) return "—";
  if (metres < 950) return `${Math.round(metres / 10) * 10} m away`;
  return `${(metres / 1000).toFixed(1)} km away`;
}

/**
 * Roughly how long it takes to walk that far.
 *
 * Straight-line distance at 80 metres a minute, rounded up, and never less than
 * a minute. It is an estimate and reads as one — nothing here knows about
 * crossings, one-way streets or the Maidan.
 */
export function walkMinutes(metres: number | null | undefined): number | null {
  if (metres === null || metres === undefined) return null;
  return Math.max(1, Math.ceil(metres / 80));
}
