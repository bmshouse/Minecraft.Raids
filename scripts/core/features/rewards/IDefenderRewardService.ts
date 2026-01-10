import type { Player, Entity } from "@minecraft/server";

/**
 * Service for managing per-defender kill rewards
 * Tracks which player killed which defender and prevents double-rewarding
 */
export interface IDefenderRewardService {
  /**
   * Process a defender kill and reward the killer
   * @param defender - The defender entity that died
   * @param killer - The player who killed it (may be null)
   * @param villageKey - The village the defender belonged to
   */
  processDefenderKill(defender: Entity, killer: Player | null, villageKey: string): void;

  /**
   * Clear reward tracking for a village (called after cooldown reset)
   * @param villageKey - The village to reset
   */
  clearVillageRewards(villageKey: string): void;
}
