import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SlotStatus } from "@kmcp/api";

import { bayColours, bayWord } from "../lib/availability";
import { theme } from "../lib/theme";
import { Swatch } from "./ui";

/**
 * The three things this app draws that are not text: the capacity bar, the
 * vehicle-type breakdown, and the bay grid.
 *
 * All three obey the same rule. A bar is never the only carrier of a fact — the
 * legend beneath it repeats every segment as a word and a number, and every bay
 * cell is labelled with its own code. Someone reading this in bright sunlight
 * through a cracked screen protector, or with any form of colour blindness,
 * loses nothing but the speed.
 */

export interface Segment {
  key: string;
  /** What this segment is, spelled out. Appears in the legend, not on the bar. */
  label: string;
  count: number;
  colour: string;
}

/**
 * Free, occupied and booked as one stacked bar.
 *
 * The segments are separated by a 2pt gap in the page ground rather than a
 * border, which is what keeps two adjacent segments of similar lightness from
 * reading as one. A segment with a zero count is dropped entirely — a hairline
 * of colour that stands for nothing is worse than an absence.
 */
export function CapacityBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const shown = segments.filter((s) => s.count > 0);

  if (total <= 0) {
    return <View style={[styles.bar, styles.barEmpty]} accessibilityElementsHidden />;
  }

  return (
    <View
      style={styles.bar}
      accessibilityRole="image"
      accessibilityLabel={segments.map((s) => `${s.count} ${s.label}`).join(", ")}
    >
      {shown.map((segment) => (
        <View
          key={segment.key}
          style={{
            flexGrow: segment.count,
            flexBasis: 0,
            height: "100%",
            backgroundColor: segment.colour,
          }}
        />
      ))}
    </View>
  );
}

/** The legend under the bar. This is where the numbers actually live. */
export function CapacityKey({
  segments,
  withCounts = true,
}: {
  segments: Segment[];
  withCounts?: boolean;
}) {
  return (
    <View style={styles.key}>
      {segments.map((segment) => (
        <View key={segment.key} style={styles.keyItem}>
          <Swatch colour={segment.colour} />
          <Text style={styles.keyLabel}>{segment.label}</Text>
          {withCounts ? <Text style={styles.keyCount}>{segment.count}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * One row of the "what kind of bay" breakdown: a name, a short bar, and the
 * count in the form "4 of 30".
 *
 * The bar is a proportion of that type's own total, not of the car park, so a
 * row for four accessible bays is not a sliver next to a row for thirty cars.
 */
export function TypeLine({
  name,
  free,
  total,
  last = false,
}: {
  name: string;
  free: number;
  total: number;
  last?: boolean;
}) {
  const fraction = total > 0 ? Math.max(0, Math.min(1, free / total)) : 0;
  return (
    <View
      style={[styles.tline, last && styles.tlineLast]}
      accessibilityRole="text"
      accessibilityLabel={`${name}, ${free} free of ${total}`}
    >
      <Text style={styles.tlineName}>{name}</Text>
      <View style={styles.tlineTrack}>
        <View style={[styles.tlineFill, { width: `${fraction * 100}%` }]} />
      </View>
      <Text style={styles.tlineCount}>
        {free} of {total}
      </Text>
    </View>
  );
}

/**
 * One bay. The code is always visible, so the grid is readable as a list of
 * bays even if every colour on it were to render identically.
 */
export function Bay({ code, status }: { code: string; status: SlotStatus }) {
  const colours = bayColours(status);
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Bay ${code}, ${bayWord[status]}`}
      style={[
        styles.bay,
        {
          backgroundColor: colours.background,
          borderWidth: colours.border ? 1.5 : 0,
          borderColor: colours.border ?? "transparent",
          borderStyle: colours.dashed ? "dashed" : "solid",
        },
      ]}
    >
      <Text style={[styles.bayCode, { color: colours.ink }]} numberOfLines={1}>
        {code}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: 2,
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
  },
  barEmpty: { backgroundColor: theme.colour.occupiedWash },

  key: { flexDirection: "row", flexWrap: "wrap", gap: theme.space(1.75) },
  keyItem: { flexDirection: "row", alignItems: "center", gap: theme.space(0.5) },
  keyLabel: { fontSize: 12.5, fontWeight: "600", color: theme.colour.muted },
  keyCount: {
    fontSize: 12.5,
    fontWeight: "700",
    color: theme.colour.ink,
    fontVariant: ["tabular-nums"],
  },

  tline: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(1.25),
    paddingVertical: theme.space(1.125),
    borderBottomWidth: 1,
    borderBottomColor: theme.colour.line,
  },
  tlineLast: { borderBottomWidth: 0 },
  tlineName: { flex: 1, fontSize: 14.5, fontWeight: "600", color: theme.colour.ink },
  tlineTrack: {
    width: 74,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colour.occupiedWash,
    overflow: "hidden",
  },
  tlineFill: { height: "100%", backgroundColor: theme.colour.good, borderRadius: 3 },
  tlineCount: {
    fontSize: 13.5,
    color: theme.colour.muted,
    fontVariant: ["tabular-nums"],
    minWidth: 58,
    textAlign: "right",
  },

  bay: {
    flex: 1,
    minHeight: 34,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  bayCode: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
});
