import {
  world,
  EntityComponentTypes,
  EntityHealthComponent,
  EntityTameableComponent,
} from "@minecraft/server";
import type { Player, Entity } from "@minecraft/server";
import { WolfStats } from "../GameConstants";
import type {
  IUnitPocketService,
  PocketedUnitData,
  PocketResult,
  ReleaseResult,
  BulkOperationResult,
} from "./IUnitPocketService";
import type { IRecruitmentService } from "./IRecruitmentService";
import type { IMessageProvider } from "../messaging/IMessageProvider";
import type { IWolfLevelingService } from "../features/IWolfLevelingService";
import { DynamicPropertyKeys } from "../utils/DynamicPropertyKeys";
import { UnitDefinitions } from "./UnitDefinitions";
import { UnitConstants } from "./UnitConstants";

/**
 * Service for managing unit pocket/release functionality
 * Allows despawning units to save resources while preserving their state
 */
export class UnitPocketService implements IUnitPocketService {
  constructor(
    private readonly recruitmentService: IRecruitmentService,
    private readonly messageProvider: IMessageProvider,
    private readonly wolfLevelingService: IWolfLevelingService
  ) {}

  /**
   * Pocket a single unit
   */
  public pocketUnit(player: Player, entity: Entity): PocketResult {
    try {
      // Verify ownership
      const ownerTag = `${UnitConstants.OWNER_TAG_PREFIX}${player.name}`;
      if (!entity.hasTag(ownerTag) || !entity.hasTag(UnitConstants.RAID_UNIT_TAG)) {
        return {
          success: false,
          message: this.messageProvider.getMessage(
            "mc.raids.pocket.notowner",
            "You don't own this unit!"
          ),
        };
      }

      // Load existing pocketed units
      const pocketed = this.getPocketedUnits(player);

      // Check capacity
      if (pocketed.length >= UnitConstants.MAX_POCKETED_UNITS) {
        return {
          success: false,
          message: this.messageProvider.getMessage(
            "mc.raids.pocket.full",
            "Unit pocket is full! (75 max)"
          ),
        };
      }

      // Extract entity data
      const health = entity.getComponent(EntityComponentTypes.Health) as
        | EntityHealthComponent
        | undefined;
      const currentHP = Math.round(health?.currentValue ?? 0);
      const maxHP = Math.round(health?.defaultValue ?? WolfStats.GUARD_HP);

      // Get display name using specialization detection
      const unitDef = UnitDefinitions.getByEntityIdAndHealth(entity.typeId, maxHP);

      // Validation: Log warning if wolf health doesn't match known specializations
      if (entity.typeId === "minecraft:wolf" && !WolfStats.ALL_HP_VALUES.includes(maxHP)) {
        console.warn(
          `[UnitPocket] Wolf has unexpected maxHP: ${maxHP}. ` +
            `Expected 15 (DPS), 20 (Guard), or 30 (Tank). ` +
            `This may indicate the specialization event hasn't processed yet. ` +
            `Unit will be identified as: ${unitDef?.displayName ?? "unknown"}`
        );
      }

      const displayName = unitDef?.displayName ?? entity.typeId;

      // Create unit data
      const unitData: PocketedUnitData = {
        entityId: entity.typeId,
        specializationEvent: unitDef?.specializationEvent,
        currentHP,
        maxHP,
        displayName,
      };

      // For wolves, preserve kill count and level
      if (entity.typeId === "minecraft:wolf") {
        const killCount = this.wolfLevelingService.getWolfKillCount(entity.id);
        unitData.wolfKillCount = killCount;
      }

      // Add to pocketed array
      pocketed.push(unitData);

      // Save to dynamic property
      this.savePocketedUnits(player, pocketed);

      // Despawn entity
      entity.remove();

      return {
        success: true,
        message: this.messageProvider.getMessage(
          "mc.raids.pocket.success",
          `Pocketed ${displayName}!`
        ),
      };
    } catch (error) {
      console.error("[UnitPocket] Error pocketing unit:", error);
      return {
        success: false,
        message: this.messageProvider.getMessage(
          "mc.raids.pocket.failed",
          `Failed to pocket unit: ${error}`
        ),
      };
    }
  }

