import type { Player } from "@minecraft/server";
import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import type { IMessageProvider } from "../../messaging/IMessageProvider";
import type { ICompassNavigationService, NearestVillageInfo } from "./ICompassNavigationService";
import type { ConquestTracker } from "../village/ConquestTracker";
import type { IVillageCache } from "../village/IVillageCache";
import { DistanceUtils } from "../../utils/DistanceUtils";

/**
 * Compass navigation service using VillageCache
 *
 * Updated to use persistent village cache instead of runtime entity scanning
 * Benefits:
 * - No expensive entity queries at runtime
 * - Shows all discovered villages, not just nearby ones
 * - Consistent with village raid system
 * - Works even when chunks aren't loaded
 */
export class CompassNavigationService implements ICompassNavigationService {
  private readonly PLAYER_SELECTION_PREFIX = "minecraftraids:compass_target_";

  constructor(
    private readonly messageProvider: IMessageProvider,
    private readonly conquestTracker: ConquestTracker,
    private readonly villageCache: IVillageCache
  ) {}

  /**
   * Find nearest village that player hasn't conquered yet (not on cooldown)
   * Uses VillageCache instead of runtime entity scanning
   */
  public getNearestUnconqueredVillage(player: Player): NearestVillageInfo | null {
    const playerPos = player.location;

    // Get all discovered villages from cache
    const allVillages = this.villageCache.getDiscoveredVillages();

    if (allVillages.length === 0) {
      return null;
    }

    let nearestVillage: NearestVillageInfo | null = null;
    let nearestDistance = Infinity;

    for (const village of allVillages) {
      // Check if player can conquer this village (not on cooldown)
      if (!this.conquestTracker.canConquer(player.id, village.key)) {
        continue; // Village on cooldown, skip
      }

      // Calculate distance
      const distance = DistanceUtils.calculateHorizontalDistance(playerPos, village.location);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestVillage = {
          position: village.location,
          tier: this.calculateTier(village.location),
          distance: Math.round(distance),
          villageKey: village.key,
        };
      }
    }

