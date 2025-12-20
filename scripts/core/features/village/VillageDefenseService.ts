import { world, Vector3, Dimension } from "@minecraft/server";
import type { IVillageDefenseService } from "./IVillageDefenseService";
import type { IVillageGuardWolfService } from "./IVillageGuardWolfService";

/**
 * Defense tiers based on distance from world spawn
 */
enum DefenseTier {
  None = 0,      // 0-500 blocks from spawn
  Light = 1,     // 500-1000 blocks from spawn
  Medium = 2,    // 1000-2000 blocks from spawn
  Heavy = 3      // 2000+ blocks from spawn
}

/**
 * Represents a spawn attempt that failed due to unloaded chunk
 */
interface FailedSpawn {
  entityType: string;
  position: Vector3;
}

/**
 * Tracks the state of village defense enhancement
 */
interface VillageDefenseState {
  tier: DefenseTier;
  failedSpawns: FailedSpawn[];
}

/**
 * Enhances villages with progressive defenses based on distance
 * Spawns iron golems, walls, and guard wolves at appropriate tiers
 * and tracks which villages have been enhanced
 */
export class VillageDefenseService implements IVillageDefenseService {
  private villageDefenseStates: Map<string, VillageDefenseState> = new Map();

  constructor(private readonly guardWolfService: IVillageGuardWolfService) {}

  /**
   * Calculates distance between two 3D points
   * @param a - First point
   * @param b - Second point
   * @returns Distance between points
   */
  private calculateDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Enhances a village with appropriate defenses
   * Supports smart retry logic for failed spawns due to unloaded chunks
   * @param villageLocation - Center location of the village
   */
  public async enhanceVillage(villageLocation: Vector3): Promise<void> {
    console.warn(
      `[VillageDefense] enhanceVillage() called for location (${Math.round(villageLocation.x)}, ${Math.round(villageLocation.y)}, ${Math.round(villageLocation.z)})`
    );

    // Use radius-based clustering: check if this villager is within 60 blocks of an existing village
    const nearbyKey = this.findNearbyVillageKey(villageLocation);
    const key = nearbyKey || this.getLocationKey(villageLocation);
    const existingState = this.villageDefenseStates.get(key);

    // If village has existing state, retry failed spawns only
    if (existingState) {
      if (existingState.failedSpawns.length === 0) {
        console.warn(
          `[VillageDefense] Village at (${Math.round(villageLocation.x)}, ${Math.round(villageLocation.z)}) FULLY DEFENDED - skipping`
        );
        return;
      }

      console.warn(
        `[VillageDefense] Village at (${Math.round(villageLocation.x)}, ${Math.round(villageLocation.z)}) has ${existingState.failedSpawns.length} failed spawns - retrying`
      );

      const dimension = world.getDimension("overworld");
      this.retryFailedSpawns(dimension, existingState);
      return;
    }

    // First time enhancing this village - calculate tier and attempt all spawns
    const spawnLoc = world.getDefaultSpawnLocation();
    const distance = this.calculateDistance(villageLocation, spawnLoc);
    console.warn(
      `[VillageDefense] Distance from spawn: ${Math.round(distance)} blocks (spawn at ${Math.round(spawnLoc.x)}, ${Math.round(spawnLoc.z)})`
    );

    const tier = this.getDefenseTier(distance);
    const tierNames = ["None (0-500 blocks)", "Light (500-1000)", "Medium (1000-2000)", "Heavy (2000+)"];
    console.warn(`[VillageDefense] Tier ${tier} assigned: ${tierNames[tier]}`);

    if (tier === DefenseTier.None) {
      console.warn(`[VillageDefense] Tier 0 (None) - village within 500 blocks of spawn, NO DEFENSES ADDED`);
      // Mark as enhanced with no failed spawns (fully defended = no defenses needed)
      this.villageDefenseStates.set(key, { tier, failedSpawns: [] });
      return;
    }

    try {
      const dimension = world.getDimension("overworld");
      const failedSpawns: FailedSpawn[] = [];

      // Apply defenses based on tier
      switch (tier) {
        case DefenseTier.Light:
          console.warn(`[VillageDefense] Applying LIGHT defenses (2-3 golems + 2-3 wolves)`);
          this.addLightDefense(dimension, villageLocation, failedSpawns);
          break;
        case DefenseTier.Medium:
          console.warn(`[VillageDefense] Applying MEDIUM defenses (4-5 golems + 4-5 wolves)`);
          this.addMediumDefense(dimension, villageLocation, failedSpawns);
          break;
        case DefenseTier.Heavy:
          console.warn(`[VillageDefense] Applying HEAVY defenses (6+ golems + 6-8 wolves + pillagers)`);
          this.addHeavyDefense(dimension, villageLocation, failedSpawns);
          break;
      }

      // Save state with failed spawns
      this.villageDefenseStates.set(key, { tier, failedSpawns });

      if (failedSpawns.length === 0) {
        console.warn(`[VillageDefense] Village at (${Math.round(villageLocation.x)}, ${Math.round(villageLocation.z)}) FULLY DEFENDED`);
      } else {
        console.warn(
          `[VillageDefense] Village at (${Math.round(villageLocation.x)}, ${Math.round(villageLocation.z)}) partially defended - ${failedSpawns.length} spawns failed (will retry later)`
        );
      }
    } catch (error) {
      console.warn(`[VillageDefense] Failed to enhance village at (${Math.round(villageLocation.x)}, ${Math.round(villageLocation.z)}): ${error}`);
    }
  }

