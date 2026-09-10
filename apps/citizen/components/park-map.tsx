import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker, Polygon, type Region } from "react-native-maps";
import type { GeoPolygon, NearbyZone } from "@kmcp/api";

import { availabilityColour, availabilityWord } from "../lib/availability";
import type { Fix } from "../lib/location";
import { canRenderMap, noMapBody, noMapTitle } from "../lib/maps";
import { theme } from "../lib/theme";

/**
 * The map of car parks.
 *
 * Three things about how this draws are decisions rather than defaults.
 *
 * **The footprint.** The design calls for each car park drawn as its own
 * highlighted lot, and `Zone.boundary` is a real GeoJSON polygon that would do
 * it. But the only zone endpoint a citizen may call — `GET /zones/nearby` —
 * does not select `boundary`, and the one that does is behind `zone.read`. So
 * this draws a polygon when a boundary is handed to it and a small circle at
 * the centre point when it is not. The circle is deliberately modest and
 * uniform: it says "the car park is here", and it does not pretend to be the
 * shape or the size of anything. Inflating it by capacity would be drawing a
 * fact we do not have.
 *
 * **The badge.** Every car park carries its free-bay count on top of it, and
 * that is what a driver actually reads. The green, amber and red are a second
 * channel on the same fact, never the only one — "0" and "31" are legible to
 * somebody who cannot tell the fills apart, and the accessibility label spells
 * out the word as well.
 *
 * **The absent key.** Google Maps on Android renders a blank grey rectangle
 * rather than failing when it has no API key, which is indistinguishable from a
 * map of nowhere. Rather than ship that, this says what has happened; the
 * screen around it still lists every car park, so nothing but the picture is
 * lost.
 */

export function ParkMap({
  centre,
  zones,
  boundaries,
  selectedId,
  onSelect,
  followsUser,
}: {
  centre: Fix;
  zones: NearbyZone[];
  /**
   * Real lot outlines, by zone id, for whenever a public zone view exists.
   * Absent entries fall back to a centre marker.
   */
  boundaries?: Record<string, GeoPolygon | null | undefined>;
  selectedId: string | null;
  onSelect: (zoneId: string) => void;
  /** False when we are showing the city centre rather than the person. */
  followsUser: boolean;
}) {
  /**
   * Markers with custom children come out blank on Android if view tracking is
   * switched off before the first layout has happened. Tracking for a moment
   * and then stopping gets both the rendering and the scroll performance —
   * leaving it on all the time makes panning past twenty badges stutter.
   */
  const [tracking, setTracking] = React.useState(true);
  React.useEffect(() => {
    const timer = setTimeout(() => setTracking(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!canRenderMap) {
    return (
      <View style={styles.noMap} accessibilityRole="summary">
        <Text style={styles.noMapTitle}>{noMapTitle}</Text>
        <Text style={styles.noMapBody}>{noMapBody}</Text>
      </View>
    );
  }

  const region: Region = {
    latitude: centre.lat,
    longitude: centre.lng,
    // About two kilometres across, which is the radius the nearby search uses.
    // Any tighter and half the results sit off-screen with no way to know.
    latitudeDelta: 0.022,
    longitudeDelta: 0.022,
  };

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={region}
      showsUserLocation={followsUser}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      loadingEnabled
      loadingBackgroundColor={theme.colour.mapGround}
      loadingIndicatorColor={theme.colour.primary}
    >
      {zones.map((zone) => {
        const colour = availabilityColour(zone.availability);
        const boundary = boundaries?.[zone.id];
        const ring = boundary?.coordinates?.[0];
        const selected = zone.id === selectedId;

        return (
          <React.Fragment key={zone.id}>
            {ring && ring.length >= 3 ? (
              <Polygon
                // GeoJSON is [longitude, latitude]; every mapping library on
                // this platform wants the opposite. Getting this backwards puts
                // Kolkata in the Indian Ocean, which is at least obvious.
                coordinates={ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
                fillColor={`${colour}38`}
                strokeColor={colour}
                strokeWidth={selected ? 3 : 2}
                tappable
                onPress={() => onSelect(zone.id)}
              />
            ) : (
              <Circle
                center={{ latitude: zone.centerLat, longitude: zone.centerLng }}
                radius={40}
                fillColor={`${colour}38`}
                strokeColor={colour}
                strokeWidth={selected ? 3 : 2}
              />
            )}

            <Marker
              coordinate={{ latitude: zone.centerLat, longitude: zone.centerLng }}
              onPress={() => onSelect(zone.id)}
              tracksViewChanges={tracking}
              anchor={{ x: 0.5, y: 0.5 }}
              accessibilityLabel={`${zone.name}, ${zone.available} bays free of ${zone.capacity}, ${availabilityWord[zone.availability]}`}
            >
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colour },
                  selected && styles.badgeSelected,
                ]}
              >
                <Text style={styles.badgeText}>
                  {zone.availability === "FULL" ? "FULL" : zone.available}
                </Text>
              </View>
            </Marker>
          </React.Fragment>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  noMap: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colour.mapGround,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.space(3),
    gap: theme.space(1),
  },
  noMapTitle: {
    ...theme.text.title,
    color: theme.colour.ink,
    textAlign: "center",
  },
  noMapBody: {
    ...theme.text.sub,
    color: theme.colour.muted,
    textAlign: "center",
    lineHeight: 21,
  },

  badge: {
    minWidth: 36,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeSelected: {
    borderColor: theme.colour.ink,
    borderWidth: 2.5,
    height: 26,
    minWidth: 42,
    borderRadius: 13,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
