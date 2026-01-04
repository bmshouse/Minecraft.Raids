import { world, Vector3, Dimension, Player } from "@minecraft/server";
import { DefenseConfiguration, DefenseTier } from "./DefenseConfiguration";
import { EntitySpawner } from "../../utils/EntitySpawner";
import { VillageDetection } from "../../GameConstants";
import type { IVillageCache } from "./IVillageCache";
import type { IVillageDifficultyCalculator } from "./IVillageDifficultyCalculator";

/**
 * Represents a spawn attempt that failed due to unloaded chunk
 */
interface FailedSpawn {
  entityType: string;
  position: Vector3;
  tierEvent?: string;
}

/**
 * Tracks the state of a village for raid attacks
 */
interface VillageRaidState {
  tier: DefenseTier;
  isActive: boolean; // Has defenders spawned
  isConquered: boolean; // All defenders eliminated
  defenderIds: string[]; // Entity IDs of spawned defenders
  failedSpawns: FailedSpawn[];
  location: Vector3;
}

/**
 * Orchestrates village raid attacks
 * Villages are enemy targets that players attack with their raid parties
 *
 * Key differences from defense mode:
 * - Villages start EMPTY (no defenders)
 * - Defenders spawn when player approaches (60-block activation radius)
 * - Defenders DON'T respawn after death
 * - Victory = all defenders eliminated → emerald reward
 * - 15-minute cooldown per village per player
 *
 * Updated to use:
 * - VillageCache for persistent village storage
 * - ProgressionBasedDifficultyCalculator for dynamic difficulty
 */
export class VillageRaidService {
  private villageStates: Map<string, VillageRaidState> = new Map();
  private readonly VILLAGE_CLUSTERING_RADIUS = VillageDetection.CLUSTERING_RADIUS;
  private readonly ACTIVATION_RADIUS = VillageDetection.ACTIVATION_RADIUS;

  constructor(
    private readonly villageCache: IVillageCache,
    private readonly difficultyCalculator: IVillageDifficultyCalculator
  ) {}

  /**
   * Check villages near players and activate if within range
   * Called periodically by VillageDefenseInitializer
   */
  public checkNearbyVillages(dimension: Dimension): void {
    const players = world.getAllPlayers();

    for (const player of players) {
      // Find nearby villagers (indicates village presence)
      const nearbyVillagers = dimension.getEntities({
        type: "minecraft:villager",
        location: player.location,
        maxDistance: this.ACTIVATION_RADIUS,
      });

      if (nearbyVillagers.length > 0) {
        const villagerLoc = nearbyVillagers[0].location;
        this.tryActivateVillage(player, villagerLoc, dimension);
      }
    }
  }

  /**
   * Attempt to activate a village when player approaches
   * Uses progression-based difficulty calculation
   */
  private tryActivateVillage(player: Player, villageLocation: Vector3, dimension: Dimension): void {
    const key = this.findNearbyVillageKey(villageLocation) || this.getLocationKey(villageLocation);
    let state = this.villageStates.get(key);

    // Ensure village is in cache
    if (!this.villageCache.hasDiscovered(villageLocation)) {
      this.villageCache.addVillage(villageLocation, "entity");
    }

    // If village doesn't exist in local state, create it
    if (!state) {
      // Get cached village for difficulty calculation
      const cachedVillage = this.villageCache.getVillageByKey(key);
      const tier = cachedVillage
        ? this.difficultyCalculator.calculateDifficulty(player, cachedVillage)
        : this.calculateTier(villageLocation); // Fallback to distance-based

      state = {
        tier,
        isActive: false,
        isConquered: false,
        defenderIds: [],
        failedSpawns: [],
        location: villageLocation,
      };
      this.villageStates.set(key, state);
    }

    // Don't activate if already active or conquered
    if (state.isActive || state.isConquered) {
      return;
    }

    // Activate village: spawn defenders
    console.log(`[VillageRaid] Activating village at ${key} (Tier ${state.tier})`);
    this.spawnDefenders(dimension, state);
    state.isActive = true;
  }

