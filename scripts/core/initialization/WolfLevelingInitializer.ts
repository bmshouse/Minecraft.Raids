import {
  world,
  EntityDieAfterEvent,
  EntityComponentTypes,
  EntityTameableComponent,
} from "@minecraft/server";
import type { IInitializer } from "./IInitializer";
import type { IWolfLevelingService } from "../features/IWolfLevelingService";

/**
 * Initializes the wolf leveling system
 * Follows Single Responsibility Principle - only handles initialization
 * Follows Dependency Injection - receives WolfLevelingService through constructor
 */
export class WolfLevelingInitializer implements IInitializer {
  constructor(private readonly wolfLevelingService: IWolfLevelingService) {}

  /**
   * Subscribes to entity death events to track wolf kills
   */
  public initialize(): void {
    world.afterEvents.entityDie.subscribe(this.onEntityDie.bind(this));
  }

  /**
   * Handles entity death events
   * Checks if killer was a tamed wolf and victim was a hostile mob
   */
  private onEntityDie(event: EntityDieAfterEvent): void {
    const victim = event.deadEntity;
    const killer = event.damageSource.damagingEntity;

    // Validate killer is a tamed wolf
    if (!killer || killer.typeId !== "minecraft:wolf") {
      return;
    }

    const tameable = killer.getComponent(EntityComponentTypes.Tameable) as
      | EntityTameableComponent
      | undefined;
    if (!tameable?.isTamed) {
      return; // Only tamed wolves earn XP
    }

    // Validate victim is a hostile mob
    if (!this.wolfLevelingService.isValidHostileMob(victim)) {
      return;
    }

    // Increment kill count and check for level-up
    const leveledUp = this.wolfLevelingService.incrementKillCount(killer);

    if (leveledUp) {
      // Level-up notification already sent by service
      console.warn(`[WolfLeveling] Wolf ${killer.id} leveled up after killing ${victim.typeId}`);
    }
  }
}