  /**
   * Release a single unit
   */
  public releaseUnit(player: Player, index: number): ReleaseResult {
    try {
      // Load pocketed units
      const pocketed = this.getPocketedUnits(player);

      // Validate index
      if (index < 0 || index >= pocketed.length) {
        return {
          success: false,
          message: this.messageProvider.getMessage(
            "mc.raids.pocket.invalidindex",
            "Invalid unit index!"
          ),
        };
      }

      const unitData = pocketed[index];

      // Spawn entity near player
      const spawnLocation = {
        x: player.location.x + 2,
        y: player.location.y,
        z: player.location.z + 2,
      };

      let entity: Entity;
      try {
        entity = player.dimension.spawnEntity(unitData.entityId, spawnLocation);
      } catch (error) {
        // Chunk not loaded or spawn failed
        return {
          success: false,
          message: this.messageProvider.getMessage(
            "mc.raids.pocket.chunkfail",
            "Chunk not loaded!"
          ),
        };
      }

      // Trigger specialization event (for wolves)
      if (unitData.specializationEvent) {
        entity.triggerEvent(unitData.specializationEvent);
      }

      // Add ownership tags
      const ownerTag = `${UnitConstants.OWNER_TAG_PREFIX}${player.name}`;
      entity.addTag(ownerTag);
      entity.addTag(UnitConstants.RAID_UNIT_TAG);

      // Tame the entity to the player
      const tameable = entity.getComponent(EntityComponentTypes.Tameable) as
        | EntityTameableComponent
        | undefined;
      if (tameable) {
        tameable.tame(player);
      }

      // Restore wolf kill count
      if (unitData.wolfKillCount !== undefined && entity.typeId === "minecraft:wolf") {
        const newKey = DynamicPropertyKeys.wolfKillCount(entity.id);
        world.setDynamicProperty(newKey, unitData.wolfKillCount);
      }

      // Restore health as percentage
      const healthComponent = entity.getComponent(EntityComponentTypes.Health) as
        | EntityHealthComponent
        | undefined;

      if (healthComponent) {
        const hpPercentage = unitData.currentHP / unitData.maxHP;
        const newMaxHP = healthComponent.defaultValue;
        const restoredHP = Math.round(newMaxHP * hpPercentage);
        healthComponent.setCurrentValue(Math.min(restoredHP, newMaxHP));
      }

      // Remove from pocketed array
      pocketed.splice(index, 1);
      this.savePocketedUnits(player, pocketed);

      return {
        success: true,
        message: this.messageProvider.getMessage(
          "mc.raids.pocket.released",
          `Released ${unitData.displayName}!`
        ),
        entity,
      };
    } catch (error) {
      console.error("[UnitPocket] Error releasing unit:", error);
      return {
        success: false,
        message: this.messageProvider.getMessage(
          "mc.raids.pocket.releasefailed",
          `Failed to release: ${error}`
        ),
      };
    }
  }

  /**
   * Pocket all active units
   */
  public pocketAllUnits(player: Player): BulkOperationResult {
    const activeUnits = this.getActiveUnits(player);

    if (activeUnits.length === 0) {
      return {
        success: false,
        count: 0,
        message: this.messageProvider.getMessage(
          "mc.raids.pocket.noactive",
          "No active units to pocket!"
        ),
      };
    }

    let pocketedCount = 0;
    for (const unit of activeUnits) {
      const result = this.pocketUnit(player, unit);
      if (result.success) {
        pocketedCount++;
      }
    }

    return {
      success: pocketedCount > 0,
      count: pocketedCount,
      message: this.messageProvider.getMessage(
        "mc.raids.pocket.allpocketed",
        `Pocketed ${pocketedCount} units!`
      ),
    };
  }

  /**
   * Release all pocketed units
   */
  public releaseAllUnits(player: Player): BulkOperationResult {
    const pocketed = this.getPocketedUnits(player);

    if (pocketed.length === 0) {
      return {
        success: false,
        count: 0,
        message: this.messageProvider.getMessage(
          "mc.raids.pocket.nopocketed",
          "No pocketed units!"
        ),
      };
    }

    let releasedCount = 0;
    // Release in reverse order to maintain indices
    for (let i = pocketed.length - 1; i >= 0; i--) {
      const result = this.releaseUnit(player, i);
      if (result.success) {
        releasedCount++;
      }
    }

    return {
      success: releasedCount > 0,
      count: releasedCount,
      message: this.messageProvider.getMessage(
        "mc.raids.pocket.allreleased",
        `Released ${releasedCount} units!`
      ),
    };
  }

  /**
   * Get all active (spawned) units
   */
  public getActiveUnits(player: Player): Entity[] {
    return this.recruitmentService.getPlayerUnits(player);
  }

  /**
   * Get all pocketed (stored) units
   */
  public getPocketedUnits(player: Player): PocketedUnitData[] {
    const key = DynamicPropertyKeys.pocketedUnits(player.name);
    const value = world.getDynamicProperty(key);

    if (typeof value !== "string") {
      return []; // No pocketed units
    }

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(`[UnitPocket] Failed to parse pocketed units for ${player.name}:`, error);
      return [];
    }
  }

  /**
   * Get total unit count
   */
  public getTotalUnitCount(player: Player): number {
    const active = this.getActiveUnits(player).length;
    const pocketed = this.getPocketedUnits(player).length;
    return active + pocketed;
  }

  /**
   * Remove a pocketed unit without spawning it (for selling)
   */
  public removePocketedUnit(player: Player, index: number): boolean {
    try {
      const pocketed = this.getPocketedUnits(player);

      if (index < 0 || index >= pocketed.length) {
        return false;
      }

      pocketed.splice(index, 1);
      this.savePocketedUnits(player, pocketed);

      return true;
    } catch (error) {
      console.error("[UnitPocket] Error removing pocketed unit:", error);
      return false;
    }
  }

  /**
   * Save pocketed units to dynamic property
   */
  private savePocketedUnits(player: Player, units: PocketedUnitData[]): void {
    const key = DynamicPropertyKeys.pocketedUnits(player.name);
    const json = JSON.stringify(units);

    // Size validation (30KB safety margin)
    if (json.length > 30000) {
      console.warn(
        `[UnitPocket] Pocketed units data too large for ${player.name}: ${json.length} bytes`
      );
      throw new Error("Too many pocketed units!");
    }

    world.setDynamicProperty(key, json);
  }
}
