import { world, system } from "@minecraft/server";
import type { Player } from "@minecraft/server";
import type { IInitializer } from "./IInitializer";
import { VillageRaidService } from "../features/village/VillageRaidService";
import { ConquestTracker } from "../features/village/ConquestTracker";
import type { IResourceService } from "../resources/IResourceService";
import type { IPlayerPowerCalculator } from "../features/scaling/IPlayerPowerCalculator";
import type { IMessageProvider } from "../messaging/IMessageProvider";
import type { IDefenderRewardService } from "../features/rewards/IDefenderRewardService";

/**
 * Initializer for the village raid attack system
 * Scans periodically for villages near players and activates them for attack
 * Checks for victories and distributes emerald rewards
 *
 * Note: VillageRaidService now uses progression-based difficulty via injected calculator
 *
 * Single Responsibility: Periodic village scanning, activation, and victory detection
 */
export class VillageDefenseInitializer implements IInitializer {
  // Scan frequency: every 2 seconds (40 ticks at 20 ticks/second)
  private readonly SCAN_INTERVAL = 40;

  // Victory check frequency: every 2 seconds
  private readonly VICTORY_CHECK_INTERVAL = 40;

  constructor(
    private readonly villageRaidService: VillageRaidService,
    private readonly conquestTracker: ConquestTracker,
    private readonly resourceService: IResourceService,
    private readonly messageProvider: IMessageProvider,
    private readonly playerPowerCalculator?: IPlayerPowerCalculator,
    private readonly defenderRewardService?: IDefenderRewardService
  ) {}

  /**
   * Initializes the village raid system
   * Sets up periodic scanning for village activation and victory detection
   */
  public initialize(): void {
    console.log("[VillageRaid] Initializing village raid system...");

    // Periodic scan for villages near players (activation)
    system.runInterval(() => {
      const dimension = world.getDimension("overworld");
      this.villageRaidService.checkNearbyVillages(dimension);
    }, this.SCAN_INTERVAL);

    // Periodic victory detection
    system.runInterval(() => {
      const dimension = world.getDimension("overworld");
      this.checkVictories(dimension);
    }, this.VICTORY_CHECK_INTERVAL);

    console.log(`[VillageRaid] Village raid system initialized`);
  }

  /**
   * Check all active villages for victory conditions
   * Distribute rewards and apply cooldowns when villages are conquered
   */
  private checkVictories(dimension: any): void {
    const activeVillages = this.villageRaidService.getActiveVillages();

    for (const villageKey of activeVillages) {
      const justConquered = this.villageRaidService.checkVictory(villageKey, dimension);

      if (justConquered) {
        // Find nearest player to reward
        const state = this.villageRaidService.getVillageState(villageKey);
        if (!state) continue;

        const players = world.getAllPlayers();
        let nearestPlayer = null;
        let nearestDistance = Infinity;

        for (const player of players) {
          const dx = player.location.x - state.location.x;
          const dz = player.location.z - state.location.z;
          const distance = Math.sqrt(dx * dx + dz * dz);

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestPlayer = player;
          }
        }

        if (nearestPlayer && nearestDistance <= 100) {
          // Check cooldown before rewarding
          if (!this.conquestTracker.canConquer(nearestPlayer.id, villageKey)) {
            const cooldownMsg = this.messageProvider.getMessage(
              "mc.raids.village.cooldown",
              this.conquestTracker.getFormattedCooldown(nearestPlayer.id, villageKey)
            );
            nearestPlayer.sendMessage(cooldownMsg);
            continue;
          }

          // Calculate reward based on tier and player power
          const reward = this.calculateReward(nearestPlayer, state.tier);

          // Grant reward
          this.resourceService.addEmeralds(nearestPlayer, reward);

          // Record conquest (starts cooldown)
          this.conquestTracker.recordConquest(nearestPlayer.id, villageKey);

          // Notify player - use translate + with for proper message template substitution
          nearestPlayer.sendMessage({
            translate: "mc.raids.village.conquered",
            with: [reward.toString()],
          });

          console.log(
            `[VillageRaid] Player ${nearestPlayer.name} conquered village ${villageKey} - rewarded ${reward} emeralds`
          );

          // Schedule village reset after cooldown (15 minutes)
          system.runTimeout(() => {
            this.villageRaidService.resetVillage(villageKey);

            // Clear defender reward tracking
            this.defenderRewardService?.clearVillageRewards(villageKey);

            console.log(
              `[VillageRaid] Village ${villageKey} cooldown expired - defenders will respawn`
            );
          }, 18000); // 15 minutes = 900 seconds = 18000 ticks
        }
      }
    }
  }

  /**
   * Calculate emerald reward based on village tier and player power
   * Base rewards: Tier 1 = 18, Tier 2 = 36, Tier 3 = 60
   * Scaled by player power: 0.8x to 1.2x based on equipment and party
   */
  private calculateReward(player: Player, tier: number): number {
    // Get base reward from tier
    // Reduced by 40% for better game balance
    let baseReward: number;
    switch (tier) {
      case 1:
        baseReward = 18; // Light defense (was 30)
        break;
      case 2:
        baseReward = 36; // Medium defense (was 60)
        break;
      case 3:
        baseReward = 60; // Heavy defense (was 100)
        break;
      default:
        baseReward = 0;
    }

    // Apply power scaling if calculator is available
    if (this.playerPowerCalculator && baseReward > 0) {
      const powerLevel = this.playerPowerCalculator.calculatePowerLevel(player);

      // Scale between 0.8 and 1.2 based on power level
      // Beginner (0.0): 0.8x, Intermediate (0.5): 1.0x, Expert (1.0): 1.2x
      const scalingFactor = 0.8 + powerLevel.totalScore * 0.4;

      const scaledReward = Math.round(baseReward * scalingFactor);

      console.log(
        `[VillageRaid] Reward scaling for ${player.name}: Tier ${tier} base=${baseReward}, ` +
          `power=${powerLevel.tier} (${powerLevel.totalScore.toFixed(2)}), ` +
          `scaling=${scalingFactor.toFixed(2)}, final=${scaledReward}`
      );

      return scaledReward;
    }

    return baseReward;
  }
}
