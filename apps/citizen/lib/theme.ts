/**
 * The citizen palette.
 *
 * Deliberately not the vendor theme. The attendant app is dark because it is
 * read at arm's length in Kolkata sun by someone who never looks at a map; this
 * app is almost entirely a map, and a map rendered on a dark ground is
 * unreadable — the tile artwork fights the chrome and every road turns into a
 * smear. So: light ground, dark ink, and the same three status hues used for
 * exactly one job each.
 *
 * The structure mirrors `apps/vendor/lib/theme.ts` on purpose, so that anyone
 * moving between the two apps finds `space()`, `radius`, `text` and `minTouch`
 * where they expect them, even though every value differs.
 */
export const theme = {
  colour: {
    bg: "#FFFFFF",
    /** A panel that needs to sit apart from the page without a border. */
    raise: "#F4F7FB",
    line: "#DEE5EF",
    ink: "#0E1726",
    muted: "#5D6B80",
    primary: "#2563EB",
    primaryText: "#FFFFFF",
    /** Space available. Never used decoratively — it always means "you can park". */
    good: "#15803D",
    /** Filling up. */
    warn: "#B45309",
    /** Full, or a refusal. */
    crit: "#B91C1C",

    /**
     * Tinted grounds for the three status hues, so a chip reads as a chip and
     * not as a solid block of alarm. Each is paired with its hue as the text
     * colour, which is where the contrast comes from.
     */
    goodWash: "#E7F5EC",
    warnWash: "#FDF0E3",
    critWash: "#FBEAEA",
    primaryWash: "#EFF5FE",

    /**
     * Occupied is grey rather than red. A full bay is not an error — it is the
     * normal state of most of a car park most of the day, and colouring it red
     * would make every screen look like a failure.
     */
    occupied: "#8494A8",
    occupiedWash: "#EDF1F6",

    /** The fallback map, drawn by us when there is no tile provider. */
    mapGround: "#E7EDF4",
    mapRoad: "#FFFFFF",
    mapRiver: "#B9D5E9",
    mapPark: "#D6E5D1",
  },

  space: (n: number) => n * 8,
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },

  text: {
    /** A fare, and nothing else. The largest thing on any screen it appears on. */
    display: { fontSize: 40, fontWeight: "700" as const, letterSpacing: -1 },
    /** A screen's own name, on the screens that have no navigation bar. */
    h1: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.4 },
    title: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.2 },
    body: { fontSize: 15, fontWeight: "500" as const },
    /** Explanatory prose under a heading. Muted, never a value. */
    sub: { fontSize: 14.5, fontWeight: "400" as const },
    label: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.7 },
    small: { fontSize: 13, fontWeight: "500" as const },
  },

  /**
   * Nothing tappable is smaller than this.
   *
   * The mockup drew its secondary buttons at 46pt; they are 48 here. A citizen
   * is not wearing gloves, but they are frequently tapping one-handed while
   * walking back to a car, and 48 is the floor everywhere in this platform.
   */
  minTouch: 48,
};
