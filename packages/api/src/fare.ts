import type { CachedHoliday, CachedTariff, Paise, QuoteLine, SlotType } from "./types";

/**
 * A provisional fare, worked out on the handset when there is no signal.
 *
 * This is **not** a second pricing engine competing with the server's. The
 * server re-prices every session on sync and its answer is the one that stands;
 * this exists so an attendant with a driver in front of them and no bars can
 * say a number out loud instead of "I cannot tell you".
 *
 * It is a faithful copy of `quote.service.ts` for everything a cached tariff can
 * answer — grace, base, increment blocks, rules, daily cap, overstay, tax — and
 * it is honest about the three things it cannot know offline:
 *
 *   • a monthly pass that would waive the charge
 *   • a discount code or campaign
 *   • a tariff published after this cache was taken
 *
 * All three can only make the real fare *lower*, never higher. That asymmetry is
 * deliberate: a provisional figure that over-collects is refundable, whereas one
 * that under-collects means chasing a driver who has already gone.
 */

export interface ProvisionalQuote {
  provisional: true;
  tariffName: string;
  durationMinutes: number;
  chargeableMinutes: number;
  gracePeriodMin: number;
  lines: QuoteLine[];
  grossAmount: Paise;
  penaltyAmount: Paise;
  taxAmount: Paise;
  taxPercent: number;
  payableAmount: Paise;
  cappedByDailyLimit: boolean;
  /** What this estimate could not check. Shown to the attendant, verbatim. */
  assumptions: string[];
  /** When the tariff behind this was last fetched. */
  tariffFetchedAt: string;
}

export interface EstimateInput {
  tariff: CachedTariff;
  startAt: Date;
  endAt: Date;
  zoneId: string;
  holidays?: CachedHoliday[];
  overstayAfterMinutes?: number;
}

const addPaise = (...amounts: Paise[]): Paise =>
  amounts.reduce((sum, a) => sum + Math.round(a), 0);

const applyPercent = (amount: Paise, percent: number): Paise =>
  Math.round((amount * percent) / 100);

type DayType = "ALL" | "WEEKDAY" | "WEEKEND" | "HOLIDAY";

function dayTypeFor(at: Date, isHoliday: boolean): DayType {
  if (isHoliday) return "HOLIDAY";
  const day = at.getUTCDay();
  return day === 0 || day === 6 ? "WEEKEND" : "WEEKDAY";
}

function hhmmToMinutes(value: string): number {
  const [h = 0, m = 0] = value.split(":").map(Number);
  return h * 60 + m;
}

/** Handles windows that wrap past midnight, such as a 22:00–06:00 night rate. */
function withinWindow(at: Date, from: string, to: string): boolean {
  const minutes = at.getUTCHours() * 60 + at.getUTCMinutes();
  const start = hhmmToMinutes(from);
  const end = hhmmToMinutes(to);
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

function findHoliday(at: Date, zoneId: string, holidays: CachedHoliday[]): CachedHoliday | null {
  const day = at.toISOString().slice(0, 10);
  return (
    holidays.find(
      (h) =>
        h.date.slice(0, 10) === day && (h.zoneIds.length === 0 || h.zoneIds.includes(zoneId)),
    ) ?? null
  );
}

export function estimateFare(input: EstimateInput): ProvisionalQuote {
  const { tariff, startAt, endAt, zoneId } = input;
  const holidays = input.holidays ?? [];

  const assumptions = [
    "No monthly pass has been checked — a pass holder will be refunded on sync.",
    "No discount has been applied.",
  ];
  if (holidays.length === 0) {
    assumptions.push("The holiday calendar was not available, so holiday rates may be missing.");
  }

  const durationMinutes = Math.max(0, Math.ceil((endAt.getTime() - startAt.getTime()) / 60_000));
  const chargeableMinutes = Math.max(0, durationMinutes - tariff.gracePeriodMin);
  const taxPercent = Number(tariff.taxPercent);

  if (chargeableMinutes === 0) {
    return {
      provisional: true,
      tariffName: tariff.name,
      durationMinutes,
      chargeableMinutes: 0,
      gracePeriodMin: tariff.gracePeriodMin,
      lines: [{ code: "WITHIN_GRACE", label: "Within the grace period", amount: 0 }],
      grossAmount: 0,
      penaltyAmount: 0,
      taxAmount: 0,
      taxPercent,
      payableAmount: 0,
      cappedByDailyLimit: false,
      assumptions,
      tariffFetchedAt: tariff.fetchedAt,
    };
  }

  const lines: QuoteLine[] = [
    {
      code: "BASE",
      label: `Base rate — first ${tariff.baseMinutes} minutes`,
      amount: tariff.baseAmount,
    },
  ];

  const extraMinutes = Math.max(0, chargeableMinutes - tariff.baseMinutes);
  const blocks = Math.ceil(extraMinutes / tariff.incrementMinutes);
  if (blocks > 0) {
    lines.push({
      code: "INCREMENT",
      label: `${blocks} × ${tariff.incrementMinutes} minute block`,
      amount: blocks * tariff.incrementAmount,
    });
  }

  let subtotal = addPaise(...lines.map((l) => l.amount));

  // Rules, in the server's order: highest priority first, compounding.
  const holiday = findHoliday(startAt, zoneId, holidays);
  const dayType = dayTypeFor(startAt, Boolean(holiday));

  const applicable = (tariff.rules ?? [])
    .filter((rule) => {
      if (!rule.isActive) return false;
      if (rule.dayType !== "ALL" && rule.dayType !== dayType) return false;
      if (rule.type === "HOLIDAY" && !holiday) return false;
      if (rule.timeFrom && rule.timeTo && !withinWindow(startAt, rule.timeFrom, rule.timeTo)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.priority - a.priority);

  for (const rule of applicable) {
    if (rule.flatAmount) {
      lines.push({ code: `RULE_${rule.type}`, label: rule.label, amount: rule.flatAmount });
      subtotal += rule.flatAmount;
      continue;
    }
    if (rule.multiplier) {
      const multiplier = Number(rule.multiplier);
      const delta = Math.round(subtotal * multiplier) - subtotal;
      if (delta !== 0) {
        lines.push({ code: `RULE_${rule.type}`, label: rule.label, amount: delta });
        subtotal += delta;
      }
    }
  }

  let cappedByDailyLimit = false;
  if (tariff.dailyCapAmount !== null && tariff.dailyCapAmount !== undefined && subtotal > tariff.dailyCapAmount) {
    lines.push({
      code: "DAILY_CAP",
      label: "Daily maximum applied",
      amount: tariff.dailyCapAmount - subtotal,
    });
    subtotal = tariff.dailyCapAmount;
    cappedByDailyLimit = true;
  }

  let penaltyAmount = 0;
  const overstayAfter = input.overstayAfterMinutes;
  if (overstayAfter && durationMinutes > overstayAfter && tariff.overstayPenalty) {
    penaltyAmount = tariff.overstayPenalty;
    lines.push({ code: "OVERSTAY", label: "Overstay penalty", amount: penaltyAmount });
    subtotal += penaltyAmount;
  }

  const grossAmount = Math.max(0, subtotal);
  const taxAmount = applyPercent(grossAmount, taxPercent);

  return {
    provisional: true,
    tariffName: tariff.name,
    durationMinutes,
    chargeableMinutes,
    gracePeriodMin: tariff.gracePeriodMin,
    lines,
    grossAmount,
    penaltyAmount,
    taxAmount,
    taxPercent,
    payableAmount: grossAmount + taxAmount,
    cappedByDailyLimit,
    assumptions,
    tariffFetchedAt: tariff.fetchedAt,
  };
}
