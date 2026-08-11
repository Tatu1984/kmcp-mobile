import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CachedHoliday, CachedTariff, CachedZone, SlotType } from "./types";

/**
 * What the handset keeps so it can still work with no signal.
 *
 * Only reference data lives here — zones, tariffs, the holiday calendar and the
 * geo-fence tolerance. Nothing a citizen or an attendant *did* is cached; that
 * belongs to the queue, which has different rules about ordering and retries.
 *
 * The cache is primed when the attendant signs in and again whenever a shift
 * opens, because those are the two moments when a handset is reliably somewhere
 * with signal and about to go somewhere without it.
 */

const KEY = "kmcp.cache.v1";

export interface CacheContents {
  zones: CachedZone[];
  /** Keyed `${zoneId}:${vehicleType}` — one rate card per combination. */
  tariffs: Record<string, CachedTariff>;
  holidays: CachedHoliday[];
  geofenceToleranceM: number;
  primedAt: string | null;
}

const EMPTY: CacheContents = {
  zones: [],
  tariffs: {},
  holidays: [],
  geofenceToleranceM: 25,
  primedAt: null,
};

export const tariffKey = (zoneId: string, vehicleType: SlotType): string =>
  `${zoneId}:${vehicleType}`;

export class OfflineCache {
  private contents: CacheContents = EMPTY;
  private loaded = false;

  async load(): Promise<CacheContents> {
    if (this.loaded) return this.contents;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      this.contents = raw ? { ...EMPTY, ...(JSON.parse(raw) as CacheContents) } : EMPTY;
    } catch {
      // A corrupt cache must not stop the app starting. Working online with an
      // empty cache is a far better failure than not working at all.
      this.contents = EMPTY;
    }
    this.loaded = true;
    return this.contents;
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(this.contents));
    } catch {
      // Out of storage. The in-memory copy still serves this session.
    }
  }

  get(): CacheContents {
    return this.contents;
  }

  /** How old the cached reference data is, in hours. `null` when never primed. */
  ageHours(): number | null {
    if (!this.contents.primedAt) return null;
    return (Date.now() - new Date(this.contents.primedAt).getTime()) / 3_600_000;
  }

  zone(zoneId: string): CachedZone | undefined {
    return this.contents.zones.find((z) => z.id === zoneId);
  }

  tariff(zoneId: string, vehicleType: SlotType): CachedTariff | undefined {
    // A zone-specific rate first, then the city-wide one — the same precedence
    // the server applies when it resolves a tariff for real.
    return (
      this.contents.tariffs[tariffKey(zoneId, vehicleType)] ??
      this.contents.tariffs[tariffKey("*", vehicleType)]
    );
  }

  async putZones(zones: CachedZone[]): Promise<void> {
    await this.load();
    this.contents.zones = zones;
    await this.persist();
  }

  async putTariff(zoneId: string, vehicleType: SlotType, tariff: CachedTariff): Promise<void> {
    await this.load();
    this.contents.tariffs[tariffKey(zoneId, vehicleType)] = tariff;
    await this.persist();
  }

  async putHolidays(holidays: CachedHoliday[]): Promise<void> {
    await this.load();
    this.contents.holidays = holidays;
    await this.persist();
  }

  async putTolerance(metres: number): Promise<void> {
    await this.load();
    this.contents.geofenceToleranceM = metres;
    await this.persist();
  }

  async markPrimed(): Promise<void> {
    await this.load();
    this.contents.primedAt = new Date().toISOString();
    await this.persist();
  }

  async clear(): Promise<void> {
    this.contents = { ...EMPTY, tariffs: {} };
    this.loaded = true;
    await AsyncStorage.removeItem(KEY).catch(() => undefined);
  }
}
