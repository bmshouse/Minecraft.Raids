import { world, system } from "@minecraft/server";
import { IInitializer } from "./IInitializer";
import type { IVillageDefenseService } from "../features/village/IVillageDefenseService";

/**
 * Initializes the village defense enhancement system
 * Uses periodic scanning to detect villages (events don't work in this MC version)
 * and applies distance-based defenses
 */
export class VillageDefenseInitializer implements IInitializer {
  constructor(private readonly defenseService: IVillageDefenseService) {}

  /**
   * Starts periodic village scanning
   * Scans for villagers near players every 5 seconds
   */
  public initialize(): void {
    console.log("[VillageDefense] VillageDefenseInitializer.initialize() called");

    // Run periodic scan every 100 ticks (5 seconds)
    system.runInterval(() => {
      this.scanForVillages();
    }, 100);

    console.log("[VillageDefense] Started periodic village scanning (every 5 seconds)");
  }

  /**
   * Scans for villages near all players
   * Only scans loaded chunks (within player proximity)
   */
  private scanForVillages(): void {
    try {
      const dimension = world.getDimension("overworld");
      const players = world.getAllPlayers();

      // Scan around each player
      for (const player of players) {
        // Find villagers within 150 blocks (loaded chunk radius)
        const nearbyVillagers = dimension.getEntities({
          type: "minecraft:villager",
          location: player.location,
          maxDistance: 150
        });

        // Process each unique village
        for (const villager of nearbyVillagers) {
          const villageLocation = villager.location;

          // Log detection
          console.log(
            `[VillageDefense] Village detected at (${Math.round(villageLocation.x)}, ${Math.round(villageLocation.y)}, ${Math.round(villageLocation.z)})`
          );

          // Enhance village (fire and forget)
          // State checking happens in enhanceVillage() - skips if fully defended, retries failed spawns if partially defended
          this.defenseService.enhanceVillage(villageLocation).catch((error) => {
            console.log(
              `[VillageDefense] ERROR enhancing village at (${Math.round(villageLocation.x)}, ${Math.round(villageLocation.z)}): ${error}`
            );
          });

          // Only process one villager per scan to avoid spamming
          // The village's defense state is tracked internally, so other villagers will be skipped next scan
          break;
        }
      }
    } catch (error) {
      console.log(`[VillageDefense] Error in scanForVillages: ${error}`);
    }
  }
}
