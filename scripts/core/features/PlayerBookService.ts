import { world, Player, EntityComponentTypes, EntityTameableComponent, EntityHealthComponent, EntityQueryOptions, type RawMessage, type Entity } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import type { IMessageProvider } from "../messaging/IMessageProvider";
import type { IPlayerBookService } from "./IPlayerBookService";

/**
 * Service for building and displaying the player book UI
 * Provides table of contents navigation to multiple sections:
 * - Player List: Shows currently online players
 * - Raid Party: Placeholder for future NPC party management
 * - Stats: Placeholder for future player statistics
 *
 * Follows Single Responsibility Principle - only handles book UI presentation
 */
export class PlayerBookService implements IPlayerBookService {
  constructor(private readonly messageProvider: IMessageProvider) {}

  /**
   * Main entry point - shows the player book with table of contents
   * @param requestingPlayer - The player who will see the book
   */
  public async showBook(requestingPlayer: Player): Promise<void> {
    await this.showTableOfContents(requestingPlayer);
  }

  /**
   * Shows the table of contents menu with navigation to all sections
   * Routes to appropriate section based on user selection
   */
  private async showTableOfContents(player: Player): Promise<void> {
    const form = new ActionFormData()
      .title(this.messageProvider.getMessage("mc.raids.book.title"))
      .body(this.messageProvider.getMessage("mc.raids.book.body"))
      .button(this.messageProvider.getMessage("mc.raids.book.section.playerlist"))
      .button(this.messageProvider.getMessage("mc.raids.book.section.raidparty"))
      .button(this.messageProvider.getMessage("mc.raids.book.section.stats"));

    const result = await form.show(player);

    if (!result.canceled && result.selection !== undefined) {
      switch (result.selection) {
        case 0:
          await this.showPlayerListSection(player);
          break;
        case 1:
          await this.showRaidPartySection(player);
          break;
        case 2:
          await this.showStatsSection(player);
          break;
      }
    }
  }

  /**
   * Shows the Player List section
   * Displays all currently online players
   */
  private async showPlayerListSection(player: Player): Promise<void> {
    const allPlayers = world.getAllPlayers();

    const form = new ActionFormData()
      .title(this.messageProvider.getMessage("mc.raids.playerlist.title"))
      .body(this.messageProvider.getMessage("mc.raids.playerlist.body"));

    // Add a button for each player
    if (allPlayers.length === 0) {
      // No players (shouldn't happen since requestingPlayer exists, but defensive)
      form.body(this.messageProvider.getMessage("mc.raids.playerlist.noplayers"));
    } else {
      for (const p of allPlayers) {
        form.button(p.name);
      }
    }

    const result = await form.show(player);

    if (!result.canceled && result.selection !== undefined) {
      // Future: Handle player selection (teleport, message, view stats, etc.)
      // For now, form just closes
    }
  }

  /**
   * Shows the Raid Army section
   * Displays all tamed wolves belonging to the player with their health
   * Uses RawMessage for dynamic content combined with translated header
   * Includes comprehensive error handling and diagnostic logging
   */
  private async showRaidPartySection(player: Player): Promise<void> {
    try {
      // Use EntityQueryOptions for server-side filtering - much more efficient
      const queryOptions: EntityQueryOptions = {
        type: "minecraft:wolf",
      };

      console.warn(`[RaidParty] Querying wolves for player ${player.name} (ID: ${player.id})`);
      const allWolves = player.dimension.getEntities(queryOptions);
      console.warn(`[RaidParty] Found ${allWolves.length} total wolves in dimension`);

      // Filter for tamed wolves belonging to this player
      const tamedWolves: Entity[] = [];

      for (const wolf of allWolves) {
        try {
          // Safe component access with explicit error handling
          const tameable = wolf.getComponent(EntityComponentTypes.Tameable) as EntityTameableComponent | undefined;

          if (!tameable) {
            console.warn(`[RaidParty] Wolf at ${JSON.stringify(wolf.location)} has no Tameable component`);
            continue;
          }

          console.warn(`[RaidParty] Wolf isTamed: ${tameable.isTamed}, ownerId: ${tameable.tamedToPlayerId}, playerId: ${player.id}`);

          if (tameable.isTamed && tameable.tamedToPlayerId === player.id) {
            tamedWolves.push(wolf);
          }
        } catch (componentError) {
          console.error(`[RaidParty] Error accessing wolf component:`, componentError);
          // Continue processing other wolves even if one fails
        }
      }

      console.warn(`[RaidParty] Found ${tamedWolves.length} tamed wolves for player ${player.name}`);

      // Build wolf info list
      let bodyText: RawMessage;
      if (tamedWolves.length === 0) {
        bodyText = this.messageProvider.getMessage("mc.raids.raidparty.noentities");
      } else {
        // Build array of wolf stats as RawMessage objects
        const wolfList = tamedWolves.map((wolf, index) => {
          try {
            const health = wolf.getComponent(EntityComponentTypes.Health) as EntityHealthComponent | undefined;
            const currentHP = Math.round(health?.currentValue ?? 0);
            const maxHP = Math.round(health?.defaultValue ?? 20); // Default to 20 if undefined

            return { text: `Wolf #${index + 1} - HP: ${currentHP}/${maxHP}\n` } as RawMessage;
          } catch (error) {
            console.error(`[RaidParty] Error reading wolf health:`, error);
            return { text: `Wolf #${index + 1} - HP: Unknown\n` } as RawMessage;
          }
        });

        // Combine header translation with dynamic wolf list
        bodyText = {
          rawtext: [
            this.messageProvider.getMessage("mc.raids.raidparty.header"),
            { text: "\n\n" },
            ...wolfList,
          ],
        };
      }

      // Show form with wolf list
      const form = new ActionFormData()
        .title(this.messageProvider.getMessage("mc.raids.raidparty.title"))
        .body(bodyText);

      await form.show(player);
    } catch (error) {
      console.error(`[RaidParty] Critical error in showRaidPartySection:`, error);

      // Show error message to player
      const errorForm = new ActionFormData()
        .title(this.messageProvider.getMessage("mc.raids.raidparty.title"))
        .body({ text: "§cError loading raid party. Check content log for details." });

      await errorForm.show(player);
    }
  }

  /**
   * Shows the Stats section
   * Placeholder for future player statistics
   */
  private async showStatsSection(player: Player): Promise<void> {
    const form = new ActionFormData()
      .title(this.messageProvider.getMessage("mc.raids.stats.title"))
      .body(this.messageProvider.getMessage("mc.raids.stats.placeholder"));

    await form.show(player);
    // Form closes when viewed
  }
}
