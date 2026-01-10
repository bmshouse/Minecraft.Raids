/**
 * GameTests for Raid Party functionality
 * Tests wolf taming, querying, and UI display
 */

import * as gametest from "@minecraft/server-gametest";
import {
  EntityComponentTypes,
  EntityTameableComponent,
  EntityHealthComponent,
  EntityQueryOptions,
} from "@minecraft/server";
import { MessageProvider } from "../core/messaging/MessageProvider";
import { PlayerBookService } from "../core/features/PlayerBookService";
import { GameTestTimeouts } from "./GameTestConstants";

/**
 * Test that wolves can be spawned and have tameable component
 * Verifies the taming component exists on wolves
 */
export function wolfTamingTest(test: gametest.Test) {
  // Spawn a wolf
  const wolf = test.spawn("minecraft:wolf", { x: 1, y: 0, z: 0 });
  // Initialize wolf with entity_spawned event (adds wolf_wild component group)
  wolf.triggerEvent("minecraft:entity_spawned");

  // Get tameable component
  const tameable = wolf.getComponent(EntityComponentTypes.Tameable) as
    | EntityTameableComponent
    | undefined;

  test.assert(tameable !== undefined, "Wolf should have Tameable component");
  test.assert(!tameable?.isTamed, "Wolf should start untamed");

  // Get a simulated player for taming
  const player = test.spawnSimulatedPlayer({ x: 0, y: 0, z: 0 }, "TestPlayer");

  // Use the tame() method - this sets API-level tame state
  if (tameable) {
    tameable.tame(player);
  }

  // Schedule check after taming
  test.runAtTickTime(10, () => {
    const tameableAfter = wolf.getComponent(EntityComponentTypes.Tameable) as
      | EntityTameableComponent
      | undefined;
    test.assert(tameableAfter?.isTamed === true, "Wolf should be tamed after event");
    test.succeed();
  });
}

/**
 * Test that wolves can be queried with EntityQueryOptions
 * Verifies entity querying works correctly
 */
export function wolfQueryTest(test: gametest.Test) {
  // Spawn multiple wolves
  test.spawn("minecraft:wolf", { x: 1, y: 0, z: 0 });
  test.spawn("minecraft:wolf", { x: 2, y: 0, z: 0 });
  test.spawn("minecraft:wolf", { x: 3, y: 0, z: 0 });

  test.runAtTickTime(5, () => {
    // Query all wolves in dimension using EntityQueryOptions
    const queryOptions: EntityQueryOptions = {
      type: "minecraft:wolf",
    };
    const allWolves = test.getDimension().getEntities(queryOptions);
    test.assert(allWolves.length >= 3, `Should find at least 3 wolves, found ${allWolves.length}`);
    test.succeed();
  });
}

/**
 * Test that wolves have health component
 * Verifies HP display will work correctly
 */
export function wolfHealthTest(test: gametest.Test) {
  const wolf = test.spawn("minecraft:wolf", { x: 0, y: 0, z: 0 });

  // Get health component
  const health = wolf.getComponent(EntityComponentTypes.Health) as
    | EntityHealthComponent
    | undefined;

  test.assert(health !== undefined, "Wolf should have Health component");
  test.assert(health?.currentValue !== undefined, "Wolf health should have current value");
  test.assert(health?.defaultValue !== undefined, "Wolf health should have default value");
  test.assert(
    health?.currentValue === health?.defaultValue,
    "Newly spawned wolf should be at full health"
  );

  test.succeed();
}

/**
 * Test that PlayerBookService initializes without errors
 * Verifies the service can be instantiated
 */
export function playerBookServiceTest(test: gametest.Test) {
  const messageProvider = new MessageProvider();
  void new PlayerBookService(
    messageProvider,
    null as any, // resourceService - not needed for construction test
    null as any, // recruitmentService - not needed for construction test
    null as any, // unitPocketService - not needed for construction test
    null as any // wealthCalculationService - not needed for construction test
  );

  // Service initialized successfully
  test.succeed();
}

/**
 * Test that raid party messages exist and are correct
 * Verifies all required message keys are defined
 */
export function raidPartyMessagesTest(test: gametest.Test) {
  const messageProvider = new MessageProvider();

  const requiredKeys = [
    "mc.raids.raidparty.title",
    "mc.raids.raidparty.header",
    "mc.raids.raidparty.noentities",
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

// Register all tests
gametest
  .register("MinecraftRaids", "wolfTaming", wolfTamingTest)
  .maxTicks(GameTestTimeouts.SHORT)
  .structureName("MinecraftRaids:simple")
  .tag("suite:raidparty")
  .tag("batch");

gametest
  .register("MinecraftRaids", "wolfQuery", wolfQueryTest)
  .maxTicks(GameTestTimeouts.SHORT)
  .structureName("MinecraftRaids:simple")
  .tag("suite:raidparty")
  .tag("batch");

gametest
  .register("MinecraftRaids", "wolfHealth", wolfHealthTest)
  .maxTicks(GameTestTimeouts.QUICK)
  .structureName("MinecraftRaids:simple")
  .tag("suite:raidparty")
  .tag("batch");

gametest
  .register("MinecraftRaids", "playerBookService", playerBookServiceTest)
  .maxTicks(GameTestTimeouts.QUICK)
  .structureName("MinecraftRaids:simple")
  .tag("suite:raidparty")
  .tag("batch");

gametest
  .register("MinecraftRaids", "raidPartyMessages", raidPartyMessagesTest)
  .maxTicks(GameTestTimeouts.STANDARD)
  .structureName("MinecraftRaids:simple")
  .tag("suite:raidparty")
  .tag("batch");
