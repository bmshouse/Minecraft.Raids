import { Player, world } from "@minecraft/server";
import { IResourceService } from "./IResourceService";

/**
 * Service for managing player resources using world dynamic properties.
 * Resources are persisted across sessions using the dynamic property system.
 */
export class ResourceService implements IResourceService {
  private static readonly EMERALD_PREFIX = "minecraftraids:emeralds_";

  /**
   * Get the dynamic property key for a player's emeralds.
   */
  private getEmeraldKey(player: Player): string {
    return `${ResourceService.EMERALD_PREFIX}${player.name}`;
  }

  getEmeralds(player: Player): number {
    const key = this.getEmeraldKey(player);
    const value = world.getDynamicProperty(key);
    return typeof value === "number" ? value : 0;
  }

  addEmeralds(player: Player, amount: number): void {
    const key = this.getEmeraldKey(player);
    const current = this.getEmeralds(player);
    world.setDynamicProperty(key, current + amount);
  }

  removeEmeralds(player: Player, amount: number): boolean {
    const current = this.getEmeralds(player);
    if (current < amount) {
      return false;
    }
    const key = this.getEmeraldKey(player);
    world.setDynamicProperty(key, current - amount);
    return true;
  }

  hasEmeralds(player: Player, amount: number): boolean {
    return this.getEmeralds(player) >= amount;
  }
}
