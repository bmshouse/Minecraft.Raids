import type { Player, Dimension, Vector3 } from "@minecraft/server";

/**
 * Service for detecting villages in the game world
 *
 * Responsibilities:
 * - Discover villages using various detection methods
 * - Notify players of discoveries
 * - Integrate with VillageCache for persistence
 *
 * Follows Single Responsibility Principle - only handles village detection
 */
export interface IVillageDetectionService {
  /**
   * Detect villages near a player
   *
   * @param player - The player to search around
   * @param dimension - The dimension to search in (typically overworld)
   * @returns Array of discovered village locations (empty if none found)
   */
  detectVillages(player: Player, dimension: Dimension): Promise<Vector3[]>;
}
