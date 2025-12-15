import {
  Entity,
  world,
  EntityComponentTypes,
  EntityTameableComponent,
} from "@minecraft/server";
import type { IWolfLevelingService } from "./IWolfLevelingService";
import type { IMessageProvider } from "../messaging/IMessageProvider";

/**
 * Service for managing wolf leveling progression
 * Follows Single Responsibility Principle - only handles leveling logic
 */
export class WolfLevelingService implements IWolfLevelingService {
  // Dynamic property key pattern: minecraftraids:wolf_{wolfId}_kills
  private readonly KILL_COUNT_PREFIX = "minecraftraids:wolf_";
  private readonly KILL_COUNT_SUFFIX = "_kills";

  // Level thresholds (cumulative kills required)
  private readonly LEVEL_2_THRESHOLD = 5;
  private readonly LEVEL_3_THRESHOLD = 15;

  // Hostile mob families that count toward leveling
  private readonly VALID_HOSTILE_FAMILIES = [
    "zombie",
    "skeleton",
    "creeper",
    "spider",
    "enderman",
    "blaze",
    "witch",
    "pillager",
    "vindicator",
    "evoker",
    "ravager",
    "phantom",
    "drowned",
    "husk",
    "stray",
    "wither_skeleton",
    "hoglin",
    "piglin_brute",
    "silverfish",
    "cave_spider",
    "slime",
    "magma_cube",
    "ghast",
    "wither",
  ];

  constructor(private readonly messageProvider: IMessageProvider) {}

  /**
   * Gets current level based on kill count
   * Level 1: 0-4 kills
   * Level 2: 5-14 kills
   * Level 3: 15+ kills
   */
  public getWolfLevel(wolfId: string): number | undefined {
    const kills = this.getWolfKillCount(wolfId);

    if (kills >= this.LEVEL_3_THRESHOLD) {
      return 3;
    } else if (kills >= this.LEVEL_2_THRESHOLD) {
      return 2;
    } else {
      return 1;
    }
  }

  /**
   * Retrieves kill count from wolf's dynamic properties
   */
  public getWolfKillCount(wolfId: string): number {
    const key = this.buildDynamicPropertyKey(wolfId);
    const value = world.getDynamicProperty(key);

    if (value === undefined || typeof value !== "number") {
      return 0;
    }

    return Math.floor(value); // Ensure integer
  }

  /**
   * Calculates kills needed for next level
   */
  public getKillsForNextLevel(currentLevel: number): number {
    switch (currentLevel) {
      case 1:
        return this.LEVEL_2_THRESHOLD;
      case 2:
        return this.LEVEL_3_THRESHOLD;
      case 3:
      default:
        return 0; // Max level
    }
  }

  /**
   * Increments kill count for a wolf and checks for level-up
   * Returns true if wolf leveled up
   */
  public incrementKillCount(wolf: Entity): boolean {
    const wolfId = wolf.id;
    const currentKills = this.getWolfKillCount(wolfId);
    const newKills = currentKills + 1;
    const previousLevel = this.getWolfLevel(wolfId);

    // Save new kill count
    const key = this.buildDynamicPropertyKey(wolfId);
    world.setDynamicProperty(key, newKills);

    // Check if level-up occurred
    const newLevel = this.getWolfLevel(wolfId);

    if (newLevel !== previousLevel && newLevel !== undefined) {
      this.triggerLevelUp(wolf, newLevel, newKills);
      return true;
    }

    return false;
  }

  /**
   * Triggers the level-up event on the wolf entity
   */
  private triggerLevelUp(
    wolf: Entity,
    newLevel: number,
    totalKills: number
  ): void {
    let eventName: string;

    switch (newLevel) {
      case 2:
        eventName = "minecraftraids:level_up_to_2";
        break;
      case 3:
        eventName = "minecraftraids:level_up_to_3";
        break;
      default:
        console.warn(`[WolfLeveling] Invalid level-up target: ${newLevel}`);
        return;
    }

    try {
      wolf.triggerEvent(eventName);

      // Notify owner if present
      const tameable = wolf.getComponent(
        EntityComponentTypes.Tameable
      ) as EntityTameableComponent | undefined;
      if (tameable?.tamedToPlayer) {
        const owner = tameable.tamedToPlayer;
        const levelUpMessage = this.messageProvider.getMessage(
          "mc.raids.wolf.levelup"
        );
        owner.sendMessage(
          `§6${levelUpMessage} §e${newLevel}§6! (${totalKills} kills)`
        );
      }

      console.warn(
        `[WolfLeveling] Wolf ${wolf.id} leveled up to ${newLevel} with ${totalKills} kills`
      );
    } catch (error) {
      console.error(`[WolfLeveling] Failed to trigger level-up event:`, error);
    }
  }

  /**
   * Builds dynamic property key for a wolf's kill count
   */
  private buildDynamicPropertyKey(wolfId: string): string {
    return `${this.KILL_COUNT_PREFIX}${wolfId}${this.KILL_COUNT_SUFFIX}`;
  }

  /**
   * Validates if an entity is a valid hostile mob target
   * Only kills of these mobs count toward wolf leveling
   */
  public isValidHostileMob(entity: Entity): boolean {
    // Don't count wolf kills
    if (entity.typeId === "minecraft:wolf") {
      return false;
    }

    // Check if entity matches one of the hostile families
    return this.VALID_HOSTILE_FAMILIES.some((family) =>
      entity.matches({ families: [family] })
    );
  }
}
