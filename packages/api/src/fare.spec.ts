import { describe, expect, it } from "vitest";

import { estimateFare } from "./fare";
import type { CachedTariff } from "./types";

/**
 * The provisional fare.
 *
 * These cases mirror `quote.service.ts` deliberately. If the server's engine
 * changes and this does not, an attendant will quote one number at the kerb and
 * the citizen will be charged another — so a failure here is a signal that the
 * two have drifted, not merely that a test is stale.
 *
 * The property that matters most is the last block: this estimate must never
 * come in *under* the server's price. Over-collecting is refundable; under-
 * collecting means chasing a driver who has already gone.
 */

const TARIFF: CachedTariff = {
  id: "trf_1",
  name: "Park Street — Car",
  zoneId: "zn_1",
  vehicleType: "CAR",
  baseAmount: 2000, // ₹20 for the first 30 minutes
  baseMinutes: 30,
  incrementAmount: 1000, // ₹10 per 15 minutes after that
  incrementMinutes: 15,
  dailyCapAmount: null,
  gracePeriodMin: 10,
  overstayPenalty: 5000,
  taxPercent: 18,
  rules: [],
  fetchedAt: "2026-08-09T06:00:00.000Z",
};

/** A Tuesday, mid-morning — a plain weekday with no rules in play. */
const START = new Date("2026-08-11T04:30:00.000Z");
const after = (minutes: number) => new Date(START.getTime() + minutes * 60_000);

const quote = (minutes: number, tariff: CachedTariff = TARIFF, overstayAfterMinutes?: number) =>
  estimateFare({
    tariff,
    startAt: START,
    endAt: after(minutes),
    zoneId: "zn_1",
    holidays: [],
    overstayAfterMinutes,
  });

describe("the grace period", () => {
  it("charges nothing inside it", () => {
    const q = quote(8);
    expect(q.payableAmount).toBe(0);
    expect(q.chargeableMinutes).toBe(0);
    expect(q.lines[0]?.code).toBe("WITHIN_GRACE");
  });

  it("charges from the first minute past it, not from zero", () => {
    // 35 minutes parked, 10 free → 25 chargeable, inside the 30-minute base.
    const q = quote(35);
    expect(q.chargeableMinutes).toBe(25);
    expect(q.grossAmount).toBe(2000);
  });
});

describe("base and increments", () => {
  it("bills the base alone while inside it", () => {
    expect(quote(40).grossAmount).toBe(2000);
  });

  it("bills whole blocks, rounding a part block up", () => {
    // 46 min − 10 grace = 36 chargeable; 6 past the base → one 15-minute block.
    const q = quote(46);
    expect(q.grossAmount).toBe(3000);
    expect(q.lines.find((l) => l.code === "INCREMENT")?.label).toContain("1 × 15");
  });

  it("bills several blocks", () => {
    // 100 − 10 = 90 chargeable; 60 past the base → four blocks.
    expect(quote(100).grossAmount).toBe(2000 + 4 * 1000);
  });
});

describe("tax", () => {
  it("is applied to the gross, and the payable is the sum of the two", () => {
    const q = quote(40);
    expect(q.grossAmount).toBe(2000);
    expect(q.taxAmount).toBe(360);
    expect(q.payableAmount).toBe(2360);
  });

  it("rounds to whole paise, never a fraction", () => {
    const q = quote(46);
    expect(Number.isInteger(q.taxAmount)).toBe(true);
    expect(Number.isInteger(q.payableAmount)).toBe(true);
  });
});

describe("the daily cap", () => {
  it("stops the total climbing past it", () => {
    const capped: CachedTariff = { ...TARIFF, dailyCapAmount: 8000 };
    const q = quote(600, capped);
    expect(q.grossAmount).toBe(8000);
    expect(q.cappedByDailyLimit).toBe(true);
  });

  it("does not apply when the fare never reaches it", () => {
    const capped: CachedTariff = { ...TARIFF, dailyCapAmount: 8000 };
    expect(quote(40, capped).cappedByDailyLimit).toBe(false);
  });
});

describe("the overstay penalty", () => {
  it("is added once the stay passes the threshold", () => {
    const q = quote(200, TARIFF, 120);
    expect(q.penaltyAmount).toBe(5000);
    expect(q.lines.some((l) => l.code === "OVERSTAY")).toBe(true);
  });

  it("is not added below it", () => {
    expect(quote(100, TARIFF, 120).penaltyAmount).toBe(0);
  });
});

