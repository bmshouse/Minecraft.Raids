/**
 * Centralized dynamic property key generation
 * Prevents key collisions and typos
 */
export class DynamicPropertyKeys {
  private static readonly PREFIX = "minecraftraids:";

  /**
   * Key for storing wolf kill counts
   */
  public static wolfKillCount(wolfId: string): string {
    return `${this.PREFIX}wolf_${wolfId}_kills`;
  }

  /**
   * Key for storing pocketed units
   */
  public static pocketedUnits(playerName: string): string {
    return `${this.PREFIX}pocketed_${playerName}`;
  }

  /**
   * Key for storing player emeralds
   */
  public static playerEmeralds(playerName: string): string {
    return `${this.PREFIX}emeralds_${playerName}`;
  }

  /**
   * Key for storing player conquests (cooldowns)
   */
  public static playerConquests(playerId: string): string {
    return `${this.PREFIX}player_${playerId}_conquests`;
  }

  /**
   * Key for storing discovered villages cache
   */
  public static villageCache(): string {
    return `${this.PREFIX}discovered_villages`;
  }
}
