import type { Dimension, Vector3 } from "@minecraft/server";

/**
 * Service for spawning village guard wolves
 * Responsible for creating village defender wolves at tier-appropriate
 * locations and stat values
 */
export interface IVillageGuardWolfService {
  /**
   * Spawns village guard wolves at a village location based on defense tier
   * @param dimension - The dimension to spawn wolves in
   * @param villageCenter - Center coordinates of the village
   * @param tier - Defense tier (1, 2, or 3) determining wolf count and stats
   * @returns Number of wolves successfully spawned
   */
  spawnGuardWolves(
    dimension: Dimension,
    villageCenter: Vector3,
    tier: number
  ): number;
}