    return nearestVillage;
  }

  /**
   * Get compass target - respects manual selection if valid
   * Falls back to nearest unconquered if no selection or selection invalid
   */
  public getCompassTarget(player: Player): NearestVillageInfo | null {
    // Check for manual selection first
    const selectedKey = this.getSelectedVillage(player);
    if (selectedKey) {
      const allVillages = this.villageCache.getDiscoveredVillages();
      const village = allVillages.find((v) => v.key === selectedKey);

      // Validate: village exists and can be conquered
      if (village && this.conquestTracker.canConquer(player.id, village.key)) {
        const distance = DistanceUtils.calculateHorizontalDistance(
          player.location,
          village.location
        );
        return {
          position: village.location,
          tier: this.calculateTier(village.location),
          distance: Math.round(distance),
          villageKey: village.key,
        };
      } else {
        // Selection invalid - clear it
        this.setSelectedVillage(player, null);
      }
    }

    // No valid manual selection - use automatic targeting
    return this.getNearestUnconqueredVillage(player);
  }

  /**
   * Update player's compass to point to target village
   * Shows action bar message with distance, direction, and selection indicator
   */
  public updateCompass(player: Player): void {
    const target = this.getCompassTarget(player);

    if (!target) {
      // No unconquered villages nearby - show message
      player.onScreenDisplay.setActionBar({
        rawtext: [
          { text: "§e" },
          this.messageProvider.getMessage(
            "mc.raids.compass.novillages",
            "No unconquered villages nearby"
          ),
        ],
      });
      return;
    }

    const direction = this.getDirectionArrow(player, target.position);
    const tierName = this.getTierName(target.tier);
    const selectedKey = this.getSelectedVillage(player);
    const isManualSelection = selectedKey === target.villageKey;

    // Show selection indicator in action bar
    const prefix = isManualSelection ? "§6[S] " : "§6"; // [S] = Selected

    // Show action bar with tier, distance and direction
    player.onScreenDisplay.setActionBar({
      rawtext: [
        { text: prefix },
        { text: tierName },
        { text: ` §f${target.distance}m ${direction}` },
      ],
    });
  }

  /**
   * Calculate tier based on distance from spawn (0,0)
   * Tier 0: 0-500 blocks (no defenders)
   * Tier 1: 500-1000 blocks (Light)
   * Tier 2: 1000-2000 blocks (Medium)
   * Tier 3: 2000+ blocks (Heavy)
   */
  private calculateTier(location: { x: number; y: number; z: number }): number {
    const distanceFromSpawn = Math.sqrt(location.x ** 2 + location.z ** 2);

    if (distanceFromSpawn < 500) return 0;
    if (distanceFromSpawn < 1000) return 1;
    if (distanceFromSpawn < 2000) return 2;
    return 3;
  }

  /**
   * Get tier display name
   */
  private getTierName(tier: number): string {
    switch (tier) {
      case 0:
        return "Peaceful Village";
      case 1:
        return "Light Defense";
      case 2:
        return "Medium Defense";
      case 3:
        return "Heavy Defense";
      default:
        return "Unknown";
    }
  }

  /**
   * Returns an arrow showing which way the player should move
   * to reach the target X,Z coordinate.
   *
   * ↑ = forward
   * ↓ = backward
   * → = right
   * ← = left
   * ↗ ↘ ↙ ↖ = diagonals
   */
  private getDirectionArrow(player: Player, target: { x: number; z: number }): string {
    // --- 1. Vector from player → target ---
    const dx = target.x - player.location.x;
    const dz = target.z - player.location.z;

    // Normalize target direction
    const len = Math.hypot(dx, dz);
    const tx = dx / len;
    const tz = dz / len;

    // --- 2. Player facing direction as a unit vector ---
    const yawRad = (player.getRotation().y * Math.PI) / 180;

    // Minecraft yaw: 0 = south, rotates clockwise
    // Convert to a forward vector:
    const fx = -Math.sin(yawRad);
    const fz = Math.cos(yawRad);

    // --- 3. Compute relative direction using dot + cross ---
    const dot = fx * tx + fz * tz; // forward/backward
    const cross = fx * tz - fz * tx; // left/right

    // Convert to angle (0° = forward)
    const angle = (Math.atan2(cross, dot) * 180) / Math.PI;
    const normalized = (angle + 360) % 360;

    // --- 4. Convert relative angle → arrow ---
    return this.angleToArrow(normalized);
  }

  /** Converts a relative angle (0–360) into a movement arrow */
  private angleToArrow(a: number): string {
    if (a >= 337.5 || a < 22.5) return "↑";
    if (a >= 22.5 && a < 67.5) return "↗";
    if (a >= 67.5 && a < 112.5) return "→";
    if (a >= 112.5 && a < 157.5) return "↘";
    if (a >= 157.5 && a < 202.5) return "↓";
    if (a >= 202.5 && a < 247.5) return "↙";
    if (a >= 247.5 && a < 292.5) return "←";
    return "↖";
  }

  /**
   * Set player's manually selected village target
   * Stores selection in DynamicProperties for persistence
   */
  public setSelectedVillage(player: Player, villageKey: string | null): void {
    const key = `${this.PLAYER_SELECTION_PREFIX}${player.id}`;

    if (villageKey === null) {
      world.setDynamicProperty(key, undefined); // Clear selection
    } else {
      world.setDynamicProperty(key, villageKey);
    }
  }

  /**
   * Get player's manually selected village key
   * Retrieves from DynamicProperties
   */
  public getSelectedVillage(player: Player): string | null {
    const key = `${this.PLAYER_SELECTION_PREFIX}${player.id}`;
    const data = world.getDynamicProperty(key);
    return typeof data === "string" ? data : null;
  }

  /**
   * Show village selection UI when compass is right-clicked
   * Displays all discovered villages with distance, status, and selection buttons
   */
  public async showVillageSelectionUI(player: Player): Promise<void> {
    const allVillages = this.villageCache.getDiscoveredVillages();

    const form = new ActionFormData()
      .title(this.messageProvider.getMessage("mc.raids.compass.villages.title", "Village Compass"))
      .body(
        this.messageProvider.getMessage(
          "mc.raids.compass.villages.body",
          `${allVillages.length} villages discovered. Select a target or close to auto-target.`
        )
      );

    if (allVillages.length === 0) {
      form.body(
        this.messageProvider.getMessage(
          "mc.raids.compass.villages.none",
          "No villages discovered yet. Explore to find villages!"
        )
      );
      await form.show(player);
      return;
    }

    // Sort by distance
    const villagesWithDistance = allVillages.map((village) => {
      const distance = DistanceUtils.calculateHorizontalDistance(player.location, village.location);
      return { village, distance };
    });
    villagesWithDistance.sort((a, b) => a.distance - b.distance);

    // Add "Clear Selection" button first if there's a current selection
    const selectedKey = this.getSelectedVillage(player);
    const buttonMap: (string | null)[] = []; // Track button index → village key

    if (selectedKey) {
      form.button(
        this.messageProvider.getMessage(
          "mc.raids.compass.clear_selection",
          "✖ Clear Selection (Auto-Target)"
        )
      );
      buttonMap.push(null); // null = clear selection
    }

    // Add village buttons
    for (const { village, distance } of villagesWithDistance) {
      const canConquer = this.conquestTracker.canConquer(player.id, village.key);

      let statusIcon: string;
      let statusText: string;
      let colorCode: string;

      if (!canConquer) {
        const cooldown = this.conquestTracker.getFormattedCooldown(player.id, village.key);
        statusIcon = "[C]"; // [C] = Cooldown
        statusText = `Cooldown: ${cooldown}`;
        colorCode = "§c"; // Red for cooldown
      } else if (village.key === selectedKey) {
        statusIcon = "[S]"; // [S] = Selected
        statusText = "SELECTED";
        colorCode = "§6"; // Gold for selected
      } else {
        statusIcon = "[R]"; // [R] = Ready
        statusText = "Ready";
        colorCode = "§a"; // Green for ready
      }

      const tierName = this.getTierName(this.calculateTier(village.location));
      const distanceText = Math.round(distance);
      const buttonText = `${colorCode}${statusIcon}§r ${tierName} - ${distanceText}m - ${statusText}`;

      form.button(buttonText);
      buttonMap.push(village.key);
    }

    const response = await form.show(player);

    if (response.canceled || response.selection === undefined) {
      return; // User closed form
    }

    const buttonIndex = response.selection;
    const selectedVillageKey = buttonMap[buttonIndex];

    if (selectedVillageKey === null) {
      // Clear selection button clicked
      this.setSelectedVillage(player, null);
      player.sendMessage({
        rawtext: [
          { text: "§a" },
          this.messageProvider.getMessage(
            "mc.raids.compass.selection_cleared",
            "Compass now auto-targeting nearest village"
          ),
        ],
      });
    } else {
      // Village selected
      const village = allVillages.find((v) => v.key === selectedVillageKey);
      if (village && this.conquestTracker.canConquer(player.id, village.key)) {
        this.setSelectedVillage(player, selectedVillageKey);
        const distance = Math.round(
          DistanceUtils.calculateHorizontalDistance(player.location, village.location)
        );
        player.sendMessage({
          rawtext: [
            { text: "§a" },
            this.messageProvider.getMessage(
              "mc.raids.compass.village_selected",
              `Village selected: ${distance}m away`
            ),
          ],
        });
      } else {
        // Village on cooldown - show error
        player.sendMessage({
          rawtext: [
            { text: "§c" },
            this.messageProvider.getMessage(
              "mc.raids.compass.cannot_select",
              "Cannot select village on cooldown"
            ),
          ],
        });
      }
    }
  }
}
