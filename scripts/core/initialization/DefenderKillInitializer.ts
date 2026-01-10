import { world, EntityComponentTypes, Player, Entity } from "@minecraft/server";
import type { IInitializer } from "./IInitializer";
import type { IDefenderRewardService } from "../features/rewards/IDefenderRewardService";
import type { VillageRaidService } from "../features/village/VillageRaidService";
import { UnitConstants } from "../recruitment/UnitConstants";

/**
 * Initializes per-defender kill reward system
 * Listens for defender deaths and grants immediate rewards
 *
 * Follows Single Responsibility Principle - only handles initialization
 * Follows Dependency Injection - receives services through constructor
 */
export class DefenderKillInitializer implements IInitializer {
  // Defender entity types (match DefenseConfiguration.ts)
  private readonly DEFENDER_TYPES = [
    "minecraftraids:village_defense_iron_golem",
    "minecraftraids:village_guard_wolf",
    "minecraftraids:village_guard_pillager",
  ];

  constructor(
    private readonly defenderRewardService: IDefenderRewardService,
    private readonly villageRaidService: VillageRaidService
  ) {}

  /**
   * Extract the owner player from an entity's tags.
   * Looks for tags in format "owner:<playerName>" and finds the matching player.
   */
  private getOwnerPlayer(entity: Entity): Player | null {
    const ownerTag = entity.getTags().find((tag) => tag.startsWith(UnitConstants.OWNER_TAG_PREFIX));

    if (!ownerTag) {
      return null;
    }

    const playerName = ownerTag.substring(UnitConstants.OWNER_TAG_PREFIX.length);

    // Find the player by name
    const players = world.getAllPlayers();
    return players.find((p) => p.name === playerName) || null;
  }

  /**
   * Subscribe to entity death events
   */
  public initialize(): void {
    world.afterEvents.entityDie.subscribe((event) => {
      const victim = event.deadEntity;

      // Check if victim is a defender
      if (!this.isDefender(victim.typeId)) {
        return;
      }

      // Get village key from defender tag
      const villageKey = this.villageRaidService.getVillageKeyForDefender(victim);
      if (!villageKey) {
        console.warn(`[DefenderKill] Defender ${victim.id} has no village tag - cannot reward`);
        return;
      }

      // Get killer (may be null if killed by environment)
      const killer = event.damageSource.damagingEntity;
      let killerPlayer: Player | null = null;

      if (killer) {
        if (killer.typeId === "minecraft:player") {
          killerPlayer = killer as Player;
        } else {
          // Check if killer is a recruited unit (tamed wolf or tagged unit)
          // Priority 1: Try tameable component (for wolves)
          const tameable = killer.getComponent(EntityComponentTypes.Tameable);
          if (tameable && tameable.isTamed && tameable.tamedToPlayer) {
            killerPlayer = tameable.tamedToPlayer;
          } else {
            // Priority 2: Try owner tag (for pillagers, vindicators, iron golems)
            killerPlayer = this.getOwnerPlayer(killer);
          }
        }
      }

      // Process kill and reward
      this.defenderRewardService.processDefenderKill(victim, killerPlayer, villageKey);
    });
  }

  /**
   * Check if entity type is a village defender
   */
  private isDefender(typeId: string): boolean {
    return this.DEFENDER_TYPES.includes(typeId);
  }
}
