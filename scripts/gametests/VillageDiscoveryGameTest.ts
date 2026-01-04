import * as gametest from "@minecraft/server-gametest";
import { VillageCache } from "../core/features/village/VillageCache";
import { GameTestTiming, GameTestTimeouts } from "./GameTestConstants";

/**
 * GameTests for Village Discovery System
 *
 * Tests village detection and caching:
 * - Village discovery and storage
 * - Clustering nearby villages (100-block radius)
 * - Conquest tracking
 * - Persistent storage via dynamic properties
 */

/**
 * Test adding a village to the cache
 */
export function villageDiscoveryAddVillageTest(test: gametest.Test) {
  const villageCache = new VillageCache();
  villageCache.initialize();

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Clear any existing data
    villageCache.clear();

    // Add a village
    const location = { x: 100, y: 64, z: 200 };
    const wasAdded = villageCache.addVillage(location, "command");

    test.assert(wasAdded === true, "Village should be added successfully");

    // Verify it's in the cache
    const villages = villageCache.getDiscoveredVillages();
    test.assert(villages.length === 1, `Should have 1 village, got ${villages.length}`);
    test.assert(villages[0].discoveryMethod === "command", "Discovery method should be 'command'");

    test.succeed();
  });
}

/**
 * Test that nearby villages are clustered (100-block radius)
 */
export function villageDiscoveryClusteringTest(test: gametest.Test) {
  const villageCache = new VillageCache();
  villageCache.initialize();

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    villageCache.clear();

    // Add first village
    const village1 = { x: 0, y: 64, z: 0 };
    const added1 = villageCache.addVillage(village1, "entity");
    test.assert(added1 === true, "First village should be added");

    // Try to add another village 50 blocks away (within clustering radius)
    const village2 = { x: 50, y: 64, z: 0 };
    const added2 = villageCache.addVillage(village2, "entity");
    test.assert(
      added2 === false,
      "Second village should NOT be added (within 100-block clustering radius)"
    );

    // Verify only 1 village in cache
    const villages = villageCache.getDiscoveredVillages();
    test.assert(villages.length === 1, `Should have 1 village (clustered), got ${villages.length}`);

    // Try to add a village 150 blocks away (outside clustering radius)
    const village3 = { x: 150, y: 64, z: 0 };
    const added3 = villageCache.addVillage(village3, "entity");
    test.assert(added3 === true, "Third village should be added (outside clustering radius)");

    const villagesAfter = villageCache.getDiscoveredVillages();
    test.assert(villagesAfter.length === 2, `Should have 2 villages, got ${villagesAfter.length}`);

    test.succeed();
  });
}

/**
 * Test retrieving a village by its key
 */
export function villageDiscoveryGetByKeyTest(test: gametest.Test) {
  const villageCache = new VillageCache();
  villageCache.initialize();

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    villageCache.clear();

    // Add a village
    const location = { x: 300, y: 64, z: 400 };
    villageCache.addVillage(location, "command");

    // Retrieve by key (key format is "village_x_z")
    const key = "village_300_400";
    const village = villageCache.getVillageByKey(key);

    test.assert(village !== null, "Village should be found by key");
    test.assert(village?.key === key, `Village key should be ${key}`);
    test.assert(
      Math.abs(village!.location.x - 300) < 1,
      `X coordinate should be ~300, got ${village!.location.x}`
    );
    test.assert(
      Math.abs(village!.location.z - 400) < 1,
      `Z coordinate should be ~400, got ${village!.location.z}`
    );

    test.succeed();
  });
}

/**
 * Test hasDiscovered checks for nearby villages
 */
