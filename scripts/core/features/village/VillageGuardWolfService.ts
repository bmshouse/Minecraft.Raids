import { Dimension, Vector3 } from "@minecraft/server";
import type { IVillageGuardWolfService } from "./IVillageGuardWolfService";

/**
 * Service for spawning village guard wolves at appropriate tiers
 * Distributes wolves in a circular pattern around village center
 * and applies tier-specific stats through events
 */
export class VillageGuardWolfService implements IVillageGuardWolfService {
  private readonly ENTITY_TYPE = "minecraftraids:village_guard_wolf";
  private readonly SPAWN_RADIUS = 15; // Distance from village center in blocks

  /**
   * Spawns village guard wolves at a village location
   * Checks if chunks are loaded before spawning to handle unloaded chunk scenarios
   * @param dimension - The dimension to spawn in
   * @param villageCenter - Center of the village
   * @param tier - Defense tier (1-3)
   * @returns Number of wolves successfully spawned
   */
  public spawnGuardWolves(
    dimension: Dimension,
    villageCenter: Vector3,
    tier: number
  ): number {
    const wolfCount = this.getWolfCountForTier(tier);
    const tierEvent = this.getTierEventName(tier);
    let spawnedCount = 0;

    for (let i = 0; i < wolfCount; i++) {
      const spawnPos = this.calculateSpawnPosition(villageCenter, i, wolfCount);

      // Check if chunk is loaded before spawning
      const block = dimension.getBlock(spawnPos);
      if (block !== undefined) {
        const wolf = dimension.spawnEntity(this.ENTITY_TYPE, spawnPos);

        // Set tier-based stats via event
        wolf.triggerEvent(tierEvent);
        spawnedCount++;
      }
    }

    return spawnedCount;
  }

  /**
   * Determines wolf count based on defense tier
   * @param tier - Defense tier (1-3)
   * @returns Number of wolves to spawn (2-3, 4-5, or 6-8)
   */
  private getWolfCountForTier(tier: number): number {
    switch (tier) {
      case 1:
        return Math.floor(Math.random() * 2) + 2; // 2-3 wolves
      case 2:
        return Math.floor(Math.random() * 2) + 4; // 4-5 wolves
      case 3:
        return Math.floor(Math.random() * 3) + 6; // 6-8 wolves
      default:
        return 0;
    }
  }

  /**
   * Gets the tier event name to trigger for stat setting
   * @param tier - Defense tier (1-3)
   * @returns Event name string
   */
  private getTierEventName(tier: number): string {
    return `minecraftraids:set_tier_${tier}`;
  }

  /**
   * Calculates spawn position for a wolf in a circular distribution
   * Spreads wolves around the village center in a circle pattern
   * @param center - Center of the village
   * @param index - Which wolf in the sequence (0-based)
   * @param total - Total number of wolves being spawned
   * @returns Spawn location
   */
  private calculateSpawnPosition(
    center: Vector3,
    index: number,
    total: number
  ): Vector3 {
    // Distribute wolves in a circle around village center
    const angle = (Math.PI * 2 * index) / total;
    const x = center.x + Math.cos(angle) * this.SPAWN_RADIUS;
    const z = center.z + Math.sin(angle) * this.SPAWN_RADIUS;

    return { x, y: center.y, z };
  }
}
