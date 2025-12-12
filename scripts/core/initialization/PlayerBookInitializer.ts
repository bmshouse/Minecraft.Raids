import { world, ItemUseAfterEvent, Player } from "@minecraft/server";
import { IInitializer } from "./IInitializer";
import type { IPlayerBookService } from "../features/IPlayerBookService";

/**
 * Initializes player book functionality
 * Follows Single Responsibility Principle - only handles book item usage
 * Follows Dependency Injection - receives PlayerBookService through constructor
 *
 * Uses the Minecraft pattern: subscribe to itemUse event to detect book usage
 * and display the player book with table of contents navigation
 */
export class PlayerBookInitializer implements IInitializer {
  private readonly PLAYER_BOOK_ID = "minecraft_raids:player_list_book";

  /**
   * Constructs a new PlayerBookInitializer
   * @param playerBookService - Service for displaying the player book
   */
  constructor(private readonly playerBookService: IPlayerBookService) {}

  /**
   * Initializes the player book system by subscribing to item use events
   */
  public initialize(): void {
    world.afterEvents.itemUse.subscribe(this.onItemUse.bind(this));
  }

  /**
   * Handles item use events
   * Shows player book when the special book is used
   */
  private onItemUse(event: ItemUseAfterEvent): void {
    if (event.itemStack.typeId === this.PLAYER_BOOK_ID) {
      this.playerBookService.showBook(event.source as Player);
    }
  }
}