  /**
   * Retries failed spawns when chunks become loaded
   * @param dimension - Overworld dimension
   * @param state - Village defense state with failed spawns
   */
  private retryFailedSpawns(dimension: Dimension, state: VillageDefenseState): void {
    const remainingFailed: FailedSpawn[] = [];

    for (const failed of state.failedSpawns) {
      const block = dimension.getBlock(failed.position);
      if (block !== undefined) {
        // Chunk is loaded now, retry spawn
        try {
          if (failed.entityType === "guard_wolf") {
            this.guardWolfService.spawnGuardWolves(dimension, failed.position, state.tier);
          } else {
            dimension.spawnEntity(failed.entityType, failed.position);
          }
          console.warn(
            `[VillageDefense] Successfully spawned ${failed.entityType} at (${Math.round(failed.position.x)}, ${Math.round(failed.position.z)}) on retry`
          );
        } catch (error) {
          console.warn(
            `[VillageDefense] Retry spawn failed for ${failed.entityType} at (${Math.round(failed.position.x)}, ${Math.round(failed.position.z)}): ${error}`
          );
          remainingFailed.push(failed);
        }
      } else {
        // Still not loaded, keep in failed list
        console.warn(
          `[VillageDefense] Chunk still not loaded for ${failed.entityType} at (${Math.round(failed.position.x)}, ${Math.round(failed.position.z)})`
        );
        remainingFailed.push(failed);
      }
    }

    // Update state with remaining failures
    state.failedSpawns = remainingFailed;

    if (remainingFailed.length === 0) {
      console.warn(`[VillageDefense] All retry spawns successful - village now FULLY DEFENDED`);
    } else {
      console.warn(`[VillageDefense] ${remainingFailed.length} spawns still failed (will retry later)`);
    }
  }

  /**
   * Determines defense tier based on distance from spawn
   * @param distance - Distance from world spawn in blocks
   * @returns Defense tier (0-3)
   */
  private getDefenseTier(distance: number): DefenseTier {
    if (distance < 500) return DefenseTier.None;
    if (distance < 1000) return DefenseTier.Light;
    if (distance < 2000) return DefenseTier.Medium;
    return DefenseTier.Heavy;
  }

  /**
   * Adds light defenses (Tier 1): 2-3 iron golems + 2-3 guard wolves
   */
  private addLightDefense(dimension: Dimension, center: Vector3, failedSpawns: FailedSpawn[]): void {
    // Spawn 2-3 iron golems at cardinal directions
    const golemPositions = [
      { x: center.x + 20, y: center.y, z: center.z },      // East
      { x: center.x - 20, y: center.y, z: center.z },      // West
      { x: center.x, y: center.y, z: center.z + 20 },      // South
    ];

    let spawnedGolems = 0;
    golemPositions.forEach((pos) => {
      // Check if chunk is loaded before spawning
      const block = dimension.getBlock(pos);
      if (block !== undefined) {
        dimension.spawnEntity("minecraft:iron_golem", pos);
        spawnedGolems++;
      } else {
        console.warn(`[VillageDefense] Skipped golem spawn at (${Math.round(pos.x)}, ${Math.round(pos.z)}) - chunk not loaded`);
        failedSpawns.push({ entityType: "minecraft:iron_golem", position: pos });
      }
    });
    console.warn(`[VillageDefense] Spawned ${spawnedGolems}/${golemPositions.length} iron golems`);

    // Check if center chunk is loaded before spawning wolves
    const centerBlock = dimension.getBlock(center);
    if (centerBlock !== undefined) {
      this.guardWolfService.spawnGuardWolves(dimension, center, DefenseTier.Light);
      console.warn(`[VillageDefense] Spawned guard wolves (Tier 1)`);
    } else {
      console.warn(`[VillageDefense] Skipped guard wolves - chunk not loaded`);
      failedSpawns.push({ entityType: "guard_wolf", position: center });
    }
  }

