import { world } from "@minecraft/server";
import { Conquest } from "../../GameConstants";

/**
 * Service for tracking player village conquest history and cooldowns
 * Manages per-player conquest timestamps and cooldown validation
 *
 * Single Responsibility: Player conquest tracking and cooldown management
 */
export class ConquestTracker {
  private readonly CONQUEST_COOLDOWN = Conquest.COOLDOWN_MS;
  private readonly PLAYER_CONQUEST_PREFIX = "minecraftraids:player_";

  /**
   * Record that a player has conquered a village
   * Stores the current timestamp for cooldown tracking
   *
   * @param playerId - The player's unique ID
   * @param villageId - The village identifier
   */
  public recordConquest(playerId: string, villageId: string): void {
    const key = `${this.PLAYER_CONQUEST_PREFIX}${playerId}_conquests`;
    const data = world.getDynamicProperty(key);

    let conquests: Record<string, number> = {};
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        conquests = parsed.conquests || {};
      } catch {
        conquests = {};
      }
    }

    conquests[villageId] = Date.now();
    world.setDynamicProperty(key, JSON.stringify({ conquests }));
  }

  /**
   * Check if a player can conquer a village (not on cooldown)
   * Returns true if the player has never conquered this village,
   * or if the cooldown period has elapsed
   *
   * @param playerId - The player's unique ID
   * @param villageId - The village identifier
   * @returns True if the player can conquer the village
   */
  public canConquer(playerId: string, villageId: string): boolean {
    const key = `${this.PLAYER_CONQUEST_PREFIX}${playerId}_conquests`;
    const data = world.getDynamicProperty(key);

    if (typeof data !== "string") {
      return true; // No conquests yet
    }

    try {
      const parsed = JSON.parse(data);
      const conquests: Record<string, number> = parsed.conquests || {};
      const lastConquest = conquests[villageId];

      if (!lastConquest) {
        return true; // Never conquered this village
      }

      const elapsed = Date.now() - lastConquest;
      return elapsed >= this.CONQUEST_COOLDOWN;
    } catch {
      return true; // Parse error, allow conquest
    }
  }

  /**
   * Get the remaining cooldown time in milliseconds
   * Returns 0 if the village can be conquered
   *
   * @param playerId - The player's unique ID
   * @param villageId - The village identifier
   * @returns Milliseconds remaining, or 0 if no cooldown
   */
  public getRemainingCooldown(playerId: string, villageId: string): number {
    const key = `${this.PLAYER_CONQUEST_PREFIX}${playerId}_conquests`;
    const data = world.getDynamicProperty(key);

    if (typeof data !== "string") {
      return 0; // No conquests yet
    }

    try {
      const parsed = JSON.parse(data);
      const conquests: Record<string, number> = parsed.conquests || {};
      const lastConquest = conquests[villageId];

      if (!lastConquest) {
        return 0; // Never conquered this village
      }

      const elapsed = Date.now() - lastConquest;
      const remaining = this.CONQUEST_COOLDOWN - elapsed;
      return Math.max(0, remaining);
    } catch {
      return 0; // Parse error, no cooldown
    }
  }

  /**
   * Format remaining cooldown as human-readable string
   * @param playerId - The player's unique ID
   * @param villageId - The village identifier
   * @returns Formatted string like "5m 30s" or "Ready"
   */
  public getFormattedCooldown(playerId: string, villageId: string): string {
    const remaining = this.getRemainingCooldown(playerId, villageId);

    if (remaining === 0) {
      return "Ready";
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
