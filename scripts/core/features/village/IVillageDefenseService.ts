import type { Vector3 } from "@minecraft/server";

/**
 * Service for enhancing villages with distance-based defenses
 * Detects villages and applies appropriate defense tiers
 * based on distance from world spawn
 */
export interface IVillageDefenseService {
  /**
   * Enhances a village with defenses based on distance from spawn
   * Supports smart retry logic for failed spawns due to unloaded chunks
   * @param villageLocation - Center coordinates of the village
   */
  enhanceVillage(villageLocation: Vector3): Promise<void>;
}
