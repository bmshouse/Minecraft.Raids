import { Entity, Player, EntityComponentTypes, EntityTameableComponent } from "@minecraft/server";
import { IRecruitmentService, RecruitmentResult } from "./IRecruitmentService";
import { IResourceService } from "../resources/IResourceService";
import type { IMessageProvider } from "../messaging/IMessageProvider";
import { UnitDefinition, UnitDefinitions } from "./UnitDefinitions";
import { CostFormatter } from "../utils/CostFormatter";
import { UnitConstants } from "./UnitConstants";

/**
 * Service for recruiting and managing raid units.
 */
export class RecruitmentService implements IRecruitmentService {
  constructor(
    private readonly resourceService: IResourceService,
    private readonly messageProvider: IMessageProvider
  ) {}

  /**
   * Get the owner tag for a player.
   */
  private getOwnerTag(player: Player): string {
    return `${UnitConstants.OWNER_TAG_PREFIX}${player.name}`;
  }

  /**
   * Check if a player has enough resources to recruit a unit.
   */
  private canAfford(player: Player, unitDef: UnitDefinition): boolean {
    return this.resourceService.hasEmeralds(player, unitDef.cost);
  }

  /**
   * Deduct the cost of a unit from a player's resources.
   */
  private deductCost(player: Player, unitDef: UnitDefinition): boolean {
    return this.resourceService.removeEmeralds(player, unitDef.cost);
  }

  recruitUnit(player: Player, unitDef: UnitDefinition): RecruitmentResult {
    // Check if player can afford the unit
    if (!this.canAfford(player, unitDef)) {
      const costStr = CostFormatter.formatVerbose(unitDef.cost);
      const message = this.messageProvider.getMessage(
        "mc.raids.recruit.insufficient",
        `Insufficient resources! Need: ${costStr}`
      );
      return {
        success: false,
        message,
      };
    }

    try {
      // Spawn entity near player
      const location = player.location;
      const dimension = player.dimension;

      // Offset spawn position slightly to avoid collision
      const spawnLocation = {
        x: location.x + 2,
        y: location.y,
        z: location.z + 2,
      };

      const entity = dimension.spawnEntity(unitDef.entityId, spawnLocation);

      // Tag entity with owner and raid unit tags
      entity.addTag(this.getOwnerTag(player));
      entity.addTag(UnitConstants.RAID_UNIT_TAG);

      // Tame the entity to the player (required for follow/defend behaviors)
      const tameable = entity.getComponent(EntityComponentTypes.Tameable) as
        | EntityTameableComponent
        | undefined;
      if (tameable) {
        tameable.tame(player);
      }

      // Trigger specialization event if needed (for wolves)
      // NOTE: Component group changes from events are not immediately visible to Script API.
      // Callers should wait 5+ ticks before reading entity components (health, scale, etc.)
      // if they need the updated stats from the specialization event.
      if (unitDef.specializationEvent) {
        entity.triggerEvent(unitDef.specializationEvent);
      }

      // Deduct resources
      if (!this.deductCost(player, unitDef)) {
        // This shouldn't happen since we checked canAfford, but handle it anyway
        entity.remove();
        return {
          success: false,
          message: this.messageProvider.getMessage("mc.raids.recruit.deduct.failed"),
        };
      }

      const successMsg = this.messageProvider.getMessage(
        "mc.raids.recruit.success",
        `Recruited ${unitDef.displayName}!`
      );
      return {
        success: true,
        message: successMsg,
        entity: entity,
      };
    } catch (error) {
      const errorMsg = this.messageProvider.getMessage(
        "mc.raids.recruit.spawn.failed",
        `Failed to spawn unit: ${error}`
      );
      return {
        success: false,
        message: errorMsg,
      };
    }
  }

  sellUnit(player: Player, entity: Entity): RecruitmentResult {
    // Verify ownership
    if (!this.isPlayerUnit(player, entity)) {
      return {
        success: false,
        message: this.messageProvider.getMessage(
          "mc.raids.sell.notowner",
          "You don't own this unit!"
        ),
      };
    }

    // Determine unit type from entity type ID
    const unitDef = this.getUnitDefinitionFromEntity(entity);
    if (!unitDef) {
      return {
        success: false,
        message: this.messageProvider.getMessage("mc.raids.sell.unknown", "Unknown unit type!"),
      };
    }

    // Calculate refund (50% of cost)
    const refund = UnitDefinitions.getSellPrice(unitDef);

    // Refund resources
    this.resourceService.addEmeralds(player, refund);

    // Remove entity
    entity.remove();

    const refundStr = CostFormatter.formatVerbose(refund);
    const successMsg = this.messageProvider.getMessage(
      "mc.raids.sell.success",
      `Sold ${unitDef.displayName} for ${refundStr}!`
    );
    return {
      success: true,
      message: successMsg,
    };
  }

  getPlayerUnits(player: Player): Entity[] {
    const ownerTag = this.getOwnerTag(player);
    const dimension = player.dimension;

    // Get all entities with the raid_unit tag
    const allRaidUnits = dimension.getEntities({
      tags: [UnitConstants.RAID_UNIT_TAG],
    });

    // Filter by ownership
    return allRaidUnits.filter((entity) => entity.hasTag(ownerTag));
  }

  isPlayerUnit(player: Player, entity: Entity): boolean {
    const ownerTag = this.getOwnerTag(player);
    return entity.hasTag(UnitConstants.RAID_UNIT_TAG) && entity.hasTag(ownerTag);
  }

  /**
   * Get the unit definition from an entity based on its type ID.
   */
  private getUnitDefinitionFromEntity(entity: Entity): UnitDefinition | undefined {
    const typeId = entity.typeId;

    // Find matching unit definition
    const allUnits = UnitDefinitions.getAllUnits();
    return allUnits.find((unit) => unit.entityId === typeId);
  }
}
