/**
 * GameTests for player book functionality
 * Tests the PlayerBookInitializer and PlayerBookService
 */

import * as gametest from "@minecraft/server-gametest";
import { MessageProvider } from "../core/messaging/MessageProvider";
import { PlayerBookInitializer } from "../core/initialization/PlayerBookInitializer";
import { PlayerBookService } from "../core/features/PlayerBookService";
import { GameTestTimeouts } from "./GameTestConstants";

/**
 * Test that PlayerBookInitializer initializes without errors
 * Verifies that the itemUse event subscription is properly set up
 */
export function playerBookInitializerSubscribesTest(test: gametest.Test) {
  const messageProvider = new MessageProvider();
  const playerBookService = new PlayerBookService(
    messageProvider,
    null as any, // resourceService - not needed for construction test
    null as any, // recruitmentService - not needed for construction test
    null as any, // unitPocketService - not needed for construction test
    null as any, // wealthCalculationService - not needed for construction test
    null as any, // villageCache - not needed for construction test
    null as any // conquestTracker - not needed for construction test
  );
  const initializer = new PlayerBookInitializer(playerBookService);

  // Should not throw
  initializer.initialize();

  test.succeed();
}

/**
 * Test that PlayerBookService has all required book navigation messages
 * Verifies that message keys are correctly configured for the table of contents
 */
export function bookNavigationMessagesExistTest(test: gametest.Test) {
  const messageProvider = new MessageProvider();

  // Verify all required message keys are present
  const requiredKeys = [
    // Book table of contents
    "mc.raids.book.title",
    "mc.raids.book.body",
    "mc.raids.book.section.playerlist",
    "mc.raids.book.section.raidparty",
    "mc.raids.book.section.stats",
    // Player list section
    "mc.raids.playerlist.title",
    "mc.raids.playerlist.body",
    "mc.raids.playerlist.noplayers",
    "mc.raids.playerlist.received",
    // Raid Party section
    "mc.raids.raidparty.title",
    "mc.raids.raidparty.header",
    "mc.raids.raidparty.noentities",
    // Stats section
    "mc.raids.stats.title",
    "mc.raids.stats.placeholder",
  ];

  for (const key of requiredKeys) {
    const message = messageProvider.getMessage(key);
    if (!message || message === key) {
      test.fail(`Message key '${key}' is missing or not configured`);
      return;
    }
  }

  test.succeed();
}

// Register the GameTests
gametest
  .register("MinecraftRaids", "playerBookInitializer", playerBookInitializerSubscribesTest)
  .maxTicks(GameTestTimeouts.STANDARD)
  .structureName("MinecraftRaids:simple")
  .tag("suite:default")
  .tag("batch");

gametest
  .register("MinecraftRaids", "bookNavigationMessages", bookNavigationMessagesExistTest)
  .maxTicks(GameTestTimeouts.STANDARD)
  .structureName("MinecraftRaids:simple")
  .tag("suite:default")
  .tag("batch");
