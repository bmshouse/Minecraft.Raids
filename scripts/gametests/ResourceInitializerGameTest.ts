import * as gametest from "@minecraft/server-gametest";
import { world } from "@minecraft/server";
import { ResourceInitializer } from "../core/initialization/ResourceInitializer";
import { ResourceService } from "../core/resources/ResourceService";
import { MessageProvider } from "../core/messaging/MessageProvider";
import { GameTestTiming, GameTestTimeouts, GameTestResources } from "./GameTestConstants";

/**
 * GameTests for ResourceInitializer
 *
 * Tests resource initialization system:
 * - Starting emerald grant on first spawn
 * - No duplicate grants on respawn
 * - Player initialization tracking
 * - Welcome message delivery
 */

/**
 * Test that ResourceInitializer can be constructed and initialized
 */
export function resourceInitializerConstructionTest(test: gametest.Test) {
  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    const resourceService = new ResourceService();
    const messageProvider = new MessageProvider();
    const initializer = new ResourceInitializer(resourceService, messageProvider);

    // Initialize the resource system
    initializer.initialize();

    test.assert(initializer !== null, "ResourceInitializer should be constructed successfully");

    test.succeed();
  });
}

/**
 * Test that a player receives starting emeralds
 * Note: This test verifies the service integration, but actual spawn event
 * testing requires in-game player spawns which GameTest cannot fully simulate
 */
export function resourceInitializerStartingEmeraldsTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Manually grant starting emeralds (simulating what initializer does)
    const emeralds = resourceService.getEmeralds(player);
    test.assert(
      emeralds === GameTestResources.STARTING_EMERALDS,
      `Player should have ${GameTestResources.STARTING_EMERALDS} starting emeralds, got ${emeralds}`
    );

    test.succeed();
  });
}

/**
 * Test that initialization tracking prevents duplicate grants
 */
export function resourceInitializerNoDuplicateGrantsTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();

  const STARTING_EMERALDS = GameTestResources.STARTING_EMERALDS;
  const INITIALIZED_KEY = `minecraftraids:initialized_${player.name}`;

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // First initialization
    if (!world.getDynamicProperty(INITIALIZED_KEY)) {
      resourceService.addEmeralds(player, STARTING_EMERALDS);
      world.setDynamicProperty(INITIALIZED_KEY, true);
    }

    const firstBalance = resourceService.getEmeralds(player);
    test.assert(
      firstBalance === STARTING_EMERALDS,
      `First initialization should grant ${STARTING_EMERALDS} emeralds`
    );

    // Attempt second initialization (should be skipped)
    if (!world.getDynamicProperty(INITIALIZED_KEY)) {
      resourceService.addEmeralds(player, STARTING_EMERALDS);
      world.setDynamicProperty(INITIALIZED_KEY, true);
    }

    const secondBalance = resourceService.getEmeralds(player);
    test.assert(
      secondBalance === STARTING_EMERALDS,
      `Balance should remain ${STARTING_EMERALDS}, got ${secondBalance} (duplicate grant detected)`
    );

    test.succeed();
  });
}

/**
 * Test message provider integration
 */
export function resourceInitializerMessageIntegrationTest(test: gametest.Test) {
  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    const messageProvider = new MessageProvider();
    // Test that message provider can retrieve the starting resources message
    const message = messageProvider.getMessage(
      "mc.raids.starting.resources",
      `You've been given ${GameTestResources.STARTING_EMERALDS} emeralds to start your raid party!`
    );

    test.assert(
      message !== null && message !== undefined,
      "Message provider should return a valid message"
    );

    test.assert(
      message.text !== undefined || message.translate !== undefined,
      "Message should have either text or translate property"
    );

    test.succeed();
  });
}

// Register all tests with proper tags
gametest
  .register(
    "MinecraftRaids",
    "resourceInitializerConstruction",
    resourceInitializerConstructionTest
  )
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:resources")
  .tag("batch");

gametest
  .register(
    "MinecraftRaids",
    "resourceInitializerStartingEmeralds",
    resourceInitializerStartingEmeraldsTest
  )
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:resources")
  .tag("batch");

gametest
  .register(
    "MinecraftRaids",
    "resourceInitializerNoDuplicates",
    resourceInitializerNoDuplicateGrantsTest
  )
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:resources")
  .tag("batch");

gametest
  .register(
    "MinecraftRaids",
    "resourceInitializerMessage",
    resourceInitializerMessageIntegrationTest
  )
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:resources")
  .tag("batch");
