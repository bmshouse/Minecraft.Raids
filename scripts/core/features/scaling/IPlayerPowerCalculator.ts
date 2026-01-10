import type { Player } from "@minecraft/server";

export interface PlayerPowerLevel {
  equipmentScore: number; // 0.0 to 1.0
  partyScore: number; // 0.0 to 1.0
  totalScore: number; // 0.0 to 1.0
  tier: "beginner" | "intermediate" | "advanced" | "expert";
}

export interface IPlayerPowerCalculator {
  /**
   * Calculate player's power level based on equipment and raid party
   * @param player - The player to evaluate
   * @returns Power level breakdown
   */
  calculatePowerLevel(player: Player): PlayerPowerLevel;
}
