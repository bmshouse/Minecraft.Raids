import type { Player, Vector3 } from "@minecraft/server";

export interface NearestVillageInfo {
  position: Vector3;
  tier: number;
  distance: number;
  villageKey: string;
}

export interface ICompassNavigationService {
  /**
   * Get the nearest unconquered village for a player
   * @param player - The player
   * @returns Village info or null if no unconquered villages nearby
   */
  getNearestUnconqueredVillage(player: Player): NearestVillageInfo | null;

  /**
   * Get compass target for player - selected village or nearest unconquered
   * Validates selected village and falls back to nearest if invalid
   * @param player - The player
   * @returns Village info or null if no valid target
   */
  getCompassTarget(player: Player): NearestVillageInfo | null;

  /**
   * Update player's compass to point to nearest unconquered village
   * Shows action bar message with distance and direction
   * @param player - The player holding the compass
   */
  updateCompass(player: Player): void;
}
