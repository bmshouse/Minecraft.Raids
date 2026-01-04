import { world, system } from "@minecraft/server";
import type { IInitializer } from "./IInitializer";
import type { VillageDiscoveryCoordinator } from "../features/village/VillageDiscoveryCoordinator";

/**
 * Initializer for the village discovery system
 * Coordinates both command-based and entity-based village detection
 *
 * Strategy:
 * - On player spawn: Try command-based detection once per player (efficient but currently non-functional)
 * - Periodic scan: Entity-based detection every 2 seconds (fallback, always works)
 *
 * Single Responsibility: Orchestrate village discovery timing and events
 */
export class VillageDiscoveryInitializer implements IInitializer {
  // Entity scan frequency: every 2 seconds (40 ticks at 20 ticks/second)
  private readonly SCAN_INTERVAL = 40;

  // Track which players have had spawn detection run
  private readonly processedPlayers = new Set<string>();

  constructor(private readonly discoveryCoordinator: VillageDiscoveryCoordinator) {}

  /**
   * Initializes the village discovery system
   * Sets up spawn detection and periodic entity scanning
   */
  public initialize(): void {
    console.log("[VillageDiscovery] Initializing village discovery system...");

    // On player spawn: Run command-based detection once
    world.afterEvents.playerSpawn.subscribe((event) => {
      const player = event.player;

      // Only run once per player per session
      if (this.processedPlayers.has(player.id)) {
        return;
      }

      this.processedPlayers.add(player.id);

      // Run spawn detection (both command and entity)
      // Note: Command detection currently non-functional due to API limitation
      const dimension = world.getDimension("overworld");
      this.discoveryCoordinator.detectAtSpawn(player, dimension);

      console.log(`[VillageDiscovery] Spawn detection triggered for ${player.name}`);
    });

    // Periodic entity-based detection for all players
    system.runInterval(() => {
      const dimension = world.getDimension("overworld");
      const players = world.getAllPlayers();

      for (const player of players) {
        this.discoveryCoordinator.detectNearby(player, dimension);
      }
    }, this.SCAN_INTERVAL);

    console.log(
      `[VillageDiscovery] Village discovery system initialized (scan interval: ${this.SCAN_INTERVAL} ticks)`
    );
  }
}
