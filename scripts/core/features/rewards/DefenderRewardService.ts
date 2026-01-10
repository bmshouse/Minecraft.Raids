import type { Player, Entity } from "@minecraft/server";
import type { IDefenderRewardService } from "./IDefenderRewardService";
import type { IResourceService } from "../../resources/IResourceService";
import type { IMessageProvider } from "../../messaging/IMessageProvider";
import type { VillageRaidService } from "../village/VillageRaidService";
import { DefenseTier } from "../village/DefenseConfiguration";

/**
 * Manages per-defender kill rewards
 *
 * Reward Structure (per defender):
 * - Tier 1 (Light): 3 emeralds per defender (2-3 defenders = 6-9 total)
 * - Tier 2 (Medium): 4 emeralds per defender (4-5 defenders = 16-20 total)
 * - Tier 3 (Heavy): 6 emeralds per defender (6+ defenders = 36+ total)
 *
 * Victory bonuses (VillageDefenseInitializer):
 * - Tier 1: 18 emeralds
 * - Tier 2: 36 emeralds
 * - Tier 3: 60 emeralds
 *
 * Total rewards example (Tier 3 with 6 defenders):
 * - Kill rewards: 6 × 6 = 36 emeralds (40%)
 * - Victory bonus: 60 emeralds (60%)
 * - Grand total: 96 emeralds (was 160, reduced 40%)
 */
export class DefenderRewardService implements IDefenderRewardService {
  // Per-defender reward amounts by tier
  // Balanced for ~40% combat / 60% victory reward split
  private readonly REWARDS_PER_DEFENDER = {
    [DefenseTier.Light]: 3, // Was 5 (-40%)
    [DefenseTier.Medium]: 4, // Was 7 (-43%)
    [DefenseTier.Heavy]: 6, // Was 10 (-40%)
  };

  // Track rewarded defender IDs to prevent double-rewarding
  // Structure: Map<villageKey, Set<defenderEntityId>>
  private rewardedDefenders: Map<string, Set<string>> = new Map();

  constructor(
    private readonly resourceService: IResourceService,
    private readonly messageProvider: IMessageProvider,
    private readonly villageRaidService: VillageRaidService
  ) {}

  /**
   * Process defender kill and grant reward
   *
   * Note: Kill attribution (player vs recruited unit) is handled by DefenderKillInitializer
   */
  public processDefenderKill(defender: Entity, killer: Player | null, villageKey: string): void {
    if (!killer) {
      console.log(`[DefenderReward] Defender ${defender.id} killed by non-player - no reward`);
      return;
    }

    // Check if already rewarded
    if (this.hasBeenRewarded(villageKey, defender.id)) {
      console.warn(
        `[DefenderReward] Defender ${defender.id} already rewarded - preventing double-reward`
      );
      return;
    }

    // Get village state to determine tier
    const villageState = this.villageRaidService.getVillageState(villageKey);
    if (!villageState) {
      console.warn(`[DefenderReward] Village ${villageKey} not found`);
      return;
    }

    const tier = villageState.tier;

    // Tier 0 has no defenders and no rewards
    if (tier === DefenseTier.None) {
      return;
    }

    const reward = this.REWARDS_PER_DEFENDER[tier] || 0;
    if (reward === 0) {
      console.warn(`[DefenderReward] No reward configured for tier ${tier}`);
      return;
    }

    // Grant reward
    this.resourceService.addEmeralds(killer, reward);

    // Mark as rewarded
    this.markAsRewarded(villageKey, defender.id);

    // Notify player
    killer.sendMessage({
      rawtext: [
        { text: "§6" },
        {
          text:
            this.messageProvider.getMessage(
              "mc.raids.defender.killed",
              `+${reward} emeralds (Defender eliminated)`
            ).text || `+${reward} emeralds (Defender eliminated)`,
        },
      ],
    });

    console.log(
      `[DefenderReward] Player ${killer.name} killed defender ${defender.id} ` +
        `at village ${villageKey} (Tier ${tier}) - rewarded ${reward} emeralds`
    );
  }

  /**
   * Clear reward tracking for a village (called when village resets)
   */
  public clearVillageRewards(villageKey: string): void {
    this.rewardedDefenders.delete(villageKey);
    console.log(`[DefenderReward] Cleared reward tracking for village ${villageKey}`);
  }

  /**
   * Check if defender has already been rewarded
   */
  private hasBeenRewarded(villageKey: string, defenderId: string): boolean {
    const villageRewards = this.rewardedDefenders.get(villageKey);
    return villageRewards ? villageRewards.has(defenderId) : false;
  }

  /**
   * Mark defender as rewarded
   */
  private markAsRewarded(villageKey: string, defenderId: string): void {
    let villageRewards = this.rewardedDefenders.get(villageKey);
    if (!villageRewards) {
      villageRewards = new Set();
      this.rewardedDefenders.set(villageKey, villageRewards);
    }
    villageRewards.add(defenderId);
  }
}
