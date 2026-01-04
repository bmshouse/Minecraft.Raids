import type { Player, Entity, RawMessage } from "@minecraft/server";

/**
 * Data structure for pocketed (stored) units
 */
export interface PocketedUnitData {
  entityId: string;
  specializationEvent?: string; // For wolves (Guard/Tank/DPS)
  currentHP: number;
  maxHP: number;
  displayName: string;
  wolfKillCount?: number; // For preserving wolf progression levels
}

/**
 * Result of pocketing a unit
 */
export interface PocketResult {
  success: boolean;
  message: RawMessage;
}

/**
 * Result of releasing a unit
 */
export interface ReleaseResult {
  success: boolean;
  message: RawMessage;
  entity?: Entity; // The spawned entity if successful
}

/**
 * Result of bulk operations (pocket all / release all)
 */
export interface BulkOperationResult {
  success: boolean;
  count: number;
  message: RawMessage;
}

/**
 * Service for managing unit pocket/release functionality
 * Allows despawning units to save resources while preserving their state
 */
export interface IUnitPocketService {
  /**
   * Despawn unit and store its state in dynamic properties
   * @param player - Owner of the unit
   * @param entity - The unit to pocket
   * @returns Result with success status and message
   */
  pocketUnit(player: Player, entity: Entity): PocketResult;

  /**
   * Restore a pocketed unit from storage and spawn it near player
   * @param player - Owner of the unit
   * @param index - Index in the pocketed units array
   * @returns Result with success status, message, and spawned entity
   */
  releaseUnit(player: Player, index: number): ReleaseResult;

  /**
   * Pocket all active units at once
   * @param player - The player
   * @returns Result with count of pocketed units
   */
  pocketAllUnits(player: Player): BulkOperationResult;

  /**
   * Release all pocketed units at once
   * @param player - The player
   * @returns Result with count of released units
   */
  releaseAllUnits(player: Player): BulkOperationResult;

  /**
   * Get all active (spawned) units for a player
   * @param player - The player
   * @returns Array of spawned entities
   */
  getActiveUnits(player: Player): Entity[];

  /**
   * Get all pocketed (stored) units for a player
   * @param player - The player
   * @returns Array of pocketed unit data
   */
  getPocketedUnits(player: Player): PocketedUnitData[];

  /**
   * Get total count of units (active + pocketed)
   * @param player - The player
   * @returns Total unit count
   */
  getTotalUnitCount(player: Player): number;

  /**
   * Remove a pocketed unit without spawning it (for selling)
   * @param player - The player
   * @param index - Index in the pocketed units array
   * @returns True if removed successfully
   */
  removePocketedUnit(player: Player, index: number): boolean;
}
