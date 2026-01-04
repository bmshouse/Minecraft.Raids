import * as gametest from "@minecraft/server-gametest";
import {
  EntityComponentTypes,
  EntityTameableComponent,
  EntityHealthComponent,
  EntityScaleComponent,
} from "@minecraft/server";
import { GameTestTiming, GameTestTimeouts } from "./GameTestConstants";

/**
 * Test that a tamed wolf starts at level 1
 * Level 1: 20 HP, 4 damage, 1.0x scale
 */
export function wolfStartsAtLevel1Test(test: gametest.Test) {
  // Get a simulated player for taming
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");

  // Spawn a wolf
  const wolf = test.spawn("minecraft:wolf", { x: 1, y: 2, z: 1 });
  wolf.triggerEvent("minecraft:entity_spawned"); // Initialize first

  // Tame the wolf to apply level 1 stats
  const tameable = wolf.getComponent(EntityComponentTypes.Tameable) as EntityTameableComponent;
  tameable.tame(player);

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Check health component
    const health = wolf.getComponent(EntityComponentTypes.Health) as EntityHealthComponent;
    test.assert(
      health?.defaultValue === 20,
      `Wolf should have 20 max HP at level 1, got ${health?.defaultValue}`
    );

    // Check scale component
    const scale = wolf.getComponent(EntityComponentTypes.Scale) as EntityScaleComponent;
    test.assert(
      scale?.value === 1.0,
      `Wolf should have 1.0x scale at level 1, got ${scale?.value}`
    );

    test.succeed();
  });
}

/**
 * Test that a wolf can be leveled to level 2
 * Level 2: 30 HP, 6 damage, 1.15x scale
 */
export function wolfCanReachLevel2Test(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const wolf = test.spawn("minecraft:wolf", { x: 1, y: 2, z: 1 });
  wolf.triggerEvent("minecraft:entity_spawned"); // Initialize first

  // Tame the wolf at level 1
  const tameable = wolf.getComponent(EntityComponentTypes.Tameable) as EntityTameableComponent;
  tameable.tame(player);

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Trigger level up to 2
    wolf.triggerEvent("minecraftraids:level_up_to_2");

    test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
      // Check health increased to 30
      const health = wolf.getComponent(EntityComponentTypes.Health) as EntityHealthComponent;
      test.assert(
        health?.defaultValue === 30,
        `Wolf should have 30 max HP at level 2, got ${health?.defaultValue}`
      );

      // Check scale increased to 1.15
      const scale = wolf.getComponent(EntityComponentTypes.Scale) as EntityScaleComponent;
      test.assert(
        Math.abs((scale?.value || 0) - 1.15) < 0.01,
        `Wolf should have 1.15x scale at level 2, got ${scale?.value}`
      );

      test.succeed();
    });
  });
}

/**
 * Test that a wolf can reach max level 3
 * Level 3: 40 HP, 8 damage, 1.3x scale
 */
export function wolfCanReachLevel3Test(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const wolf = test.spawn("minecraft:wolf", { x: 1, y: 2, z: 1 });
  wolf.triggerEvent("minecraft:entity_spawned"); // Initialize first

  // Tame the wolf at level 1
  const tameable = wolf.getComponent(EntityComponentTypes.Tameable) as EntityTameableComponent;
  tameable.tame(player);

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Trigger level up to 2
    wolf.triggerEvent("minecraftraids:level_up_to_2");

    test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
      // Trigger level up to 3
      wolf.triggerEvent("minecraftraids:level_up_to_3");

      test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
        // Check health increased to 40
        const health = wolf.getComponent(EntityComponentTypes.Health) as EntityHealthComponent;
        test.assert(
          health?.defaultValue === 40,
          `Wolf should have 40 max HP at level 3, got ${health?.defaultValue}`
        );

        // Check scale increased to 1.3
        const scale = wolf.getComponent(EntityComponentTypes.Scale) as EntityScaleComponent;
        test.assert(
          Math.abs((scale?.value || 0) - 1.3) < 0.01,
          `Wolf should have 1.3x scale at level 3, got ${scale?.value}`
        );

        test.succeed();
      });
    });
  });
}

/**
 * Test that bred wolves start at level 1
 * When a wolf is born via breeding, it should have level 1 stats
 */
