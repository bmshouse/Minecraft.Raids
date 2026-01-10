import { Entity, Player, RawMessage } from "@minecraft/server";
import { UnitDefinition } from "./UnitDefinitions";

/**
 * Result of a recruitment operation.
 */
export interface RecruitmentResult {
  success: boolean;
  message: RawMessage;
  entity?: Entity;
}

/**
 * Service for recruiting and managing raid units.
 */
export interface IRecruitmentService {
  /**
   * Recruit a unit for a player.
   * @param player The player recruiting the unit.
   * @param unitDef The unit definition to recruit.
   * @returns The result of the recruitment operation.
   */
  recruitUnit(player: Player, unitDef: UnitDefinition): RecruitmentResult;

  /**
   * Sell a unit and refund resources to the player (50% of purchase cost).
   * @param player The player selling the unit.
   * @param entity The entity to sell.
   * @returns The result of the sell operation.
   */
  sellUnit(player: Player, entity: Entity): RecruitmentResult;

  /**
   * Get all units owned by a player.
   * @param player The player to get units for.
   * @returns An array of entities owned by the player.
   */
  getPlayerUnits(player: Player): Entity[];

  /**
   * Check if a player owns a specific entity.
   * @param player The player to check.
   * @param entity The entity to check ownership of.
   * @returns True if the player owns the entity, false otherwise.
   */
  isPlayerUnit(player: Player, entity: Entity): boolean;
}
