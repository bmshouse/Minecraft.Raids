import type { Vector3 } from "@minecraft/server";

/**
 * Distance calculation utilities for Minecraft world space
 */
export class DistanceUtils {
  /**
   * Calculate horizontal (2D) distance between two positions
   * Uses only x and z coordinates, ignoring height (y)
   * This is Minecraft's standard for distance-based mechanics
   */
  public static calculateHorizontalDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Calculate full 3D Euclidean distance (if needed for other features)
   */
  public static calculate3DDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
