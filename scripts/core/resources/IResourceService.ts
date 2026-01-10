import { Player } from "@minecraft/server";

/**
 * Service for managing player resources (emeralds, iron, gold).
 * Resources are stored as dynamic properties on the world object for persistence.
 */
export interface IResourceService {
  /**
   * Get the amount of emeralds a player has.
   * @param player The player to check.
   * @returns The number of emeralds the player has.
   */
  getEmeralds(player: Player): number;

  /**
   * Add emeralds to a player's inventory.
   * @param player The player to give emeralds to.
   * @param amount The amount of emeralds to add.
   */
  addEmeralds(player: Player, amount: number): void;

  /**
   * Remove emeralds from a player's inventory.
   * @param player The player to remove emeralds from.
   * @param amount The amount of emeralds to remove.
   * @returns True if the player had enough emeralds, false otherwise.
   */
  removeEmeralds(player: Player, amount: number): boolean;

  /**
   * Check if a player has at least the specified amount of emeralds.
   * @param player The player to check.
   * @param amount The amount of emeralds to check for.
   * @returns True if the player has at least the specified amount, false otherwise.
   */
  hasEmeralds(player: Player, amount: number): boolean;
}
