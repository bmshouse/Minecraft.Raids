import * as gametest from "@minecraft/server-gametest";
import { ResourceService } from "../core/resources/ResourceService";
import { GameTestTiming, GameTestTimeouts, GameTestResources } from "./GameTestConstants";

/**
 * GameTests for ResourceService
 *
 * Tests resource management with actual Minecraft dynamic properties:
 * - Initial resource allocation
 * - Resource addition and balance updates
 * - Resource deduction with validation
 * - Insufficient funds error handling
 * - Resource persistence
 */

/**
 * Test that a new player starts with 0 emeralds
 */
export function resourceServiceInitialBalanceTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    const emeralds = resourceService.getEmeralds(player);

    test.assert(
      emeralds === GameTestResources.STARTING_EMERALDS,
      `New player should start with ${GameTestResources.STARTING_EMERALDS} emeralds, got ${emeralds}`
    );

    test.succeed();
  });
}

/**
 * Test adding emeralds to a player
 */
export function resourceServiceAddEmeraldsTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Add 100 emeralds
    resourceService.addEmeralds(player, 85);

    const emeralds = resourceService.getEmeralds(player);
    test.assert(
      emeralds === 100,
      `Player should have 100 emeralds after addition, got ${emeralds}`
    );

    // Add 50 more
    resourceService.addEmeralds(player, 50);

    const updatedEmeralds = resourceService.getEmeralds(player);
    test.assert(
      updatedEmeralds === 150,
      `Player should have 150 emeralds after second addition, got ${updatedEmeralds}`
    );

    test.succeed();
  });
}

/**
 * Test removing emeralds from a player with sufficient funds
 */
export function resourceServiceRemoveEmeraldsSuccessTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Give player 100 emeralds
    resourceService.addEmeralds(player, 100);

    // Remove 30 emeralds
    const success = resourceService.removeEmeralds(player, 30);

    test.assert(
      success === true,
      "removeEmeralds should return true when player has sufficient funds"
    );

    const emeralds = resourceService.getEmeralds(player);
    test.assert(emeralds === 85, `Player should have 85 emeralds after removal, got ${emeralds}`);

    test.succeed();
  });
}

/**
 * Test removing emeralds fails when player has insufficient funds
 */
export function resourceServiceRemoveEmeraldsFailureTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Give player only 50 emeralds
    resourceService.addEmeralds(player, 50);

    // Try to remove 100 emeralds
    const success = resourceService.removeEmeralds(player, 100);

    test.assert(
      success === false,
      "removeEmeralds should return false when player has insufficient funds"
    );

    const emeralds = resourceService.getEmeralds(player);
    test.assert(
      emeralds === 65,
      `Player balance should remain unchanged at 65 emeralds, got ${emeralds}`
    );

    test.succeed();
  });
}

/**
 * Test hasEmeralds check
 */
export function resourceServiceHasEmeraldsTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Give player 100 emeralds
    resourceService.addEmeralds(player, 85);

    test.assert(
      resourceService.hasEmeralds(player, 50) === true,
      "hasEmeralds should return true when player has sufficient funds"
    );

    test.assert(
      resourceService.hasEmeralds(player, 100) === true,
      "hasEmeralds should return true when amount equals balance"
    );

    test.assert(
      resourceService.hasEmeralds(player, 150) === false,
      "hasEmeralds should return false when amount exceeds balance"
    );

    test.succeed();
  });
}

/**
 * Test resource persistence across multiple operations
 */
export function resourceServicePersistenceTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Multiple operations
    resourceService.addEmeralds(player, 85);
    resourceService.removeEmeralds(player, 25);
    resourceService.addEmeralds(player, 50);
    resourceService.removeEmeralds(player, 10);

    const finalBalance = resourceService.getEmeralds(player);
    test.assert(
      finalBalance === 115,
      `Final balance should be 115 (100 - 25 + 50 - 10), got ${finalBalance}`
    );

    // Verify persistence by creating a new service instance
    const newServiceInstance = new ResourceService();
    const persistedBalance = newServiceInstance.getEmeralds(player);

    test.assert(
      persistedBalance === 115,
      `Balance should persist across service instances, got ${persistedBalance}`
    );

    test.succeed();
  });
}

// Register all tests with proper tags
gametest
  .register("MinecraftRaids", "resourceServiceInitialBalance", resourceServiceInitialBalanceTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:resources")
  .tag("batch");

gametest
  .register("MinecraftRaids", "resourceServiceAddEmeralds", resourceServiceAddEmeraldsTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:resources")
  .tag("batch");

gametest
  .register(
    "MinecraftRaids",
    "resourceServiceRemoveSuccess",
    resourceServiceRemoveEmeraldsSuccessTest
  )
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:resources")
  .tag("batch");

gametest
  .register(
    "MinecraftRaids",
    "resourceServiceRemoveFailure",
    resourceServiceRemoveEmeraldsFailureTest
  )
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:resources")
  .tag("batch");

gametest
  .register("MinecraftRaids", "resourceServiceHasEmeralds", resourceServiceHasEmeraldsTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:resources")
  .tag("batch");

gametest
  .register("MinecraftRaids", "resourceServicePersistence", resourceServicePersistenceTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:resources")
  .tag("batch");
