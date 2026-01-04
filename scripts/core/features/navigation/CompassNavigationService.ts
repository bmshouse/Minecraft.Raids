import type { Player } from "@minecraft/server";
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
   * Get compass target - currently just returns nearest unconquered village
   * In future, could support manual village selection
   */
  public getCompassTarget(player: Player): NearestVillageInfo | null {
    return this.getNearestUnconqueredVillage(player);
  }

  /**
   * Update player's compass to point to nearest unconquered village
   * Shows action bar message with distance and direction
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

    // Show action bar with tier, distance and direction
    player.onScreenDisplay.setActionBar({
      rawtext: [
        { text: "§6" },
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
}
