import { EntityComponentTypes, world, type Player } from "@minecraft/server";
import type { EntityHealthComponent } from "@minecraft/server";
import type { IResourceService } from "../resources/IResourceService";
import type { IRecruitmentService } from "../recruitment/IRecruitmentService";
import type { IUnitPocketService } from "../recruitment/IUnitPocketService";
import { UnitDefinitions } from "../recruitment/UnitDefinitions";
import type { IWealthCalculationService, PlayerWealthData } from "./IWealthCalculationService";
import { WolfStats } from "../GameConstants";

/**
 * Service for calculating player wealth including emeralds and unit values.
 * Follows Single Responsibility Principle - only handles wealth calculation logic.
 */
export class WealthCalculationService implements IWealthCalculationService {
  constructor(
    private readonly resourceService: IResourceService,
    private readonly recruitmentService: IRecruitmentService,
    private readonly unitPocketService: IUnitPocketService
  ) {}

  /**
   * Calculate total wealth for a single player
   */
  public calculatePlayerWealth(player: Player): PlayerWealthData {
    const unspentEmeralds = this.resourceService.getEmeralds(player);
    const activeUnitsValue = this.calculateActiveUnitsValue(player);
    const pocketedUnitsValue = this.calculatePocketedUnitsValue(player);
    const totalWealth = Math.max(0, unspentEmeralds + activeUnitsValue + pocketedUnitsValue);

    return {
      playerName: player.name,
      unspentEmeralds,
      activeUnitsValue,
      pocketedUnitsValue,
      totalWealth,
    };
  }

  /**
   * Calculate wealth for all online players
   * Returns sorted array (descending by totalWealth, alphabetical tiebreaker)
   */
  public calculateAllPlayerWealth(): PlayerWealthData[] {
    const allPlayers = world.getAllPlayers();
    const wealthData = allPlayers.map((p) => this.calculatePlayerWealth(p));

    // Sort by wealth descending, then alphabetically by name
    return wealthData.sort((a, b) => {
      if (b.totalWealth !== a.totalWealth) {
        return b.totalWealth - a.totalWealth;
      }
      return a.playerName.localeCompare(b.playerName);
    });
  }

  /**
   * Calculate the total sell value of a player's active (deployed) units
   */
  private calculateActiveUnitsValue(player: Player): number {
    const activeUnits = this.recruitmentService.getPlayerUnits(player);
    let totalValue = 0;

    for (const entity of activeUnits) {
      const health = entity.getComponent(EntityComponentTypes.Health) as
        | EntityHealthComponent
        | undefined;
      const maxHP = Math.round(health?.defaultValue ?? WolfStats.GUARD_HP);

      // Defensive check: Log if wolf has unexpected HP
      if (entity.typeId === "minecraft:wolf" && !WolfStats.ALL_HP_VALUES.includes(maxHP)) {
        console.warn(
          `[WealthCalculation] Active wolf has unexpected maxHP: ${maxHP}. ` +
            `Expected 15/20/30. Entity may not be fully initialized.`
        );
      }

      const unitDef = UnitDefinitions.getByEntityIdAndHealth(entity.typeId, maxHP);
      if (!unitDef) {
        console.warn(
          `[WealthCalculation] Unknown unit type: ${entity.typeId} with maxHP: ${maxHP}`
        );
        continue;
      }

      const sellPrice = UnitDefinitions.getSellPrice(unitDef);
      totalValue += sellPrice;
    }

    return totalValue;
  }

  /**
   * Calculate the total sell value of a player's pocketed (stored) units
   */
  private calculatePocketedUnitsValue(player: Player): number {
    const pocketedUnits = this.unitPocketService.getPocketedUnits(player);
    let totalValue = 0;

    for (const unit of pocketedUnits) {
      const unitDef = UnitDefinitions.getByEntityIdAndHealth(unit.entityId, unit.maxHP);

      // Defensive check: Log if pocketed wolf has unexpected HP
      if (unit.entityId === "minecraft:wolf" && !WolfStats.ALL_HP_VALUES.includes(unit.maxHP)) {
        console.warn(
          `[WealthCalculation] Pocketed wolf has unexpected maxHP: ${unit.maxHP}. ` +
            `Expected 15/20/30. Unit may have been pocketed before specialization event processed.`
        );
      }

      if (!unitDef) {
        console.warn(
          `[WealthCalculation] Unknown pocketed unit type: ${unit.entityId} with maxHP: ${unit.maxHP}`
        );
        continue;
      }

      const sellPrice = UnitDefinitions.getSellPrice(unitDef);
      totalValue += sellPrice;
    }

    return totalValue;
  }
}
