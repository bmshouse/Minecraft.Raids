import { Player } from "@minecraft/server";

/**
 * Service interface for displaying the player book UI
 * Provides table of contents navigation to multiple sections
 */
export interface IPlayerBookService {
  /**
   * Shows the player book with table of contents navigation
   * User can select from available sections (Player List, Raid Party, Stats)
   * @param requestingPlayer - The player who will see the book
   */
  showBook(requestingPlayer: Player): Promise<void>;
}
