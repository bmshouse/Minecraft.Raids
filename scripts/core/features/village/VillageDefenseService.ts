import { world, Vector3, Dimension } from "@minecraft/server";
import type { IVillageDefenseService } from "./IVillageDefenseService";
import { DefenseConfiguration, DefenseTier } from "./DefenseConfiguration";
import { DefenseSpawner } from "./DefenseSpawner";

/**
 * Represents a spawn attempt that failed due to unloaded chunk
 * Tracks enough information to retry the spawn later
 */
interface FailedSpawn {
  entityType: string;
  position: Vector3;
  tierEvent?: string;
}

/**
 * Tracks the state of village defense enhancement
 */
interface VillageDefenseState {
  tier: DefenseTier;
  failedSpawns: FailedSpawn[];
}

/**
 * Orchestrates village defense enhancement
 * Responsibilities (SRP):
 * - Coordinates tier-based spawning using DefenseConfiguration
 * - Manages village state tracking (clustering and full defense checks)
 * - Handles retry logic for failed spawns due to unloaded chunks
 *
 * Delegates entity spawning to DefenseSpawner utility (eliminates DRY violations)
 * Uses DefenseConfiguration for data-driven tier definitions (eliminates hardcoded values)
 */
export class VillageDefenseService implements IVillageDefenseService {
  private villageDefenseStates: Map<string, VillageDefenseState> = new Map();

  // Distance threshold for grouping nearby villagers as same village (blocks)
  private readonly VILLAGE_CLUSTERING_RADIUS = 100;

  constructor() {}

  /**
   * Enhances a village with appropriate defenses
   * Uses configuration-driven approach (DefenseConfiguration) for tier definitions
   * Supports smart retry logic for failed spawns due to unloaded chunks
   * @param villageLocation - Center location of the village
   */
  public async enhanceVillage(villageLocation: Vector3): Promise<void> {
    console.log(
      `[VillageDefense] enhanceVillage() called for location (${Math.round(villageLocation.x)}, ${Math.round(villageLocation.y)}, ${Math.round(villageLocation.z)})`
    );

    // Use radius-based clustering: check if this villager is within range of an existing village
    const nearbyKey = this.findNearbyVillageKey(villageLocation);
    const key = nearbyKey || this.getLocationKey(villageLocation);
    const existingState = this.villageDefenseStates.get(key);

    // If village has existing state, retry failed spawns only
    if (existingState) {
      if (existingState.failedSpawns.length === 0) {
        console.log(`[VillageDefense] Village FULLY DEFENDED - skipping`);
        return;
      }

      console.log(
        `[VillageDefense] Village has ${existingState.failedSpawns.length} failed spawns - retrying`
      );

      const dimension = world.getDimension("overworld");
      this.retryFailedSpawns(dimension, existingState);
      return;
    }

    // First time enhancing this village - calculate tier and attempt all spawns
    const tier = this.calculateTier(villageLocation);

    if (tier === DefenseTier.None) {
      console.log(`[VillageDefense] Tier 0 (None) - within 500 blocks of spawn, NO DEFENSES`);
      this.villageDefenseStates.set(key, { tier, failedSpawns: [] });
      return;
    }

    try {
      const dimension = world.getDimension("overworld");
      const failedSpawns = this.applyDefenses(dimension, villageLocation, tier);

      // Save state with failed spawns
      this.villageDefenseStates.set(key, { tier, failedSpawns });

      if (failedSpawns.length === 0) {
        console.log(`[VillageDefense] Village FULLY DEFENDED`);
      } else {
        console.log(
          `[VillageDefense] ${failedSpawns.length} spawns failed (will retry later)`
        );
      }
    } catch (error) {
      console.log(`[VillageDefense] Failed to enhance village: ${error}`);
    }
  }

  /**
   * Calculates defense tier based on distance from world spawn
   * Uses DefenseConfiguration for tier thresholds (eliminates hardcoded values)
   */
  private calculateTier(villageLocation: Vector3): DefenseTier {
    const spawnLoc = world.getDefaultSpawnLocation();
    const distance = this.calculateDistance(villageLocation, spawnLoc);

    const tier = DefenseConfiguration.getTierForDistance(distance);
    const tierNames = ["None (0-500 blocks)", "Light (500-1000)", "Medium (1000-2000)", "Heavy (2000+)"];
    console.log(`[VillageDefense] Distance: ${Math.round(distance)} blocks, Tier: ${tier} (${tierNames[tier]})`);

    return tier;
  }

  /**
   * Applies tier-based defenses using configuration
   * Replaces addLightDefense, addMediumDefense, addHeavyDefense (300+ lines)
   * with single method that uses data-driven configuration
   */
  private applyDefenses(dimension: Dimension, center: Vector3, tier: DefenseTier): FailedSpawn[] {
    const config = DefenseConfiguration.getConfigForTier(tier);
    if (!config) {
      console.log(`[VillageDefense] No configuration found for tier ${tier}`);
      return [];
    }

    const allFailedSpawns: FailedSpawn[] = [];

    // Spawn each entity type defined in configuration
    for (const entityConfig of config.entities) {
      const result = DefenseSpawner.spawnEntities(dimension, center, entityConfig);

      console.log(
        `[VillageDefense] ${entityConfig.entityType}: ${result.succeeded}/${result.attempted} spawned`
      );

      // Add failed spawns to retry list
      allFailedSpawns.push(...result.failed);
    }

    return allFailedSpawns;
  }

  /**
   * Retries failed spawns when chunks become loaded
   * Uses DefenseSpawner.trySpawnEntity() (eliminates DRY violation)
   * @param dimension - Overworld dimension
   * @param state - Village defense state with failed spawns
   */
  private retryFailedSpawns(dimension: Dimension, state: VillageDefenseState): void {
    const remainingFailed: FailedSpawn[] = [];

    for (const failed of state.failedSpawns) {
      const success = DefenseSpawner.trySpawnEntity(
        dimension,
        failed.position,
        failed.entityType,
        failed.tierEvent
      );

      if (success) {
        console.log(
          `[VillageDefense] Successfully spawned ${failed.entityType} on retry`
        );
      } else {
        remainingFailed.push(failed);
      }
    }

    // Update state with remaining failures
    state.failedSpawns = remainingFailed;

    if (remainingFailed.length === 0) {
      console.log(`[VillageDefense] All retry spawns successful - village now FULLY DEFENDED`);
    } else {
      console.log(`[VillageDefense] ${remainingFailed.length} spawns still failed (will retry later)`);
    }
  }

  /**
   * Calculates distance between two 3D points
   * @param a - First point
   * @param b - Second point
   * @returns Distance between points
   */
  private calculateDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Finds an existing village within clustering radius
   * Uses radius-based clustering to accurately group nearby villagers
   * @param location - Detected villager location
   * @returns Existing village key if within range, null if new village
   */
  private findNearbyVillageKey(location: Vector3): string | null {
    // Check if this villager is within clustering radius of any tracked village
    for (const [key] of this.villageDefenseStates) {
      const [keyX, keyZ] = key.split(",").map(Number);
      const dx = location.x - keyX;
      const dz = location.z - keyZ;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance <= this.VILLAGE_CLUSTERING_RADIUS) {
        return key; // Found existing village within range
      }
    }
    return null; // New village
  }

  /**
   * Creates a location key for a new village
   * Uses the rounded location as a stable key
   * @param location - Village center location
   * @returns Location key string
   */
  private getLocationKey(location: Vector3): string {
    const x = Math.round(location.x);
    const z = Math.round(location.z);
    return `${x},${z}`;
  }
}
