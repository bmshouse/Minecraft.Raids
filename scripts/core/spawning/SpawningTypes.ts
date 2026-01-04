/**
 * Spawn pattern determines how positions are calculated relative to center
 */
export enum SpawnPattern {
  Cardinal, // N, S, E, W positions
  Diagonal, // NE, SE, SW, NW positions
  Circular, // Evenly distributed around circle
  Custom, // Explicit position offsets
}

/**
 * Configuration for spawning a group of entities
 */
export interface EntitySpawnConfig {
  entityType: string;
  count: { min: number; max: number };
  radius: number;
  pattern: SpawnPattern;
  tierEvent?: string;
  customPositions?: Array<{ x: number; z: number }>;
}
