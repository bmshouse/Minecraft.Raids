import type { Player, Vector3 } from "@minecraft/server";
import { VillageDifficulty, PlayerPower } from "../../GameConstants";
import type { IVillageDifficultyCalculator } from "./IVillageDifficultyCalculator";
import type { CachedVillage, IVillageCache } from "./IVillageCache";
import type { IPlayerPowerCalculator } from "../scaling/IPlayerPowerCalculator";
import { DefenseTier } from "./DefenseConfiguration";

/**
 * Calculates village difficulty based on player progression
 *
 * Replaces distance-based difficulty with a smarter system that scales with:
 * - Player conquest count (how many villages they've conquered)
 * - Player power level (equipment + raid party size)
 *
 * Design Philosophy:
 * - Early villages are accessible (helps beginners)
 * - Difficulty increases as player conquers more villages
 * - Player power can accelerate tier progression
 * - Prevents overwhelming new players with hard villages
 *
 * Algorithm:
 * 1. Base tier from conquest count (0-2 = None, 3-7 = Light, 8-14 = Medium, 15+ = Heavy)
 * 2. Adjust based on player power (Expert players get +1 tier boost)
 * 3. Never reduce difficulty (only increase)
 *
 * Follows Single Responsibility Principle - only calculates difficulty
 */
export class ProgressionBasedDifficultyCalculator implements IVillageDifficultyCalculator {
  // Conquest count thresholds for base tiers
  private readonly TIER_0_MAX = VillageDifficulty.TIER_0_MAX_CONQUESTS;
  private readonly TIER_1_MAX = VillageDifficulty.TIER_1_MAX_CONQUESTS;
  private readonly TIER_2_MAX = VillageDifficulty.TIER_2_MAX_CONQUESTS;
  // 15+: Heavy defense

  // Power level thresholds for tier boosts
  private readonly EXPERT_POWER = PlayerPower.EXPERT_POWER_THRESHOLD;
  private readonly ADVANCED_POWER = PlayerPower.ADVANCED_POWER_THRESHOLD;
  private readonly ADVANCED_EXPERIENCE_THRESHOLD = PlayerPower.ADVANCED_EXPERIENCE_THRESHOLD;

  constructor(
    private readonly playerPowerCalculator: IPlayerPowerCalculator,
    private readonly villageCache: IVillageCache
  ) {}

  /**
   * Calculate difficulty for a village based on player progression
   */
  public calculateDifficulty(player: Player, _village: CachedVillage): DefenseTier {
    const conquestCount = this.getPlayerConquestCount(player);
    const powerLevel = this.playerPowerCalculator.calculatePowerLevel(player);

    // Base difficulty from conquest progression
    let baseTier: DefenseTier;
    if (conquestCount <= this.TIER_0_MAX) {
      baseTier = DefenseTier.None; // First 3 villages
    } else if (conquestCount <= this.TIER_1_MAX) {
      baseTier = DefenseTier.Light; // Villages 4-8
    } else if (conquestCount <= this.TIER_2_MAX) {
      baseTier = DefenseTier.Medium; // Villages 9-15
    } else {
      baseTier = DefenseTier.Heavy; // 15+ villages
    }

    // Adjust based on player power
    const powerScore = powerLevel.totalScore; // 0.0 to 1.0

    if (powerScore >= this.EXPERT_POWER && baseTier < DefenseTier.Heavy) {
      // Expert player - increase difficulty by 1 tier
      return (baseTier + 1) as DefenseTier;
    } else if (
      powerScore >= this.ADVANCED_POWER &&
      baseTier < DefenseTier.Medium &&
      conquestCount >= this.ADVANCED_EXPERIENCE_THRESHOLD
    ) {
      // Advanced player with some experience - slight increase
      return (baseTier + 1) as DefenseTier;
    }

    return baseTier;
  }

  /**
   * Get recommended villages for player's current power level
   * Returns villages sorted by suitability (easiest/closest first)
   */
  public getSuggestedVillages(player: Player, allVillages: CachedVillage[]): CachedVillage[] {
    // Calculate difficulty and distance for each village
    const villagesWithMetrics = allVillages.map((v) => ({
      village: v,
      difficulty: this.calculateDifficulty(player, v),
      distance: this.calculateDistance(player.location, v.location),
    }));

    // Sort by: difficulty (ascending), then distance (ascending)
    villagesWithMetrics.sort((a, b) => {
      if (a.difficulty !== b.difficulty) {
        return a.difficulty - b.difficulty; // Easier first
      }
      return a.distance - b.distance; // Closer first
    });

    return villagesWithMetrics.map((v) => v.village);
  }

  /**
   * Get total number of villages conquered by player
   */
  private getPlayerConquestCount(player: Player): number {
    const allVillages = this.villageCache.getDiscoveredVillages();
    return allVillages.filter((v) => v.lastConqueredBy === player.id).length;
  }

  /**
   * Calculate 2D distance between player and village
   */
  private calculateDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
