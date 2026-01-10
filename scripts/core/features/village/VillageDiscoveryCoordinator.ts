import type { Player, Dimension } from "@minecraft/server";
import type { EntityBasedVillageDetector } from "./EntityBasedVillageDetector";
import type { IVillageCache } from "./IVillageCache";
import type { CachedVillage } from "./IVillageCache";

/**
 * Orchestrates all village detection methods
 *
 * Responsibilities:
 * - Coordinates command and entity-based detection
 * - Provides unified interface for village discovery
 * - Manages detection timing and frequency
 *
 * Architecture:
 * - Command detection: Run once at player spawn (fast initial discovery)
 * - Entity detection: Run periodically during exploration (organic discovery)
 *
 * Follows Single Responsibility Principle - only coordinates detection methods
 */
export class VillageDiscoveryCoordinator {
  constructor(
    private readonly entityDetector: EntityBasedVillageDetector,
    private readonly villageCache: IVillageCache
  ) {}

  /**
   * Run command-based detection at player spawn
   * Called once per player on initial spawn
   *
   * NOTE: Currently non-functional due to API limitations.
   * CommandBasedVillageDetector always returns empty array.
   * Kept for future API compatibility.
   *
   * @param player - Player who just spawned
   * @param dimension - Dimension to search (typically overworld)
   */
  public async detectAtSpawn(player: Player, dimension: Dimension): Promise<void> {
    console.log(`[VillageDiscovery] Running spawn detection for ${player.name}...`);

    // Command detection disabled - API limitation: runCommand() doesn't return output text
    // See CommandBasedVillageDetector.ts for details
    // await this.commandDetector.detectVillages(player, dimension);

    // Run entity detection immediately (in case player spawns near a village)
    await this.entityDetector.detectVillages(player, dimension);

    console.log(
      `[VillageDiscovery] Spawn detection complete for ${player.name}. ` +
        `Total discovered: ${this.villageCache.getDiscoveredVillages().length}`
    );
  }

  /**
   * Run entity-based detection periodically
   * Called every 2 seconds by VillageDiscoveryInitializer
   *
   * @param player - Player to scan around
   * @param dimension - Dimension to search
   */
  public async detectNearby(player: Player, dimension: Dimension): Promise<void> {
    // Entity detection is the primary working method
    await this.entityDetector.detectVillages(player, dimension);
  }

  /**
   * Get all discovered villages from cache
   * @returns Array of all cached villages
   */
  public getDiscoveredVillages(): CachedVillage[] {
    return this.villageCache.getDiscoveredVillages();
  }

  /**
   * Get village cache for external access
   * @returns The village cache instance
   */
  public getVillageCache(): IVillageCache {
    return this.villageCache;
  }
}
