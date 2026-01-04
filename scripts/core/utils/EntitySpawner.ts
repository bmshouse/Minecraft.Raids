import type { Dimension, Vector3, Entity } from "@minecraft/server";
import { TerrainUtils, SurfaceType } from "./TerrainUtils";
import { SpawnPattern, type EntitySpawnConfig } from "../spawning/SpawningTypes";

// Re-export types for convenience
export { SpawnPattern, type EntitySpawnConfig };

/**
 * Result of a spawn attempt
 */
export interface SpawnResult {
  attempted: number;
  succeeded: number;
  entities: Entity[]; // Spawned entities for tracking
  failed: Array<{
    entityType: string;
    position: Vector3;
    tierEvent?: string;
  }>;
}

/**
 * Pure utility class for terrain-aware entity spawning
 * No state, no dependencies - just pure static methods
 */
export class EntitySpawner {
  /**
   * Spawns entities based on configuration
   * Handles terrain-aware Y-coordinate calculation and chunk loading checks
   * @param dimension - The dimension to spawn in
   * @param center - Center location (Y used as starting point for ground finding)
   * @param config - Entity configuration with count, radius, pattern, etc.
   * @param campCenter - Optional camp center for water fallback (raid camps only)
   * @returns SpawnResult with success count and failed spawns for retry tracking
   */
  public static spawnEntities(
    dimension: Dimension,
    center: Vector3,
    config: EntitySpawnConfig,
    campCenter?: Vector3
  ): SpawnResult {
    const count = this.getRandomCount(config.count.min, config.count.max);
    const positions = this.calculatePositions(
      center,
      config.radius,
      config.pattern,
      count,
      config.customPositions
    );

    const result: SpawnResult = {
      attempted: count,
      succeeded: 0,
      entities: [],
      failed: [],
    };

    for (const position of positions) {
      const entity = this.trySpawnEntity(
        dimension,
        position,
        config.entityType,
        config.tierEvent,
        campCenter
      );

      if (entity) {
        result.succeeded++;
        result.entities.push(entity);
      } else {
        result.failed.push({
          entityType: config.entityType,
          position,
          tierEvent: config.tierEvent,
        });
      }
    }

    return result;
  }

  /**
   * Attempts to spawn a single entity at terrain-aware position
   *
   * Uses TerrainUtils for proper ground finding:
   * - Finds actual ground level at XZ coordinate using bidirectional search
   * - Checks if chunk is loaded (returns null if not)
   * - Validates spawn position is solid ground (not water/lava)
   * - If water detected and campCenter provided, attempts progressive fallback
   * - Ensures 3 blocks of vertical clearance above spawn position
   * - Clears replaceable blocks (leaves, grass, etc.) if needed
   * - Spawns entity one block above ground level
   * - Optionally triggers tier event
   *
   * @param dimension - The dimension to spawn in
   * @param position - Spawn position (Y used as starting point for ground search)
   * @param entityType - Entity type identifier
   * @param tierEvent - Optional event to trigger on spawned entity
   * @param campCenter - Optional camp center for water fallback (raid camps only)
   * @returns Entity if spawn successful, null if chunk not loaded or no solid ground found
   */
  public static trySpawnEntity(
    dimension: Dimension,
    position: Vector3,
    entityType: string,
    tierEvent?: string,
    campCenter?: Vector3
  ): Entity | null {
    // Use TerrainUtils for actual ground finding
    const groundResult = TerrainUtils.findGroundLevel(
      dimension,
      position.x,
      position.z,
      position.y
    );

    if (!groundResult) {
      // Chunk not loaded - will be retried later
      return null;
    }

    let spawnPos: Vector3;

    // Water/lava validation with fallback
    if (
      groundResult.surfaceType === SurfaceType.Water ||
      groundResult.surfaceType === SurfaceType.Lava
    ) {
      if (!campCenter) {
        // No fallback available, spawn on water
        spawnPos = {
          x: position.x,
          y: groundResult.groundY + 1,
          z: position.z,
        };
      } else {
        // Raid camp - attempt progressive fallback
        const solidResult = this.findSolidSpawnPosition(dimension, campCenter, position);
        if (!solidResult) {
          return null; // Cannot spawn - all positions are liquid
        }
        spawnPos = {
          x: solidResult.position.x,
          y: solidResult.groundY + 1,
          z: solidResult.position.z,
        };
      }
    } else {
      // Solid ground - spawn normally
      spawnPos = {
        x: position.x,
        y: groundResult.groundY + 1,
        z: position.z,
      };
    }

    // Clear 3 blocks of vertical space above spawn position to prevent entities from getting stuck
    // This prevents defenders from spawning inside leaves, grass, etc.
    this.clearVerticalSpaceForSpawn(dimension, spawnPos, 3);

    // Spawn entity at exact terrain-aware location
    const entity = dimension.spawnEntity(entityType, spawnPos);

    // Trigger tier event if specified
    if (tierEvent) {
      entity.triggerEvent(tierEvent);
    }

    return entity;
  }

