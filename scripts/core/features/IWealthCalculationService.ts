import type { Player } from "@minecraft/server";

/**
 * Represents a player's wealth breakdown
 */
export interface PlayerWealthData {
  /** Player's name */
  playerName: string;
  /** Unspent emeralds in player's inventory */
  unspentEmeralds: number;
  /** Total sell value of active (deployed) units */
  activeUnitsValue: number;
  /** Total sell value of pocketed (stored) units */
  pocketedUnitsValue: number;
  /** Total wealth (sum of all values) */
  totalWealth: number;
}

/**
 * Service for calculating player wealth including emeralds and unit values
 */
export interface IWealthCalculationService {
  /**
   * Calculate total wealth for a single player
   * @param player - The player to calculate wealth for
   * @returns Wealth breakdown for the player
   */
  calculatePlayerWealth(player: Player): PlayerWealthData;

  /**
   * Calculate wealth for all online players
   * @returns Array of player wealth data, sorted by total wealth (descending)
   */
  calculateAllPlayerWealth(): PlayerWealthData[];
}
