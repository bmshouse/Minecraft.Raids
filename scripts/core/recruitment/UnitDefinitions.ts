import { UnitConstants } from "./UnitConstants";
import { WolfStats, UnitCosts, UnitDescriptions } from "../GameConstants";

/**
 * Definition of a recruitable unit type.
 */
export interface UnitDefinition {
  id: string;
  displayName: string;
  entityId: string;
  cost: number; // Emerald cost only
  specializationEvent?: string; // Optional event to trigger after spawning (for wolf specializations)
  description: string;
}

/**
 * All available unit types that players can recruit.
 */
export class UnitDefinitions {
  /**
   * Wolf (Guard specialization) - Balanced stats.
   */
  static readonly WOLF_GUARD: UnitDefinition = {
    id: "wolf_guard",
    displayName: "Wolf (Guard)",
    entityId: "minecraft:wolf",
    specializationEvent: "minecraftraids:become_guard",
    cost: UnitCosts.WOLF_GUARD,
    description: UnitDescriptions.WOLF_GUARD,
  };

  /**
   * Wolf (Tank specialization) - High health, low damage.
   */
  static readonly WOLF_TANK: UnitDefinition = {
    id: "wolf_tank",
    displayName: "Wolf (Tank)",
    entityId: "minecraft:wolf",
    specializationEvent: "minecraftraids:become_tank",
    cost: UnitCosts.WOLF_TANK,
    description: UnitDescriptions.WOLF_TANK,
  };

  /**
   * Wolf (DPS specialization) - High damage, low health.
   */
  static readonly WOLF_DPS: UnitDefinition = {
    id: "wolf_dps",
    displayName: "Wolf (DPS)",
    entityId: "minecraft:wolf",
    specializationEvent: "minecraftraids:become_dps",
    cost: UnitCosts.WOLF_DPS,
    description: UnitDescriptions.WOLF_DPS,
  };

  /**
   * Pillager - Ranged crossbow unit.
   */
  static readonly PILLAGER: UnitDefinition = {
    id: "pillager",
    displayName: "Pillager",
    entityId: "minecraftraids:village_guard_pillager",
    cost: UnitCosts.PILLAGER,
    description: UnitDescriptions.PILLAGER,
  };

  /**
   * Vindicator - Melee axe unit with high damage.
   */
  static readonly VINDICATOR: UnitDefinition = {
    id: "vindicator",
    displayName: "Vindicator",
    entityId: "minecraftraids:village_guard_vindicator",
    cost: UnitCosts.VINDICATOR,
    description: UnitDescriptions.VINDICATOR,
  };

  /**
   * Iron Golem - High health tank unit.
   */
  static readonly IRON_GOLEM: UnitDefinition = {
    id: "iron_golem",
    displayName: "Iron Golem",
    entityId: "minecraftraids:village_defense_iron_golem",
    cost: UnitCosts.IRON_GOLEM,
    description: UnitDescriptions.IRON_GOLEM,
  };

  /**
   * Get all unit definitions as an array.
   */
  static getAllUnits(): UnitDefinition[] {
    return [
      UnitDefinitions.WOLF_GUARD,
      UnitDefinitions.WOLF_TANK,
      UnitDefinitions.WOLF_DPS,
      UnitDefinitions.PILLAGER,
      UnitDefinitions.VINDICATOR,
      UnitDefinitions.IRON_GOLEM,
    ];
  }

  /**
   * Get a unit definition by ID.
   */
  static getUnitById(id: string): UnitDefinition | undefined {
    return UnitDefinitions.getAllUnits().find((unit) => unit.id === id);
  }

  /**
   * Find unit definition by entity ID.
   * @param entityId - The entity type identifier (e.g., "minecraft:wolf")
   * @returns Unit definition or undefined if not found
   */
  static getByEntityId(entityId: string): UnitDefinition | undefined {
    return UnitDefinitions.getAllUnits().find((unit) => unit.entityId === entityId);
  }

  /**
   * Calculate the sell price for a unit (50% of purchase cost).
   */
  static getSellPrice(unit: UnitDefinition): number {
    return Math.floor(unit.cost * UnitConstants.SELL_PRICE_MULTIPLIER);
  }

  /**
   * Identify wolf specialization by checking max health.
   * Wolf specializations share the same entityId but have unique max health values:
   * - Guard: 20 HP
   * - Tank: 30 HP
   * - DPS: 15 HP
   *
   * @param entityId - The entity type identifier
   * @param maxHealth - The entity's max health value
   * @returns The correct wolf unit definition or the first matching non-wolf unit
   */
  static getByEntityIdAndHealth(entityId: string, maxHealth: number): UnitDefinition | undefined {
    // Special case for wolves - identify by max health
    if (entityId === "minecraft:wolf") {
      if (maxHealth === WolfStats.TANK_HP) {
        return UnitDefinitions.WOLF_TANK;
      } else if (maxHealth === WolfStats.DPS_HP) {
        return UnitDefinitions.WOLF_DPS;
      } else {
        // Default to guard (20 HP or unknown)
        return UnitDefinitions.WOLF_GUARD;
      }
    }

    // For non-wolves, use normal entity ID lookup
    return UnitDefinitions.getByEntityId(entityId);
  }
}
