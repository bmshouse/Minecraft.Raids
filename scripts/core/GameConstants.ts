/**
 * Central game constants for Minecraft Raids
 * All gameplay values organized by game system
 *
 * DO NOT hardcode values elsewhere - reference these constants
 * When adding new constants, place them in the appropriate namespace
 */

/**
 * Wolf and unit stat values
 */
export const WolfStats = {
  /** Wolf Guard HP (base wolf, level 1) */
  GUARD_HP: 20,
  /** Wolf Tank HP (high health specialization) */
  TANK_HP: 30,
  /** Wolf DPS HP (high damage specialization) */
  DPS_HP: 15,

  /** All valid wolf HP values (for validation) */
  ALL_HP_VALUES: [15, 20, 30] as readonly number[],

  GUARD_DAMAGE: 4,
  TANK_DAMAGE: 2,
  DPS_DAMAGE: 8,
} as const;

/**
 * Unit costs in emeralds
 */
export const UnitCosts = {
  WOLF_GUARD: 5,
  WOLF_TANK: 8,
  WOLF_DPS: 8,
  PILLAGER: 10,
  VINDICATOR: 12,
  IRON_GOLEM: 20,
} as const;

/**
 * Non-wolf unit stats
 */
export const UnitStats = {
  PILLAGER_HP: 24,
  PILLAGER_DAMAGE: 5,
  VINDICATOR_HP: 24,
  VINDICATOR_DAMAGE: 8,
  IRON_GOLEM_HP: 100,
  IRON_GOLEM_DAMAGE: 15,
} as const;

/**
 * Resource system constants
 */
export const Resources = {
  /** Starting emeralds granted to new players */
  STARTING_EMERALDS: 15,
} as const;

/**
 * Village detection and clustering
 */
export const VillageDetection = {
  /**
   * Clustering radius in blocks - villages within this distance
   * are considered the same village to prevent duplicates
   * Increased to 150 to detect villages before they're visually apparent (~40 blocks)
   */
  CLUSTERING_RADIUS: 150,

  /**
   * Activation radius in blocks - distance at which defenders spawn
   * when player approaches a village
   */
  ACTIVATION_RADIUS: 60,

  /** Maximum villages that can be tracked (DynamicProperty limit) */
  MAX_VILLAGES: 1000,
} as const;

/**
 * Village difficulty progression thresholds
 * Based on player conquest count
 */
export const VillageDifficulty = {
  /** First 3 villages (0-2 conquests): No defenses */
  TIER_0_MAX_CONQUESTS: 2,

  /** Villages 4-8 (3-7 conquests): Light defense */
  TIER_1_MAX_CONQUESTS: 7,

  /** Villages 9-15 (8-14 conquests): Medium defense */
  TIER_2_MAX_CONQUESTS: 14,

  // 15+ conquests: Heavy defense (no upper limit)
} as const;

/**
 * Player power calculation thresholds
 */
export const PlayerPower = {
  /** Equipment scores by material tier */
  ARMOR_SCORES: {
    LEATHER: 0.2,
    CHAINMAIL: 0.4,
    IRON: 0.6,
    DIAMOND: 0.8,
    NETHERITE: 1.0,
  },

  WEAPON_SCORES: {
    WOOD: 0.2,
    STONE: 0.3,
    IRON: 0.5,
    DIAMOND: 0.8,
    NETHERITE: 1.0,
  },

  /** Maximum raid party size for power calculation */
  MAX_PARTY_SIZE: 20,

  /** Weight for equipment in total power (60%) */
  EQUIPMENT_WEIGHT: 0.6,

  /** Weight for raid party in total power (40%) */
  PARTY_WEIGHT: 0.4,

  /** Weight for armor in equipment score (50%) */
  ARMOR_WEIGHT: 0.5,

  /** Weight for weapon in equipment score (40%) */
  WEAPON_WEIGHT: 0.4,

  /** Bonus for enchanted equipment (20%) */
  ENCHANTMENT_BONUS: 0.2,

  /** Power level tier thresholds (0.0 to 1.0 scale) */
  TIER_THRESHOLDS: {
    /** Beginner: < 0.25 */
    BEGINNER: 0.25,
    /** Intermediate: 0.25 to < 0.5 */
    INTERMEDIATE: 0.5,
    /** Advanced: 0.5 to < 0.75 */
    ADVANCED: 0.75,
    // Expert: >= 0.75
  },

  /** Expert power threshold for difficulty boost */
  EXPERT_POWER_THRESHOLD: 0.75,

  /** Advanced power threshold for difficulty boost */
  ADVANCED_POWER_THRESHOLD: 0.5,

  /** Minimum conquests needed for advanced difficulty boost */
  ADVANCED_EXPERIENCE_THRESHOLD: 5,
} as const;

/**
 * Conquest cooldown system
 */
export const Conquest = {
  /** Cooldown between village conquests in milliseconds (15 minutes) */
  COOLDOWN_MS: 900000,
} as const;

/**
 * Unit descriptions (used in UnitDefinitions)
 */
export const UnitDescriptions = {
  WOLF_GUARD: `Balanced wolf - ${WolfStats.GUARD_HP} HP, ${WolfStats.GUARD_DAMAGE} damage`,
  WOLF_TANK: `Tank wolf - ${WolfStats.TANK_HP} HP, ${WolfStats.TANK_DAMAGE} damage`,
  WOLF_DPS: `DPS wolf - ${WolfStats.DPS_HP} HP, ${WolfStats.DPS_DAMAGE} damage`,
  PILLAGER: `Ranged crossbow unit - ${UnitStats.PILLAGER_HP} HP, ${UnitStats.PILLAGER_DAMAGE} damage`,
  VINDICATOR: `Melee DPS unit - ${UnitStats.VINDICATOR_HP} HP, ${UnitStats.VINDICATOR_DAMAGE} damage`,
  IRON_GOLEM: `Tank unit - ${UnitStats.IRON_GOLEM_HP} HP, ${UnitStats.IRON_GOLEM_DAMAGE} damage`,
} as const;