describe("rules", () => {
  it("applies a flat surcharge inside its time window", () => {
    const withNight: CachedTariff = {
      ...TARIFF,
      rules: [
        {
          type: "NIGHT",
          label: "Night surcharge",
          dayType: "ALL",
          timeFrom: "04:00",
          timeTo: "06:00",
          flatAmount: 1500,
          multiplier: null,
          priority: 10,
          isActive: true,
        },
      ],
    };
    // START is 04:30 UTC, inside the window.
    expect(quote(40, withNight).grossAmount).toBe(3500);
  });

  it("ignores a rule whose window has passed", () => {
    const withNight: CachedTariff = {
      ...TARIFF,
      rules: [
        {
          type: "NIGHT",
          label: "Night surcharge",
          dayType: "ALL",
          timeFrom: "22:00",
          timeTo: "23:00",
          flatAmount: 1500,
          multiplier: null,
          priority: 10,
          isActive: true,
        },
      ],
    };
    expect(quote(40, withNight).grossAmount).toBe(2000);
  });

  it("ignores an inactive rule", () => {
    const withInactive: CachedTariff = {
      ...TARIFF,
      rules: [
        {
          type: "PEAK_HOUR",
          label: "Peak",
          dayType: "ALL",
          timeFrom: null,
          timeTo: null,
          flatAmount: 5000,
          multiplier: null,
          priority: 10,
          isActive: false,
        },
      ],
    };
    expect(quote(40, withInactive).grossAmount).toBe(2000);
  });

  it("applies a multiplier as a delta on the running subtotal", () => {
    const withPeak: CachedTariff = {
      ...TARIFF,
      rules: [
        {
          type: "PEAK_HOUR",
          label: "Peak hour",
          dayType: "ALL",
          timeFrom: null,
          timeTo: null,
          flatAmount: null,
          multiplier: 1.5,
          priority: 10,
          isActive: true,
        },
      ],
    };
    expect(quote(40, withPeak).grossAmount).toBe(3000);
  });

  it("skips a weekday rule at the weekend", () => {
    const weekdayOnly: CachedTariff = {
      ...TARIFF,
      rules: [
        {
          type: "COMMERCIAL",
          label: "Weekday levy",
          dayType: "WEEKDAY",
          timeFrom: null,
          timeTo: null,
          flatAmount: 1000,
          multiplier: null,
          priority: 5,
          isActive: true,
        },
      ],
    };
    const saturday = new Date("2026-08-15T04:30:00.000Z");
    const q = estimateFare({
      tariff: weekdayOnly,
      startAt: saturday,
      endAt: new Date(saturday.getTime() + 40 * 60_000),
      zoneId: "zn_1",
      holidays: [],
    });
    expect(q.grossAmount).toBe(2000);
  });
});

describe("honesty about what it cannot know", () => {
  it("always says a pass was not checked", () => {
    expect(quote(40).assumptions.join(" ")).toContain("pass");
  });

  it("always says no discount was applied", () => {
    expect(quote(40).assumptions.join(" ")).toContain("discount");
  });

  it("says so when the holiday calendar was missing", () => {
    const q = estimateFare({
      tariff: TARIFF,
      startAt: START,
      endAt: after(40),
      zoneId: "zn_1",
      holidays: [],
    });
    expect(q.assumptions.join(" ")).toContain("holiday");
  });

  it("carries the age of the rate card it used", () => {
    expect(quote(40).tariffFetchedAt).toBe(TARIFF.fetchedAt);
  });

  it("is flagged provisional, so no screen can present it as final", () => {
    expect(quote(40).provisional).toBe(true);
  });
});

describe("never quotes under the server", () => {
  /**
   * The three things this estimate cannot see — a pass, a discount, a newer and
   * cheaper tariff — can only reduce the real fare. So for identical inputs the
   * estimate is an upper bound, and the difference is always refundable rather
   * than uncollectable.
   */
  it("omits the pass waiver rather than guessing it", () => {
    const q = quote(40);
    expect(q.lines.some((l) => l.code === "PASS")).toBe(false);
    expect(q.payableAmount).toBeGreaterThan(0);
  });

  it("omits any discount line", () => {
    expect(quote(40).lines.some((l) => l.code === "DISCOUNT")).toBe(false);
  });
});