  /**
   * Spawn defenders for an activated village
   */
  private spawnDefenders(dimension: Dimension, state: VillageRaidState): void {
    if (state.tier === DefenseTier.None) {
      console.log(`[VillageRaid] Tier 0 village - no defenders`);
      return;
    }

    const config = DefenseConfiguration.getConfigForTier(state.tier);
    if (!config) {
      console.log(`[VillageRaid] No configuration for tier ${state.tier}`);
      return;
    }

    const allFailedSpawns: FailedSpawn[] = [];

    // Spawn each entity type
    for (const entityConfig of config.entities) {
      const result = EntitySpawner.spawnEntities(dimension, state.location, entityConfig);

      console.log(
        `[VillageRaid] ${entityConfig.entityType}: ${result.succeeded}/${result.attempted} spawned`
      );

      // Track spawned defender IDs
      for (const entity of result.entities) {
        state.defenderIds.push(entity.id);
      }

      allFailedSpawns.push(...result.failed);
    }

    state.failedSpawns = allFailedSpawns;
    console.log(`[VillageRaid] Village activated with ${state.defenderIds.length} defenders`);
  }

  /**
   * Check if village is conquered (all defenders dead)
   * Returns true if conquest just happened (for reward distribution)
   */
  public checkVictory(villageKey: string, dimension: Dimension): boolean {
    const state = this.villageStates.get(villageKey);
    if (!state || !state.isActive || state.isConquered) {
      return false;
    }

    // Count living defenders
    const livingDefenders = state.defenderIds.filter((id) => {
      const entity = dimension.getEntities().find((e) => e.id === id);
      return entity && entity.isValid;
    });

    // Victory condition: all defenders eliminated
    if (livingDefenders.length === 0 && state.defenderIds.length > 0) {
      console.log(`[VillageRaid] VICTORY! Village ${villageKey} conquered`);
      state.isConquered = true;
      return true; // Just conquered
    }

    return false;
  }

  /**
   * Get all active village keys for victory checking
   */
  public getActiveVillages(): string[] {
    const active: string[] = [];
    for (const [key, state] of this.villageStates) {
      if (state.isActive && !state.isConquered) {
        active.push(key);
      }
    }
    return active;
  }

  /**
   * Reset village after cooldown expires (respawn defenders)
   */
  public resetVillage(villageKey: string): void {
    const state = this.villageStates.get(villageKey);
    if (state) {
      state.isActive = false;
      state.isConquered = false;
      state.defenderIds = [];
      state.failedSpawns = [];
      console.log(
        `[VillageRaid] Village ${villageKey} reset (defenders will respawn on next activation)`
      );
    }
  }

  /**
   * Calculate tier based on distance from spawn
   */
  private calculateTier(villageLocation: Vector3): DefenseTier {
    const spawnLoc = world.getDefaultSpawnLocation();
    const distance = this.calculateDistance(villageLocation, spawnLoc);
    return DefenseConfiguration.getTierForDistance(distance);
  }

  /**
   * Calculate 2D distance between points
   */
  private calculateDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Find existing village within clustering radius
   */
  private findNearbyVillageKey(location: Vector3): string | null {
    for (const [key, state] of this.villageStates) {
      const distance = this.calculateDistance(location, state.location);
      if (distance <= this.VILLAGE_CLUSTERING_RADIUS) {
        return key;
      }
    }
    return null;
  }

  /**
   * Create location key for a village
   */
  private getLocationKey(location: Vector3): string {
    const x = Math.round(location.x);
    const z = Math.round(location.z);
    return `${x},${z}`;
  }

  /**
   * Get village state (for external access)
   */
  public getVillageState(key: string): VillageRaidState | undefined {
    return this.villageStates.get(key);
  }
}
