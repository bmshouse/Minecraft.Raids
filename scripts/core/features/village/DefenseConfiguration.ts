/**
 * Defense tier levels based on distance from world spawn
 */
export enum DefenseTier {
  None = 0,      // 0-500 blocks from spawn
  Light = 1,     // 500-1000 blocks from spawn
  Medium = 2,    // 1000-2000 blocks from spawn
  Heavy = 3      // 2000+ blocks from spawn
}

/**
 * Spawn pattern determines how positions are calculated relative to village center
 */
export enum SpawnPattern {
  Cardinal,      // N, S, E, W positions
  Diagonal,      // NE, SE, SW, NW positions
  Circular,      // Evenly distributed circle
  Custom         // Explicit position offsets
}

/**
 * Configures a single entity type spawn for a defense tier
 */
export interface EntitySpawnConfig {
  entityType: string;
  count: { min: number; max: number };  // Random count range
  radius: number;                        // Distance from center in blocks
  pattern: SpawnPattern;
  tierEvent?: string;                    // Optional event to trigger (for wolves)
  customPositions?: Array<{ x: number; z: number }>; // For SpawnPattern.Custom
}

/**
 * Configures all entities that spawn for a defense tier
 */
export interface TierDefenseConfig {
  tier: DefenseTier;
  entities: EntitySpawnConfig[];
}

/**
 * Data-driven configuration for village defense tiers
 * Eliminates hardcoded values scattered throughout service code
 * Follows WolfLevelingService pattern (configuration constants at top)
 */
export class DefenseConfiguration {
  /**
   * Distance thresholds for tier calculation (in blocks from world spawn)
   */
  public static readonly TIER_THRESHOLDS: Record<DefenseTier, number> = {
    [DefenseTier.None]: 0,
    [DefenseTier.Light]: 500,
    [DefenseTier.Medium]: 1000,
    [DefenseTier.Heavy]: 2000,
  };

  /**
   * Defense configurations for each tier
   * Data-driven approach eliminates switch statements and hardcoded values
   */
  public static readonly TIER_CONFIGS: TierDefenseConfig[] = [
    // Tier 1 (Light): 500-1000 blocks from spawn
    {
      tier: DefenseTier.Light,
      entities: [
        {
          entityType: "minecraftraids:village_defense_iron_golem",
          count: { min: 2, max: 3 },
          radius: 20,
          pattern: SpawnPattern.Cardinal,
        },
        {
          entityType: "minecraftraids:village_guard_wolf",
          count: { min: 2, max: 3 },
          radius: 15,
          pattern: SpawnPattern.Circular,
          tierEvent: "minecraftraids:set_tier_1",
        },
      ],
    },

    // Tier 2 (Medium): 1000-2000 blocks from spawn
    {
      tier: DefenseTier.Medium,
      entities: [
        {
          entityType: "minecraftraids:village_defense_iron_golem",
          count: { min: 4, max: 5 },
          radius: 25,
          pattern: SpawnPattern.Custom,
          customPositions: [
            { x: 25, z: 0 },    // East
            { x: -25, z: 0 },   // West
            { x: 0, z: 25 },    // South
            { x: 0, z: -25 },   // North
            { x: 18, z: 18 },   // Southeast
          ],
        },
        {
          entityType: "minecraftraids:village_guard_wolf",
          count: { min: 4, max: 5 },
          radius: 15,
          pattern: SpawnPattern.Circular,
          tierEvent: "minecraftraids:set_tier_2",
        },
      ],
    },

    // Tier 3 (Heavy): 2000+ blocks from spawn
    {
      tier: DefenseTier.Heavy,
      entities: [
        {
          entityType: "minecraftraids:village_defense_iron_golem",
          count: { min: 6, max: 6 },
          radius: 30,
          pattern: SpawnPattern.Circular,
        },
        {
          entityType: "minecraftraids:village_guard_pillager",
          count: { min: 3, max: 3 },
          radius: 25,
          pattern: SpawnPattern.Circular,
        },
        {
          entityType: "minecraftraids:village_guard_wolf",
          count: { min: 6, max: 8 },
          radius: 15,
          pattern: SpawnPattern.Circular,
          tierEvent: "minecraftraids:set_tier_3",
        },
      ],
    },
  ];

  /**
   * Calculates defense tier based on distance from world spawn
   * @param distance - Distance in blocks from world spawn
   * @returns Defense tier (0-3)
   */
  public static getTierForDistance(distance: number): DefenseTier {
    if (distance < this.TIER_THRESHOLDS[DefenseTier.Light]) {
      return DefenseTier.None;
    }
    if (distance < this.TIER_THRESHOLDS[DefenseTier.Medium]) {
      return DefenseTier.Light;
    }
    if (distance < this.TIER_THRESHOLDS[DefenseTier.Heavy]) {
      return DefenseTier.Medium;
    }
    return DefenseTier.Heavy;
  }

  /**
   * Gets configuration for a specific tier
   * @param tier - Defense tier to retrieve
   * @returns Tier configuration, or undefined if tier has no defenses
   */
  public static getConfigForTier(tier: DefenseTier): TierDefenseConfig | undefined {
    return this.TIER_CONFIGS.find((config) => config.tier === tier);
  }
}
