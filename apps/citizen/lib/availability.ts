import type { Availability, SlotStatus } from "@kmcp/api";

import { theme } from "./theme";

/**
 * How "can I park here" is turned into a colour and a word.
 *
 * The server already answers this — `Zone.availability` is AVAILABLE, LIMITED
 * or FULL, computed from the same occupancy figures it uses everywhere else —
 * and that answer is always preferred. `deriveAvailability` exists only for the
 * places where we hold counts without a verdict attached, chiefly the bay
 * summary, and it uses the same thresholds so the two never disagree on screen.
 *
 * Every use of these colours is accompanied by a number or a word. Green, amber
 * and red mean exactly one thing in this app and are used for nothing else.
 */

export function deriveAvailability(free: number, total: number): Availability {
  if (free <= 0) return "FULL";
  // A fifth of a car park left is the point at which a driver should consider
  // somewhere else — by the time they have driven there it will be less.
  if (total > 0 && free / total <= 0.2) return "LIMITED";
  return "AVAILABLE";
}

/** The word on the legend and the chip. Read on its own, without the colour. */
export const availabilityWord: Record<Availability, string> = {
  AVAILABLE: "Space",
  LIMITED: "Filling up",
  FULL: "Full",
};

export function availabilityColour(availability: Availability): string {
  if (availability === "FULL") return theme.colour.crit;
  if (availability === "LIMITED") return theme.colour.warn;
  return theme.colour.good;
}

export function availabilityTone(availability: Availability): "good" | "warn" | "crit" {
  if (availability === "FULL") return "crit";
  if (availability === "LIMITED") return "warn";
  return "good";
}

/**
 * A bay's own colour.
 *
 * OUT_OF_SERVICE is drawn as occupied rather than given a fourth colour: to a
 * driver looking for somewhere to leave a car, a bay that is coned off and a
 * bay with a car in it are the same answer, and the distinction only matters to
 * whoever maintains the car park. The bay label still carries its code, so
 * nothing is lost.
 */
export function bayColours(status: SlotStatus): {
  background: string;
  ink: string;
  border: string | null;
  dashed: boolean;
} {
  switch (status) {
    case "AVAILABLE":
      return {
        background: theme.colour.goodWash,
        ink: theme.colour.good,
        border: theme.colour.good,
        dashed: false,
      };
    case "RESERVED":
      // Dashed, not just amber — a booked bay is the one case where the state
      // is temporary, and a driver who cannot see the amber still sees a
      // broken outline that is plainly not the same as the solid free ones.
      return {
        background: theme.colour.warnWash,
        ink: theme.colour.warn,
        border: theme.colour.warn,
        dashed: true,
      };
    default:
      return {
        background: theme.colour.occupiedWash,
        ink: theme.colour.occupied,
        border: null,
        dashed: false,
      };
  }
}

/** How a bay status reads out loud, for the accessibility label on each cell. */
export const bayWord: Record<SlotStatus, string> = {
  AVAILABLE: "free",
  OCCUPIED: "occupied",
  RESERVED: "booked",
  OUT_OF_SERVICE: "out of service",
};

/** The human name of a vehicle type, matching the mockup's breakdown rows. */
export const vehicleTypeWord: Record<string, string> = {
  CAR: "Car",
  TWO_WHEELER: "Two-wheeler",
  THREE_WHEELER: "Three-wheeler",
  EV: "Electric",
  COMMERCIAL: "Commercial",
  BUS: "Bus",
  TRUCK: "Truck",
  VIP: "VIP",
  GOVERNMENT: "Government",
  ACCESSIBLE: "Accessible",
};
