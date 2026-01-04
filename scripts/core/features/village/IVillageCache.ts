import type { Vector3 } from "@minecraft/server";

/**
 * Represents a village discovered by the player
 * Persisted across server restarts using DynamicProperties
 */
export interface CachedVillage {
  /** Unique identifier for this village (e.g., "village_100_200") */
  key: string;

  /** Village center location */
  location: Vector3;

  /** Timestamp when village was discovered (Date.now()) */
  discoveredAt: number;

  /** How the village was discovered */
  discoveryMethod: "command" | "entity";

  /** Player ID who last conquered this village (for tracking) */
  lastConqueredBy?: string;

  /** Total number of times this village has been conquered by any player */
  conquestCount: number;
}

/**
 * Service for persistent village storage using DynamicProperties
 * Single source of truth for all discovered villages
 *
 * Responsibilities:
 * - Store discovered village locations persistently
 * - Cluster nearby villagers as same village (100-block radius)
 * - Track discovery metadata and conquest history
 * - Provide village lookup by location or key
 *
 * Follows Single Responsibility Principle - only handles village caching
 */
export interface IVillageCache {
  /**
   * Initialize the cache by loading from DynamicProperties
   * Must be called after world is initialized (not during construction)
   */
  initialize(): void;

  /**
   * Add a newly discovered village to the cache
   * Uses clustering to avoid duplicate entries for nearby villagers
   *
   * @param location - Village center location
   * @param discoveryMethod - How the village was discovered ("command" or "entity")
   * @returns True if village was added, false if already exists (within clustering radius)
   */
  addVillage(location: Vector3, discoveryMethod: "command" | "entity"): boolean;

  /**
   * Get all discovered villages
   * @returns Array of all cached villages
   */
  getDiscoveredVillages(): CachedVillage[];

  /**
   * Get a specific village by its key
   * @param key - Village key (e.g., "village_100_200")
   * @returns Cached village or null if not found
   */
  getVillageByKey(key: string): CachedVillage | null;

  /**
   * Check if a location has already been discovered
   * Uses clustering radius to check for nearby villages
   *
   * @param location - Location to check
   * @returns True if a village exists within clustering radius
   */
  hasDiscovered(location: Vector3): boolean;

  /**
   * Update conquest information for a village
   * Called when a player conquers a village
   *
   * @param villageKey - Village identifier
   * @param playerId - Player who conquered the village
   */
  recordConquest(villageKey: string, playerId: string): void;

  /**
   * Clear all cached villages
   * Used for testing and world resets
   */
  clear(): void;
}
