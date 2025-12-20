import {
  world,
  PlayerSpawnAfterEvent,
  Player,
  TicksPerSecond,
  ItemLockMode,
  ItemStack,
  EntityInventoryComponent,
} from "@minecraft/server";
import { IInitializer } from "./IInitializer";
import type { IMessageProvider } from "../messaging/IMessageProvider";

/**
 * Initializes and displays welcome messages
 * Follows Single Responsibility Principle - only handles welcome messages
 * Follows Dependency Injection - receives MessageProvider through constructor
 *
 * Uses the Microsoft recommended pattern: subscribe to playerSpawn event
 * rather than trying to send messages at world startup (when no players exist)
 */
export class WelcomeInitializer implements IInitializer {
  /**
   * Constructs a new WelcomeInitializer
   * @param messageProvider - Provider for localized messages
   */
  constructor(private readonly messageProvider: IMessageProvider) {}

  /**
   * Initializes the welcome system by subscribing to player spawn events
   * Messages are sent when players join the world, not at world startup
   */
  public initialize(): void {
    // Subscribe to player spawn events to send welcome messages when players join
    world.afterEvents.playerSpawn.subscribe(this.onPlayerSpawn.bind(this));
  }

  /**
   * Handles player spawn events
   * Sends welcome message when player first joins the world (initialSpawn = true)
   */
  private onPlayerSpawn(event: PlayerSpawnAfterEvent): void {
    // Only send welcome message when player first joins the world
    if (event.initialSpawn) {
      this.displayWelcomeMessage(event.player);
    }
  }

  /**
   * Displays the welcome message to a specific player
   * Centralized method to avoid duplication (DRY principle)
   * Shows both on-screen title and chat messages
   * Gives player the Player Directory book
   *
   * Uses RawMessage with translate to read messages from .lang file
   */
  private displayWelcomeMessage(player: Player): void {
    const welcomeMessage = this.messageProvider.getMessage("mc.raids.welcome");
    const initMessage = this.messageProvider.getMessage("mc.raids.initialized");
    const versionMessage = this.messageProvider.getMessage("mc.raids.version");
    const bookMessage = this.messageProvider.getMessage("mc.raids.playerlist.received");

    // Display on-screen title with subtitle
    // setTitle accepts RawMessage directly
    player.onScreenDisplay.setTitle(welcomeMessage, {
      fadeInDuration: 1 * TicksPerSecond,    // 1 second fade in
      fadeOutDuration: 2 * TicksPerSecond,   // 2 seconds fade out
      stayDuration: 5 * TicksPerSecond,      // Display for 5 seconds
      subtitle: {
        rawtext: [initMessage, { text: "\n" }, versionMessage],
      },
    });

    // Also send to chat for reference
    // sendMessage accepts RawMessage directly
    player.sendMessage({
      rawtext: [{ text: "§6" }, welcomeMessage],
    });

    player.sendMessage({
      rawtext: [{ text: "§e" }, initMessage],
    });

    player.sendMessage({
      rawtext: [{ text: "§f" }, versionMessage],
    });

    // Give player the Player Directory book (locked to prevent dropping)
    // First, check if they already have one to prevent duplicates
    const inventory = player.getComponent("inventory") as EntityInventoryComponent;
    if (inventory?.container) {
      let hasBook = false;

      // Scan inventory to see if player already has the book
      for (let i = 0; i < inventory.container.size; i++) {
        const item = inventory.container.getItem(i);
        if (item?.typeId === "minecraft_raids:player_list_book") {
          hasBook = true;
          break;
        }
      }

      // Only give book if they don't already have one
      if (!hasBook) {
        player.sendMessage({
          rawtext: [{ text: "§a" }, bookMessage],
        });

        const player_book = new ItemStack("minecraft_raids:player_list_book", 1);
        player_book.keepOnDeath = true;
        player_book.lockMode = ItemLockMode.slot;

        inventory.container.addItem(player_book);
      }
    }
  }
}