  /**
   * Clears replaceable blocks (leaves, grass, etc.) in vertical space above spawn position
   * Ensures entities don't spawn inside tree foliage or tall grass
   *
   * @param dimension - The dimension to clear blocks in
   * @param spawnPos - The spawn position (entity will spawn here)
   * @param height - Number of blocks above spawn position to clear (default: 3)
   */
  private static clearVerticalSpaceForSpawn(
    dimension: Dimension,
    spawnPos: Vector3,
    height: number = 3
  ): void {
    // Clear from spawnPos.y up to spawnPos.y + height
    for (let y = spawnPos.y; y < spawnPos.y + height; y++) {
      const block = dimension.getBlock({
        x: spawnPos.x,
        y: y,
        z: spawnPos.z,
      });

      if (block && !block.isAir) {
        // Check if block is replaceable (leaves, grass, flowers, etc.)
        if (this.isReplaceableBlock(block.typeId)) {
          try {
            block.setType("minecraft:air");
          } catch {
            // Block couldn't be replaced, but continue anyway
            console.warn(
              `[EntitySpawner] Failed to clear block ${block.typeId} at (${spawnPos.x}, ${y}, ${spawnPos.z})`
            );
          }
        }
      }
    }
  }

  /**
   * Check if a block type is safe to replace (vegetation, snow, etc.)
   * Does NOT include solid terrain blocks like stone, dirt, logs
   *
   * @param blockTypeId - The block type identifier
   * @returns true if block can be safely replaced
   */
  private static isReplaceableBlock(blockTypeId: string): boolean {
    // Leaves (all types)
    if (blockTypeId.includes("leaves")) {
      return true;
    }

    // Vegetation and plants
    if (
      blockTypeId.includes("grass") ||
      blockTypeId.includes("fern") ||
      blockTypeId.includes("flower") ||
      blockTypeId.includes("sapling") ||
      blockTypeId.includes("vine") ||
      blockTypeId.includes("mushroom") ||
      blockTypeId.includes("tallgrass") ||
      blockTypeId === "minecraft:tall_grass" ||
      blockTypeId === "minecraft:large_fern" ||
      blockTypeId === "minecraft:dead_bush" ||
      blockTypeId === "minecraft:seagrass" ||
      blockTypeId === "minecraft:kelp" ||
      blockTypeId === "minecraft:bamboo"
    ) {
      return true;
    }

    // Snow layers (not snow blocks)
    if (blockTypeId === "minecraft:snow" || blockTypeId === "minecraft:snow_layer") {
      return true;
    }

    // Crops and farmland decorations
    if (
      blockTypeId.includes("wheat") ||
      blockTypeId.includes("carrots") ||
      blockTypeId.includes("potatoes") ||
      blockTypeId.includes("beetroot")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Find solid (non-liquid) spawn position with progressive fallback to camp center
   * Tries positions at 100%, 90%, 80%... of radius until solid ground found
   */
  private static findSolidSpawnPosition(
    dimension: Dimension,
    campCenter: Vector3,
    originalPosition: Vector3
  ):
    | {
        position: Vector3;
        groundY: number;
      }
    | undefined {
    const offsetX = originalPosition.x - campCenter.x;
    const offsetZ = originalPosition.z - campCenter.z;

    // Try at decreasing radii: 100%, 90%, 80%, ..., 10%, 0%
    const radiusMultipliers = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0];

    for (const multiplier of radiusMultipliers) {
      const testX = campCenter.x + offsetX * multiplier;
      const testZ = campCenter.z + offsetZ * multiplier;

      const groundResult = TerrainUtils.findGroundLevel(
        dimension,
        testX,
        testZ,
        originalPosition.y
      );

      if (!groundResult) {
        continue; // Chunk not loaded, try next position
      }

      // Check if solid ground (not liquid)
      if (groundResult.surfaceType === SurfaceType.Solid) {
        return {
          position: { x: testX, y: groundResult.groundY, z: testZ },
          groundY: groundResult.groundY,
        };
      }
    }

    console.warn(
      `[EntitySpawner] No solid ground found for spawn at (${originalPosition.x}, ${originalPosition.z})`
    );
    return undefined;
  }

  /**
   * Calculates spawn positions based on pattern type
   * @param center - Center point for position calculations
   * @param radius - Distance from center in blocks
   * @param pattern - How to distribute positions (circular, cardinal, etc.)
   * @param count - Number of positions to generate
   * @param customPositions - Custom position offsets for SpawnPattern.Custom
   * @returns Array of spawn positions
   */
  private static calculatePositions(
    center: Vector3,
    radius: number,
    pattern: SpawnPattern,
    count: number,
    customPositions?: Array<{ x: number; z: number }>
  ): Vector3[] {
    switch (pattern) {
      case SpawnPattern.Circular:
        return this.calculateCircularPositions(center, radius, count);
      case SpawnPattern.Cardinal:
        return this.calculateCardinalPositions(center, radius);
      case SpawnPattern.Diagonal:
        return this.calculateDiagonalPositions(center, radius);
      case SpawnPattern.Custom:
        return this.calculateCustomPositions(center, customPositions || []);
      default:
        return [];
    }
  }

  /**
   * Calculates positions in a circular pattern around center
   * Positions evenly distributed at specified radius
   * @param center - Center point
   * @param radius - Distance from center
   * @param count - Number of positions
   * @returns Array of positions in circular pattern
   */
  private static calculateCircularPositions(
    center: Vector3,
    radius: number,
    count: number
  ): Vector3[] {
    const positions: Vector3[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      positions.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y,
        z: center.z + Math.sin(angle) * radius,
      });
    }
    return positions;
  }

  /**
   * Calculates positions at cardinal directions (N, S, E, W)
   * @param center - Center point
   * @param radius - Distance from center
   * @returns Array of 4 positions at cardinal directions
   */
  private static calculateCardinalPositions(center: Vector3, radius: number): Vector3[] {
    return [
      { x: center.x + radius, y: center.y, z: center.z }, // East
      { x: center.x - radius, y: center.y, z: center.z }, // West
      { x: center.x, y: center.y, z: center.z + radius }, // South
      { x: center.x, y: center.y, z: center.z - radius }, // North
    ];
  }

  /**
   * Calculates positions at diagonal directions (NE, SE, SW, NW)
   * @param center - Center point
   * @param radius - Distance from center (diagonal offset)
   * @returns Array of 4 positions at diagonal directions
   */
  private static calculateDiagonalPositions(center: Vector3, radius: number): Vector3[] {
    const offset = radius / Math.sqrt(2); // 45-degree diagonal
    return [
      { x: center.x + offset, y: center.y, z: center.z + offset }, // NE
      { x: center.x + offset, y: center.y, z: center.z - offset }, // SE
      { x: center.x - offset, y: center.y, z: center.z - offset }, // SW
      { x: center.x - offset, y: center.y, z: center.z + offset }, // NW
    ];
  }

  /**
   * Calculates positions from custom offsets
   * @param center - Center point
   * @param offsets - Array of XZ offsets relative to center
   * @returns Array of positions
   */
  private static calculateCustomPositions(
    center: Vector3,
    offsets: Array<{ x: number; z: number }>
  ): Vector3[] {
    return offsets.map((offset) => ({
      x: center.x + offset.x,
      y: center.y,
      z: center.z + offset.z,
    }));
  }

  /**
   * Generates random count within min/max range
   * @param min - Minimum count (inclusive)
   * @param max - Maximum count (inclusive)
   * @returns Random integer between min and max
   */
  private static getRandomCount(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