  /**
   * Adds medium defenses (Tier 2): 4-5 iron golems + 4-5 guard wolves + walls
   */
  private addMediumDefense(dimension: Dimension, center: Vector3, failedSpawns: FailedSpawn[]): void {
    // Spawn 4-5 iron golems at cardinal and diagonal directions
    const golemPositions = [
      { x: center.x + 25, y: center.y, z: center.z },      // East
      { x: center.x - 25, y: center.y, z: center.z },      // West
      { x: center.x, y: center.y, z: center.z + 25 },      // South
      { x: center.x, y: center.y, z: center.z - 25 },      // North
      { x: center.x + 18, y: center.y, z: center.z + 18 }, // Southeast
    ];

    let spawnedGolems = 0;
    golemPositions.forEach((pos) => {
      // Check if chunk is loaded before spawning
      const block = dimension.getBlock(pos);
      if (block !== undefined) {
        dimension.spawnEntity("minecraft:iron_golem", pos);
        spawnedGolems++;
      } else {
        console.warn(`[VillageDefense] Skipped golem spawn at (${Math.round(pos.x)}, ${Math.round(pos.z)}) - chunk not loaded`);
        failedSpawns.push({ entityType: "minecraft:iron_golem", position: pos });
      }
    });
    console.warn(`[VillageDefense] Spawned ${spawnedGolems}/${golemPositions.length} iron golems`);

    // Build low walls at entrances (East/West)
    // TODO: Wall building disabled - causes LocationInUnloadedChunkError
    // this.buildWallSegment(dimension, center.x - 10, center.y, center.z + 30, 20, 3, "x");
    // this.buildWallSegment(dimension, center.x - 10, center.y, center.z - 30, 20, 3, "x");
    // console.warn(`[VillageDefense] Built walls at village entrances`);

    // Check if center chunk is loaded before spawning wolves
    const centerBlock = dimension.getBlock(center);
    if (centerBlock !== undefined) {
      this.guardWolfService.spawnGuardWolves(dimension, center, DefenseTier.Medium);
      console.warn(`[VillageDefense] Spawned guard wolves (Tier 2)`);
    } else {
      console.warn(`[VillageDefense] Skipped guard wolves - chunk not loaded`);
      failedSpawns.push({ entityType: "guard_wolf", position: center });
    }
  }

  /**
   * Adds heavy defenses (Tier 3): 6+ iron golems + 6-8 guard wolves + full walls + pillagers
   */
  private addHeavyDefense(dimension: Dimension, center: Vector3, failedSpawns: FailedSpawn[]): void {
    // Spawn 6+ iron golems in circular pattern at 30 blocks
    let spawnedGolems = 0;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const x = center.x + Math.cos(angle) * 30;
      const z = center.z + Math.sin(angle) * 30;
      const pos = { x, y: center.y, z };

      // Check if chunk is loaded before spawning
      const block = dimension.getBlock(pos);
      if (block !== undefined) {
        dimension.spawnEntity("minecraft:iron_golem", pos);
        spawnedGolems++;
      } else {
        console.warn(`[VillageDefense] Skipped golem spawn at (${Math.round(x)}, ${Math.round(z)}) - chunk not loaded`);
        failedSpawns.push({ entityType: "minecraft:iron_golem", position: pos });
      }
    }
    console.warn(`[VillageDefense] Spawned ${spawnedGolems}/6 iron golems in circular pattern`);

    // Build full perimeter walls (4-5 blocks high)
    // TODO: Wall building disabled - causes LocationInUnloadedChunkError
    // this.buildPerimeterWall(dimension, center, this.VILLAGE_RADIUS, 5);
    // console.warn(`[VillageDefense] Built perimeter wall (radius: ${this.VILLAGE_RADIUS} blocks, height: 5 blocks)`);

    // Spawn 2-3 pillager guards at 25 blocks
    let spawnedPillagers = 0;
    for (let i = 0; i < 3; i++) {
      const angle = (Math.PI * 2 * i) / 3;
      const x = center.x + Math.cos(angle) * 25;
      const z = center.z + Math.sin(angle) * 25;
      const pos = { x, y: center.y, z };

      // Check if chunk is loaded before spawning
      const block = dimension.getBlock(pos);
      if (block !== undefined) {
        dimension.spawnEntity("minecraftraids:village_guard_pillager", pos);
        spawnedPillagers++;
      } else {
        console.warn(`[VillageDefense] Skipped pillager spawn at (${Math.round(x)}, ${Math.round(z)}) - chunk not loaded`);
        failedSpawns.push({ entityType: "minecraftraids:village_guard_pillager", position: pos });
      }
    }
    console.warn(`[VillageDefense] Spawned ${spawnedPillagers}/3 pillagers`);

    // Check if center chunk is loaded before spawning wolves
    const centerBlock = dimension.getBlock(center);
    if (centerBlock !== undefined) {
      this.guardWolfService.spawnGuardWolves(dimension, center, DefenseTier.Heavy);
      console.warn(`[VillageDefense] Spawned guard wolves (Tier 3)`);
    } else {
      console.warn(`[VillageDefense] Skipped guard wolves - chunk not loaded`);
      failedSpawns.push({ entityType: "guard_wolf", position: center });
    }
  }

  // Wall building methods disabled - causes LocationInUnloadedChunkError
  // TODO: Implement wall building with proper chunk loading detection

  /**
   * Finds an existing village within a distance threshold
   * Uses radius-based clustering instead of grid-based to accurately group nearby villagers
   * @param location - Detected villager location
   * @param maxDistance - Maximum distance to consider same village (blocks)
   * @returns Existing village key if within range, null if new village
   */
  private findNearbyVillageKey(location: Vector3, maxDistance: number = 60): string | null {
    // Check if this villager is within maxDistance of any tracked village
    for (const [key] of this.villageDefenseStates) {
      const [keyX, keyZ] = key.split(",").map(Number);
      const dx = location.x - keyX;
      const dz = location.z - keyZ;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance <= maxDistance) {
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
