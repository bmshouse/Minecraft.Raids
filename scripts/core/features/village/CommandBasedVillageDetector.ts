import type { Player, Dimension, Vector3 } from "@minecraft/server";
import type { IVillageDetectionService } from "./IVillageDetectionService";

/**
 * Command-based village detector (CURRENTLY NON-FUNCTIONAL)
 *
 * IMPORTANT API LIMITATION:
 * The Minecraft Bedrock Scripting API's runCommand() method does NOT return
 * command output text - it only returns {successCount: number}.
 *
 * The `/locate structure village` command sends coordinates to chat/logs,
 * which are NOT accessible via the scripting API.
 *
 * Possible Future Solutions:
 * 1. Wait for API enhancement to expose command output
 * 2. Use experimental chat message listening (if available)
 * 3. Rely entirely on entity-based detection (current approach)
 *
 * Current Behavior:
 * - Always returns empty array
 * - Logs API limitation warning
 * - Entity-based detection should be used instead
 *
 * This class exists for:
 * - Future API compatibility when command output becomes accessible
 * - Documentation of the attempted approach
 * - Maintaining the IVillageDetectionService interface
 *
 * Follows Single Responsibility Principle - only handles command-based detection
 */
export class CommandBasedVillageDetector implements IVillageDetectionService {
  /**
   * Attempt command-based detection (currently non-functional)
   *
   * @returns Empty array due to API limitations
   */
  public async detectVillages(_player: Player, _dimension: Dimension): Promise<Vector3[]> {
    // API Limitation: CommandResult has no output text property
    // Cannot parse /locate command coordinates
    console.warn(
      `[CommandDetector] API Limitation: runCommand() does not return output text. ` +
        `Cannot parse /locate coordinates. Use EntityBasedVillageDetector instead.`
    );

    return [];

    /* FUTURE IMPLEMENTATION (when API supports command output):
     *
     * Required dependencies (will be injected via constructor):
     * - villageCache: IVillageCache
     * - messageProvider: IMessageProvider
     *
     * const result = dimension.runCommand("locate structure village");
     * const coords = this.parseLocateResponse(result.output); // hypothetical property
     *
     * if (coords && !villageCache.hasDiscovered(coords)) {
     *   const distance = calculateDistance(player.location, coords);
     *
     *   if (distance <= MAX_SEARCH_RADIUS) {
     *     villageCache.addVillage(coords, "command");
     *     player.sendMessage({
     *       rawtext: [
     *         { text: "§a" },
     *         messageProvider.getMessage("mc.raids.village.discovered_command", distance.toString())
     *       ]
     *     });
     *     return [coords];
     *   }
     * }
     *
     * return [];
     */
  }
}