export function villageDiscoveryHasDiscoveredTest(test: gametest.Test) {
  const villageCache = new VillageCache();
  villageCache.initialize();

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    villageCache.clear();

    // Add a village at (0, 64, 0)
    villageCache.addVillage({ x: 0, y: 64, z: 0 }, "entity");

    // Check exact location
    test.assert(
      villageCache.hasDiscovered({ x: 0, y: 64, z: 0 }) === true,
      "Should find village at exact location"
    );

    // Check nearby location (within clustering radius)
    test.assert(
      villageCache.hasDiscovered({ x: 50, y: 64, z: 50 }) === true,
      "Should find village within clustering radius"
    );

    // Check far location (outside clustering radius)
    test.assert(
      villageCache.hasDiscovered({ x: 200, y: 64, z: 200 }) === false,
      "Should NOT find village outside clustering radius"
    );

    test.succeed();
  });
}

/**
 * Test recording conquest updates village data
 */
export function villageDiscoveryRecordConquestTest(test: gametest.Test) {
  const villageCache = new VillageCache();
  villageCache.initialize();

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    villageCache.clear();

    // Add a village
    const location = { x: 100, y: 64, z: 100 };
    villageCache.addVillage(location, "entity");

    const key = "village_100_100";
    let village = villageCache.getVillageByKey(key);

    test.assert(village !== null, "Village should exist");
    test.assert(village!.conquestCount === 0, "Initial conquest count should be 0");
    test.assert(village!.lastConqueredBy === undefined, "No previous conqueror");

    // Record a conquest
    villageCache.recordConquest(key, "player123");

    // Check updated values
    village = villageCache.getVillageByKey(key);
    test.assert(village!.conquestCount === 1, "Conquest count should be 1");
    test.assert(
      village!.lastConqueredBy === "player123",
      `Last conqueror should be player123, got ${village!.lastConqueredBy}`
    );

    // Record another conquest
    villageCache.recordConquest(key, "player456");
    village = villageCache.getVillageByKey(key);
    test.assert(village!.conquestCount === 2, "Conquest count should be 2");
    test.assert(
      village!.lastConqueredBy === "player456",
      `Last conqueror should be player456, got ${village!.lastConqueredBy}`
    );

    test.succeed();
  });
}

/**
 * Test persistence across cache instances
 */
export function villageDiscoveryPersistenceTest(test: gametest.Test) {
  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Create first cache instance and add villages
    const cache1 = new VillageCache();
    cache1.initialize();
    cache1.clear();
    cache1.addVillage({ x: 500, y: 64, z: 500 }, "command");
    cache1.addVillage({ x: 700, y: 64, z: 700 }, "entity");

    // Create second cache instance (should load from dynamic properties)
    const cache2 = new VillageCache();
    cache2.initialize();
    const villages = cache2.getDiscoveredVillages();

    test.assert(
      villages.length === 2,
      `Persisted cache should have 2 villages, got ${villages.length}`
    );

    // Verify data integrity
    const village1 = cache2.getVillageByKey("village_500_500");
    const village2 = cache2.getVillageByKey("village_700_700");

    test.assert(village1 !== null, "First village should be persisted");
    test.assert(village2 !== null, "Second village should be persisted");
    test.assert(village1!.discoveryMethod === "command", "Discovery method should persist");
    test.assert(village2!.discoveryMethod === "entity", "Discovery method should persist");

    test.succeed();
  });
}

// Register all tests with proper tags
gametest
  .register("MinecraftRaids", "villageDiscoveryAddVillage", villageDiscoveryAddVillageTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:village_discovery")
  .tag("batch");

gametest
  .register("MinecraftRaids", "villageDiscoveryClustering", villageDiscoveryClusteringTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:village_discovery")
  .tag("batch");

gametest
  .register("MinecraftRaids", "villageDiscoveryGetByKey", villageDiscoveryGetByKeyTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:village_discovery")
  .tag("batch");

gametest
  .register("MinecraftRaids", "villageDiscoveryHasDiscovered", villageDiscoveryHasDiscoveredTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:village_discovery")
  .tag("batch");

gametest
  .register("MinecraftRaids", "villageDiscoveryRecordConquest", villageDiscoveryRecordConquestTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:village_discovery")
  .tag("batch");

gametest
  .register("MinecraftRaids", "villageDiscoveryPersistence", villageDiscoveryPersistenceTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:village_discovery")
  .tag("batch");
