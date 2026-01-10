import { Dimension, Vector3, Entity } from "@minecraft/server";
import type { EntitySpawnConfig, SpawnPattern } from "./DefenseConfiguration";
import { SpawnPattern as SpawnPatternEnum } from "./DefenseConfiguration";

/**
 * Result of attempting to spawn entities
 * Tracks successes, failures, and spawned entities for raid tracking
 */
export interface SpawnResult {
  attempted: number;
  succeeded: number;
  entities: Entity[]; // NEW: spawned entities for tracking
  failed: Array<{
    entityType: string;
    position: Vector3;
    tierEvent?: string;
  }>;
}

/**
 * Pure utility class for terrain-aware entity spawning
 * Centralizes ground block finding logic (eliminates DRY violation)
 * No state, no dependencies - just pure static methods
 *
 * Replaces 9+ duplications of ground block finding pattern scattered across:
 * - VillageDefenseService tier methods (7 times)
 * - VillageGuardWolfService (1 time)
 * - retryFailedSpawns (1 time)
 */
export class DefenseSpawner {
  /**
   * Spawns entities based on configuration
   * Handles terrain-aware Y-coordinate calculation and chunk loading checks
   * @param dimension - The dimension to spawn in
   * @param center - Village center location (Y used as starting point for ground finding)
   * @param config - Entity configuration with count, radius, pattern, etc.
   * @returns SpawnResult with success count and failed spawns for retry tracking
   */
  public static spawnEntities(
    dimension: Dimension,
    center: Vector3,
    config: EntitySpawnConfig
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
      const entity = this.trySpawnEntityWithReturn(
        dimension,
        position,
        config.entityType,
        config.tierEvent
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
   * Attempts to spawn a single entity and return it
   * @param dimension - The dimension to spawn in
   * @param position - Spawn position (Y used as starting point)
   * @param entityType - Entity type identifier
   * @param tierEvent - Optional event to trigger on spawned entity
   * @returns Entity if spawn successful, null if chunk not loaded
   */
  public static trySpawnEntityWithReturn(
    dimension: Dimension,
    position: Vector3,
    entityType: string,
    tierEvent?: string
  ): Entity | null {
    // Find ground block at XZ coordinate (using provided Y as starting point)
    const groundBlock = dimension.getBlock({
      x: position.x,
      y: position.y,
      z: position.z,
    });

    if (groundBlock === undefined) {
      // Chunk not loaded - will be retried later
      return null;
    }

    // Get block one above ground for spawning (terrain-aware)
    const spawnBlock = dimension.getBlock({
      x: position.x,
      y: groundBlock.location.y + 1,
      z: position.z,
    });

    if (spawnBlock === undefined) {
      // Spawn location not loaded - will be retried later
      return null;
    }

    // Spawn entity at exact terrain-aware location
    const entity = dimension.spawnEntity(entityType, spawnBlock.location);

    // Trigger tier event if specified (for wolves)
    if (tierEvent) {
      entity.triggerEvent(tierEvent);
    }

    return entity;
  }

  /**
   * Attempts to spawn a single entity at terrain-aware position (legacy boolean return)
   * @param dimension - The dimension to spawn in
   * @param position - Spawn position (Y used as starting point)
   * @param entityType - Entity type identifier
   * @param tierEvent - Optional event to trigger on spawned entity
   * @returns true if spawn successful, false if chunk not loaded
   */
  public static trySpawnEntity(
    dimension: Dimension,
    position: Vector3,
    entityType: string,
    tierEvent?: string
  ): boolean {
    // Find ground block at XZ coordinate (using provided Y as starting point)
    const groundBlock = dimension.getBlock({
      x: position.x,
      y: position.y,
      z: position.z,
    });

    if (groundBlock === undefined) {
      // Chunk not loaded - will be retried later
      return false;
    }

    // Get block one above ground for spawning (terrain-aware)
    const spawnBlock = dimension.getBlock({
      x: position.x,
      y: groundBlock.location.y + 1,
      z: position.z,
    });

    if (spawnBlock === undefined) {
      // Spawn location not loaded - will be retried later
      return false;
    }

    return this.trySpawnEntityWithReturn(dimension, position, entityType, tierEvent) !== null;
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
      case SpawnPatternEnum.Circular:
        return this.calculateCircularPositions(center, radius, count);
      case SpawnPatternEnum.Cardinal:
        return this.calculateCardinalPositions(center, radius);
      case SpawnPatternEnum.Diagonal:
        return this.calculateDiagonalPositions(center, radius);
      case SpawnPatternEnum.Custom:
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
