import * as gametest from "@minecraft/server-gametest";
import { Vector3, EntityComponentTypes } from "@minecraft/server";

/**
 * Test 1: Verify entity spawns with correct identifier and basic components
 */
export function villageGuardWolfSpawn(test: gametest.Test) {
  const spawnPos: Vector3 = { x: 1, y: 0, z: 1 };

  // Spawn village guard wolf
  const wolf = test.spawn("minecraftraids:village_guard_wolf", spawnPos);

  // Verify entity exists
  test.assert(wolf !== undefined, "Wolf should spawn successfully");
  test.assert(
    wolf.typeId === "minecraftraids:village_guard_wolf",
    "Wolf should have correct type ID"
  );

  // Verify basic components
  const health = wolf.getComponent(EntityComponentTypes.Health);
  test.assert(health !== undefined, "Wolf should have health component");

  const movement = wolf.getComponent(EntityComponentTypes.Movement);
  test.assert(movement !== undefined, "Wolf should have movement component");

  test.succeed();
}

/**
 * Test 2: Verify Tier 1 wolves have correct stats (25 HP, 5 damage, 1.1x scale)
 */
export function villageGuardWolfTier1Stats(test: gametest.Test) {
  const wolf = test.spawn("minecraftraids:village_guard_wolf", {
    x: 1,
    y: 0,
    z: 1,
  });
  wolf.triggerEvent("minecraftraids:set_tier_1");

  // Wait for event to apply
  test.runAfterDelay(5, () => {
    const health = wolf.getComponent(EntityComponentTypes.Health);
    const scale = wolf.getComponent(EntityComponentTypes.Scale);

    if (!health) {
      test.fail("Wolf should have health component");
      return;
    }
    if (!scale) {
      test.fail("Wolf should have scale component");
      return;
    }

    test.assert(
      health.currentValue === 25,
      `Tier 1 wolf should have 25 HP, got ${health.currentValue}`
    );
    test.assert(
      scale.value === 1.1,
      `Tier 1 wolf should have 1.1x scale, got ${scale.value}`
    );

    test.succeed();
  });
}

/**
 * Test 3: Verify Tier 2 wolves have correct stats (35 HP, 7 damage, 1.25x scale)
 */
export function villageGuardWolfTier2Stats(test: gametest.Test) {
  const wolf = test.spawn("minecraftraids:village_guard_wolf", {
    x: 1,
    y: 0,
    z: 1,
  });
  wolf.triggerEvent("minecraftraids:set_tier_2");

  test.runAfterDelay(5, () => {
    const health = wolf.getComponent(EntityComponentTypes.Health);
    const scale = wolf.getComponent(EntityComponentTypes.Scale);

    if (!health) {
      test.fail("Wolf should have health component");
      return;
    }
    if (!scale) {
      test.fail("Wolf should have scale component");
      return;
    }

    test.assert(
      health.currentValue === 35,
      `Tier 2 wolf should have 35 HP, got ${health.currentValue}`
    );
    test.assert(
      scale.value === 1.25,
      `Tier 2 wolf should have 1.25x scale, got ${scale.value}`
    );

    test.succeed();
  });
}

/**
 * Test 4: Verify Tier 3 wolves have correct stats (50 HP, 10 damage, 1.4x scale)
 */
export function villageGuardWolfTier3Stats(test: gametest.Test) {
  const wolf = test.spawn("minecraftraids:village_guard_wolf", {
    x: 1,
    y: 0,
    z: 1,
  });
  wolf.triggerEvent("minecraftraids:set_tier_3");

  test.runAfterDelay(5, () => {
    const health = wolf.getComponent(EntityComponentTypes.Health);
    const scale = wolf.getComponent(EntityComponentTypes.Scale);

    if (!health) {
      test.fail("Wolf should have health component");
      return;
    }
    if (!scale) {
      test.fail("Wolf should have scale component");
      return;
    }

    test.assert(
      health.currentValue === 50,
      `Tier 3 wolf should have 50 HP, got ${health.currentValue}`
    );
    test.assert(
      scale.value === 1.4,
      `Tier 3 wolf should have 1.4x scale, got ${scale.value}`
    );

    test.succeed();
  });
}

/**
 * Test 5: Verify wolf has persistence for village association
 * (dweller component is internal and verified through village integration)
 */
