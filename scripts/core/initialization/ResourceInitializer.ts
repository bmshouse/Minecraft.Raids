import { world, system } from "@minecraft/server";
import { IInitializer } from "./IInitializer";
import { IResourceService } from "../resources/IResourceService";
import { IMessageProvider } from "../messaging/IMessageProvider";

/**
 * Initializer that sets up resource tracking and gives players starting resources.
 * Players receive 15 emeralds on their first spawn.
 */
export class ResourceInitializer implements IInitializer {
  private static readonly INITIALIZED_PREFIX = "minecraftraids:initialized_";
  private static readonly STARTING_EMERALDS = 15;

  constructor(
    private readonly resourceService: IResourceService,
    private readonly messageProvider: IMessageProvider
  ) {}

  /**
   * Get the dynamic property key for tracking if a player has been initialized.
   */
  private getInitializedKey(playerName: string): string {
    return `${ResourceInitializer.INITIALIZED_PREFIX}${playerName}`;
  }

  /**
   * Check if a player has already been initialized with starting resources.
   */
  private isPlayerInitialized(playerName: string): boolean {
    const key = this.getInitializedKey(playerName);
    const value = world.getDynamicProperty(key);
    return value === true;
  }

  /**
   * Mark a player as initialized.
   */
  private markPlayerInitialized(playerName: string): void {
    const key = this.getInitializedKey(playerName);
    world.setDynamicProperty(key, true);
  }

  initialize(): void {
    world.afterEvents.playerSpawn.subscribe((event) => {
      const player = event.player;

      // Only give starting resources on initial spawn (not on respawn)
      if (!event.initialSpawn) {
        return;
      }

      // Defer execution by one tick to ensure player is fully initialized
      system.run(() => {
        // Validate player is still valid
        if (!player.isValid) {
          return;
        }

        // Check if player has already received starting resources
        if (this.isPlayerInitialized(player.name)) {
          return;
        }

        // Give starting emeralds
        this.resourceService.addEmeralds(player, ResourceInitializer.STARTING_EMERALDS);

        // Mark player as initialized
        this.markPlayerInitialized(player.name);

        // Send welcome message with resource info
        const message = this.messageProvider.getMessage(
          "mc.raids.starting.resources",
          `You've been given ${ResourceInitializer.STARTING_EMERALDS} emeralds to start your raid party!`
        );
        player.sendMessage(message);
      });
    });
  }
}