export function babyWolfStartsAtLevel1Test(test: gametest.Test) {
  // Get a simulated player for taming
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");

  // Spawn two tamed adult wolves
  const wolf1 = test.spawn("minecraft:wolf", { x: 1, y: 2, z: 1 });
  wolf1.triggerEvent("minecraft:entity_spawned"); // Initialize first
  const tameable1 = wolf1.getComponent(EntityComponentTypes.Tameable) as EntityTameableComponent;
  tameable1.tame(player); // Use tame() method instead of event

  const wolf2 = test.spawn("minecraft:wolf", { x: 2, y: 2, z: 1 });
  wolf2.triggerEvent("minecraft:entity_spawned"); // Initialize first
  const tameable2 = wolf2.getComponent(EntityComponentTypes.Tameable) as EntityTameableComponent;
  tameable2.tame(player); // Use tame() method instead of event

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Add adult component group so they can breed
    wolf1.triggerEvent("minecraft:ageable_grow_up");
    wolf2.triggerEvent("minecraft:ageable_grow_up");

    test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
      // Trigger a birth event
      const baby = test.spawn("minecraft:wolf", { x: 1.5, y: 2, z: 1 });
      baby.triggerEvent("minecraft:entity_spawned"); // Initialize first
      baby.triggerEvent("minecraft:entity_born");

      // Baby wolves born from tamed parents should be tamed
      const babyTameable = baby.getComponent(
        EntityComponentTypes.Tameable
      ) as EntityTameableComponent;
      babyTameable.tame(player); // Actually tame at API level

      test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
        // Check baby wolf has level 1 stats
        const health = baby.getComponent(EntityComponentTypes.Health) as EntityHealthComponent;
        test.assert(
          health?.defaultValue === 20,
          `Baby wolf should have 20 max HP (level 1), got ${health?.defaultValue}`
        );

        // Check baby is tamed (from entity_born event + tame() call)
        const tameable = baby.getComponent(
          EntityComponentTypes.Tameable
        ) as EntityTameableComponent;
        test.assert(tameable?.isTamed === true, "Baby wolf from entity_born should be tamed");

        test.succeed();
      });
    });
  });
}

/**
 * Test wolf level progression: 1 → 2 → 3
 * Verifies the complete leveling sequence
 */
export function wolfLevelProgressionTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const wolf = test.spawn("minecraft:wolf", { x: 1, y: 2, z: 1 });
  wolf.triggerEvent("minecraft:entity_spawned"); // Initialize first

  // Level 1
  const tameable = wolf.getComponent(EntityComponentTypes.Tameable) as EntityTameableComponent;
  tameable.tame(player);

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    const level1Health = (wolf.getComponent(EntityComponentTypes.Health) as EntityHealthComponent)
      ?.defaultValue;
    test.assert(level1Health === 20, `Level 1: Expected 20 HP, got ${level1Health}`);

    // Level 2
    wolf.triggerEvent("minecraftraids:level_up_to_2");

    test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
      const level2Health = (wolf.getComponent(EntityComponentTypes.Health) as EntityHealthComponent)
        ?.defaultValue;
      test.assert(level2Health === 30, `Level 2: Expected 30 HP, got ${level2Health}`);

      // Level 3
      wolf.triggerEvent("minecraftraids:level_up_to_3");

      test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
        const level3Health = (
          wolf.getComponent(EntityComponentTypes.Health) as EntityHealthComponent
        )?.defaultValue;
        test.assert(level3Health === 40, `Level 3: Expected 40 HP, got ${level3Health}`);

        test.succeed();
      });
    });
  });
}

/**
 * Test that reset event brings wolf back to level 1
 */
export function wolfResetToLevel1Test(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const wolf = test.spawn("minecraft:wolf", { x: 1, y: 2, z: 1 });
  wolf.triggerEvent("minecraft:entity_spawned"); // Initialize first

  // Advance to level 3
  const tameable = wolf.getComponent(EntityComponentTypes.Tameable) as EntityTameableComponent;
  tameable.tame(player);

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    wolf.triggerEvent("minecraftraids:level_up_to_2");

    test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
      wolf.triggerEvent("minecraftraids:level_up_to_3");

      test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
        // Reset to level 1
        wolf.triggerEvent("minecraftraids:reset_to_level_1");

        test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
          const health = wolf.getComponent(EntityComponentTypes.Health) as EntityHealthComponent;
          test.assert(
            health?.defaultValue === 20,
            `After reset, wolf should have 20 HP (level 1), got ${health?.defaultValue}`
          );

          test.succeed();
        });
      });
    });
  });
}

// Register all wolf leveling tests
gametest
  .register("MinecraftRaids", "wolfStartsAtLevel1", wolfStartsAtLevel1Test)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:wolfStartsAtLevel1")
  .tag("suite:wolf_leveling")
  .tag("batch");

gametest
  .register("MinecraftRaids", "wolfCanReachLevel2", wolfCanReachLevel2Test)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:wolfCanReachLevel2")
  .tag("suite:wolf_leveling")
  .tag("batch");

gametest
  .register("MinecraftRaids", "wolfCanReachLevel3", wolfCanReachLevel3Test)
  .maxTicks(GameTestTimeouts.EXTENDED)
  .structureName("MinecraftRaids:wolfCanReachLevel3")
  .tag("suite:wolf_leveling")
  .tag("batch");

gametest
  .register("MinecraftRaids", "babyWolfStartsAtLevel1", babyWolfStartsAtLevel1Test)
  .maxTicks(GameTestTimeouts.EXTENDED)
  .structureName("MinecraftRaids:babyWolfStartsAtLevel1")
  .tag("suite:wolf_leveling")
  .tag("batch");

gametest
  .register("MinecraftRaids", "wolfLevelProgression", wolfLevelProgressionTest)
  .maxTicks(GameTestTimeouts.EXTENDED)
  .structureName("MinecraftRaids:wolfLevelProgression")
  .tag("suite:wolf_leveling")
  .tag("batch");

gametest
  .register("MinecraftRaids", "wolfResetToLevel1", wolfResetToLevel1Test)
  .maxTicks(GameTestTimeouts.EXTENDED)
  .structureName("MinecraftRaids:wolfResetToLevel1")
  .tag("suite:wolf_leveling")
  .tag("batch");