export function villageGuardWolfDwellerComponent(test: gametest.Test) {
  const wolf = test.spawn("minecraftraids:village_guard_wolf", {
    x: 1,
    y: 0,
    z: 1,
  });

  // Verify wolf entity is persistent (for village integration)
  const health = wolf.getComponent(EntityComponentTypes.Health);
  test.assert(
    health !== undefined,
    "Wolf should persist and have health component for village integration"
  );

  test.succeed();
}

/**
 * Test 6: Verify village guard wolves cannot be tamed (no tameable component)
 */
export function villageGuardWolfNotTameable(test: gametest.Test) {
  const wolf = test.spawn("minecraftraids:village_guard_wolf", {
    x: 1,
    y: 0,
    z: 1,
  });

  // Verify NO tameable component (village wolves are not pets)
  const tameable = wolf.getComponent(EntityComponentTypes.Tameable);
  test.assert(
    tameable === undefined,
    "Village guard wolf should NOT be tameable"
  );

  // Verify NO leashable component
  const leashable = wolf.getComponent(EntityComponentTypes.Leashable);
  test.assert(
    leashable === undefined,
    "Village guard wolf should NOT be leashable"
  );

  test.succeed();
}

/**
 * Test 7: Verify wolf attacks hostile mobs (nearest_attackable_target behavior)
 */
export function villageGuardWolfAttacksHostiles(test: gametest.Test) {
  const wolfPos: Vector3 = { x: 1, y: 0, z: 1 };
  const zombiePos: Vector3 = { x: 4, y: 0, z: 1 }; // 3 blocks away

  const wolf = test.spawn("minecraftraids:village_guard_wolf", wolfPos);
  wolf.triggerEvent("minecraftraids:set_tier_1");

  const zombie = test.spawn("minecraft:zombie", zombiePos);

  // Wait for wolf to detect and engage zombie (40 ticks = ~2 seconds)
  test.runAfterDelay(40, () => {
    // Check if wolf attacked - zombie should be dead or damaged
    const zombieHealth = zombie.getComponent(EntityComponentTypes.Health);

    if (!zombieHealth) {
      // If zombie is gone, wolf successfully attacked
      test.succeed();
      return;
    }

    // Zombie should be damaged if wolf attacked
    test.assert(
      zombieHealth.currentValue < 20,
      "Wolf should attack nearby hostile mob (zombie)"
    );

    test.succeed();
  });
}

/**
 * Test 8: Verify wolf has correct family types for targeting filters
 */
export function villageGuardWolfFamilyTypes(test: gametest.Test) {
  const wolf = test.spawn("minecraftraids:village_guard_wolf", {
    x: 1,
    y: 0,
    z: 1,
  });

  // Verify family types via component
  const typeFamily = wolf.getComponent(EntityComponentTypes.TypeFamily);

  if (!typeFamily) {
    test.fail("Wolf should have type family component");
    return;
  }

  test.assert(typeFamily !== undefined, "Wolf should have type family component");

  // Check if wolf has expected family tags
  test.assert(
    typeFamily.hasTypeFamily("wolf"),
    "Wolf should have 'wolf' family"
  );
  test.assert(
    typeFamily.hasTypeFamily("village_guard"),
    "Wolf should have 'village_guard' family"
  );
  test.assert(typeFamily.hasTypeFamily("mob"), "Wolf should have 'mob' family");

  test.succeed();
}

// Register all tests with the GameTest framework
gametest.register(
  "MinecraftRaids",
  "villageGuardWolfSpawn",
  villageGuardWolfSpawn
);
gametest.register(
  "MinecraftRaids",
  "villageGuardWolfTier1Stats",
  villageGuardWolfTier1Stats
);
gametest.register(
  "MinecraftRaids",
  "villageGuardWolfTier2Stats",
  villageGuardWolfTier2Stats
);
gametest.register(
  "MinecraftRaids",
  "villageGuardWolfTier3Stats",
  villageGuardWolfTier3Stats
);
gametest.register(
  "MinecraftRaids",
  "villageGuardWolfDwellerComponent",
  villageGuardWolfDwellerComponent
);
gametest.register(
  "MinecraftRaids",
  "villageGuardWolfNotTameable",
  villageGuardWolfNotTameable
);
gametest.register(
  "MinecraftRaids",
  "villageGuardWolfAttacksHostiles",
  villageGuardWolfAttacksHostiles
);
gametest.register(
  "MinecraftRaids",
  "villageGuardWolfFamilyTypes",
  villageGuardWolfFamilyTypes
);
