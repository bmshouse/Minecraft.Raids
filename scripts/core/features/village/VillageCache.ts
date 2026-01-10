import { world, Vector3 } from "@minecraft/server";
import type { IVillageCache, CachedVillage } from "./IVillageCache";
import { DynamicPropertyKeys } from "../../utils/DynamicPropertyKeys";
import { VillageDetection } from "../../GameConstants";

/**
 * Persistent village cache using DynamicProperties
 * Follows the pattern established by ConquestTracker
 *
 * Architecture:
 * - In-memory cache (Map) for fast lookups
 * - Syncs to DynamicProperties for persistence
 * - Dirty flag prevents unnecessary writes
 * - 100-block clustering radius to group nearby villagers
 */
export class VillageCache implements IVillageCache {
  private readonly CLUSTERING_RADIUS = VillageDetection.CLUSTERING_RADIUS;
  private readonly MAX_VILLAGES = VillageDetection.MAX_VILLAGES;

  // In-memory cache for performance
  private cache: Map<string, CachedVillage> = new Map();
  private isDirty = false;

  constructor() {
    // Note: Cannot load dynamic properties here (early execution)
    // Call initialize() after world is ready
  }

  /**
   * Initialize the cache by loading from DynamicProperties
   * Must be called after world is initialized (not in constructor)
   */
  public initialize(): void {
    this.loadFromDynamicProperties();
  }

  /**
   * Add a newly discovered village to the cache
   * Uses clustering to avoid duplicate entries
   */
  public addVillage(location: Vector3, discoveryMethod: "command" | "entity"): boolean {
    // Check for nearby village (clustering)
    const nearbyKey = this.findNearbyVillageKey(location);
    if (nearbyKey) {
      console.log(
        `[VillageCache] Village at (${Math.round(location.x)}, ${Math.round(location.z)}) ` +
          `already exists as ${nearbyKey} (within ${this.CLUSTERING_RADIUS}m)`
      );
      return false; // Already discovered
    }

    // Check max villages limit
    if (this.cache.size >= this.MAX_VILLAGES) {
      console.warn(
        `[VillageCache] Maximum village limit reached (${this.MAX_VILLAGES}). ` +
          `Oldest village will be removed.`
      );
      this.removeOldestVillage();
    }

    // Create new cached village
    const key = this.getLocationKey(location);
    const village: CachedVillage = {
      key,
      location: { x: location.x, y: location.y, z: location.z },
      discoveredAt: Date.now(),
      discoveryMethod,
      conquestCount: 0,
    };

    this.cache.set(key, village);
    this.isDirty = true;
    this.saveToDynamicProperties();

    console.log(
      `[VillageCache] Added village ${key} at (${Math.round(location.x)}, ${Math.round(location.z)}) ` +
        `via ${discoveryMethod} (total: ${this.cache.size})`
    );

    return true;
  }

  /**
   * Get all discovered villages
   */
  public getDiscoveredVillages(): CachedVillage[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get a specific village by its key
   */
  public getVillageByKey(key: string): CachedVillage | null {
    return this.cache.get(key) || null;
  }

  /**
   * Check if a location has already been discovered
   * Uses clustering radius
   */
  public hasDiscovered(location: Vector3): boolean {
    return this.findNearbyVillageKey(location) !== null;
  }

  /**
   * Update conquest information for a village
   */
  public recordConquest(villageKey: string, playerId: string): void {
    const village = this.cache.get(villageKey);
    if (!village) {
      console.warn(`[VillageCache] Cannot record conquest - village ${villageKey} not found`);
      return;
    }

    village.lastConqueredBy = playerId;
    village.conquestCount++;
    this.isDirty = true;
    this.saveToDynamicProperties();

    console.log(
      `[VillageCache] Village ${villageKey} conquered by ${playerId} ` +
        `(total conquests: ${village.conquestCount})`
    );
  }

  /**
   * Clear all cached villages (for testing and world resets)
   */
  public clear(): void {
    this.cache.clear();
    this.isDirty = true;
    this.saveToDynamicProperties();
    console.log("[VillageCache] All villages cleared");
  }

  /**
   * Load villages from DynamicProperties on initialization
   * Follows ConquestTracker.ts pattern (lines 20-35)
   */
  private loadFromDynamicProperties(): void {
    const key = DynamicPropertyKeys.villageCache();
    const data = world.getDynamicProperty(key);

    if (typeof data !== "string") {
      console.log("[VillageCache] No saved villages found - starting fresh");
      return;
    }

    try {
      const villages: CachedVillage[] = JSON.parse(data);

      // Rebuild cache Map from array
      for (const village of villages) {
        this.cache.set(village.key, village);
      }

      console.log(`[VillageCache] Loaded ${this.cache.size} villages from DynamicProperties`);
    } catch (error) {
      console.error(`[VillageCache] Failed to parse village data: ${error}`);
      console.log("[VillageCache] Starting with empty cache");
    }
  }

  /**
   * Save villages to DynamicProperties
   * Only saves when dirty flag is set (performance optimization)
   * Follows ConquestTracker.ts pattern (lines 34-36)
   */
  private saveToDynamicProperties(): void {
    if (!this.isDirty) return;

    const key = DynamicPropertyKeys.villageCache();
    const villages = Array.from(this.cache.values());

    try {
      world.setDynamicProperty(key, JSON.stringify(villages));
      this.isDirty = false;
      console.log(`[VillageCache] Saved ${villages.length} villages to DynamicProperties`);
    } catch (error) {
      console.error(`[VillageCache] Failed to save villages: ${error}`);
    }
  }

  /**
   * Find existing village within clustering radius
   * Follows VillageRaidService.ts pattern (lines 205-218)
   */
  private findNearbyVillageKey(location: Vector3): string | null {
    for (const [key, village] of this.cache) {
      const distance = this.calculateDistance(location, village.location);
      if (distance <= this.CLUSTERING_RADIUS) {
        return key;
      }
    }
    return null;
  }

  /**
   * Create location key for a village
   * Follows VillageRaidService.ts pattern (lines 226-232)
   */
  private getLocationKey(location: Vector3): string {
    const x = Math.round(location.x);
    const z = Math.round(location.z);
    return `village_${x}_${z}`;
  }

  /**
   * Calculate 2D distance between points
   * Follows VillageRaidService.ts pattern (lines 206-210)
   */
  private calculateDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Remove oldest village when max limit reached
   * Prevents DynamicProperty size overflow
   */
  private removeOldestVillage(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, village] of this.cache) {
      if (village.discoveredAt < oldestTimestamp) {
        oldestTimestamp = village.discoveredAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.isDirty = true;
      console.log(`[VillageCache] Removed oldest village ${oldestKey} to make room`);
    }
  }
}
