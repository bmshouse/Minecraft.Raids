import type { Player, Dimension, Vector3 } from "@minecraft/server";
import { VillageDetection } from "../../GameConstants";
import type { IVillageDetectionService } from "./IVillageDetectionService";
import type { IVillageCache } from "./IVillageCache";
import type { IMessageProvider } from "../../messaging/IMessageProvider";

/**
 * Detects villages by scanning for minecraft:villager entities
 *
 * Advantages:
 * - Reliable and works with current scripting API
 * - Organic discovery during exploration
 * - No command permissions required
 *
 * Limitations:
 * - Requires player to be within scan radius
 * - Only detects generated chunks with villagers
 * - Villages without villagers won't be detected
 *
 * Refactored from existing VillageRaidService implementation
 * Follows Single Responsibility Principle - only handles entity-based detection
 */
export class EntityBasedVillageDetector implements IVillageDetectionService {
  private readonly SCAN_RADIUS = VillageDetection.CLUSTERING_RADIUS;

  constructor(
    private readonly villageCache: IVillageCache,
    private readonly messageProvider: IMessageProvider
  ) {}

  /**
   * Scan for villager entities to detect villages
   * Follows pattern from VillageRaidService.ts (lines 52-63)
   *
   * @param player - Player to scan around
   * @param dimension - Dimension to scan (typically overworld)
   * @returns Array of newly discovered village locations
   */
  public async detectVillages(player: Player, dimension: Dimension): Promise<Vector3[]> {
    // Find nearby villagers
    const nearbyVillagers = dimension.getEntities({
      type: "minecraft:villager",
      location: player.location,
      maxDistance: this.SCAN_RADIUS,
    });

    if (nearbyVillagers.length === 0) {
      return [];
    }

    const discovered: Vector3[] = [];

    // Check each villager to see if it represents a new village
    for (const villager of nearbyVillagers) {
      const location = villager.location;

      // Check if already in cache (uses clustering)
      if (!this.villageCache.hasDiscovered(location)) {
        const added = this.villageCache.addVillage(location, "entity");

        if (added) {
          discovered.push(location);

          // Notify player
          const distance = this.calculateDistance(player.location, location);
          player.sendMessage({
            rawtext: [
              { text: "§a" },
              this.messageProvider.getMessage(
                "mc.raids.village.discovered_entity",
                Math.round(distance).toString()
              ),
            ],
          });

          console.log(
            `[EntityDetector] Discovered village at (${Math.round(location.x)}, ${Math.round(location.z)}) ` +
              `- ${Math.round(distance)}m from ${player.name}`
          );
        }
      }
    }

    return discovered;
  }

  /**
   * Calculate 2D horizontal distance between two positions
   * Follows VillageRaidService.ts pattern (lines 206-210)
   */
  private calculateDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
