import type { Entity } from "@minecraft/server";

/**
 * Interface for wolf leveling service
 * Follows Interface Segregation Principle - focused on leveling operations only
 */
export interface IWolfLevelingService {
  /**
   * Gets the current level of a wolf
   * @param wolfId - Entity ID of the wolf
   * @returns Level number (1, 2, or 3) or undefined if not a tamed wolf
   */
  getWolfLevel(wolfId: string): number | undefined;

  /**
   * Gets the kill count for a wolf
   * @param wolfId - Entity ID of the wolf
   * @returns Kill count or 0 if no kills tracked
   */
  getWolfKillCount(wolfId: string): number;

  /**
   * Gets the kills required for the next level
   * @param currentLevel - Current wolf level (1, 2, or 3)
   * @returns Kills needed for next level, or 0 if max level
   */
  getKillsForNextLevel(currentLevel: number): number;

  /**
   * Increments kill count for a wolf and checks for level-up
   * @param wolf - The wolf entity
   * @returns true if wolf leveled up
   */
  incrementKillCount(wolf: Entity): boolean;

  /**
   * Validates if an entity is a valid hostile mob target
   * @param entity - The entity to validate
   * @returns true if entity is a hostile mob that counts toward wolf leveling
   */
  isValidHostileMob(entity: Entity): boolean;
}
