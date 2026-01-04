import type { Player } from "@minecraft/server";
import type { CachedVillage } from "./IVillageCache";
import type { DefenseTier } from "./DefenseConfiguration";

/**
 * Service for calculating village difficulty based on player progression
 *
 * Replaces distance-based difficulty with progression-based scaling
 * that considers player power and conquest history
 *
 * Follows Single Responsibility Principle - only calculates difficulty
 */
export interface IVillageDifficultyCalculator {
  /**
   * Calculate difficulty tier for a village based on player progression
   *
   * @param player - Player approaching the village
   * @param village - Village to calculate difficulty for
   * @returns Appropriate defense tier for this player/village combination
   */
  calculateDifficulty(player: Player, village: CachedVillage): DefenseTier;

  /**
   * Get recommended villages for player's current power level
   * Sorted by suitability (easiest/closest first)
   *
   * @param player - Player to get recommendations for
   * @param allVillages - All discovered villages
   * @returns Villages sorted by recommended difficulty
   */
  getSuggestedVillages(player: Player, allVillages: CachedVillage[]): CachedVillage[];
}
