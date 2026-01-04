import * as gametest from "@minecraft/server-gametest";
import { EntityComponentTypes, EntityHealthComponent } from "@minecraft/server";
import { UnitPocketService } from "../core/recruitment/UnitPocketService";
import { RecruitmentService } from "../core/recruitment/RecruitmentService";
import { ResourceService } from "../core/resources/ResourceService";
import { MessageProvider } from "../core/messaging/MessageProvider";
import { WolfLevelingService } from "../core/features/WolfLevelingService";
import { UnitDefinitions } from "../core/recruitment/UnitDefinitions";
import { UnitConstants } from "../core/recruitment/UnitConstants";
import { GameTestTiming, GameTestTimeouts } from "./GameTestConstants";

/**
 * GameTests for UnitPocketService
 *
 * Tests unit storage and retrieval with dynamic properties:
 * - Pocketing units (despawn and save to storage)
 * - Releasing units (spawn from storage)
 * - Capacity limits (75 units max)
 * - Ownership validation
 * - Health preservation
 * - Bulk operations (pocket all / release all)
 */

/**
 * Test pocketing a unit removes it from world and saves to storage
 */
export function pocketServiceBasicPocketTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const wolfLevelingService = new WolfLevelingService(messageProvider);
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);
  const pocketService = new UnitPocketService(
    recruitmentService,
    messageProvider,
    wolfLevelingService
  );

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Recruit a unit
    resourceService.addEmeralds(player, 20);
    const recruitResult = recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_GUARD);

    test.assert(recruitResult.success === true, "Recruitment should succeed");
    const entity = recruitResult.entity!;

    // Verify unit is active
    const activeUnits = pocketService.getActiveUnits(player);
    test.assert(activeUnits.length === 1, "Should have 1 active unit");

    // Pocket the unit
    const pocketResult = pocketService.pocketUnit(player, entity);

    test.assert(pocketResult.success === true, "Pocketing should succeed");

    // Verify unit is no longer active
    const activeAfter = pocketService.getActiveUnits(player);
    test.assert(activeAfter.length === 0, "Should have 0 active units after pocketing");

    // Verify unit is in pocket
    const pocketed = pocketService.getPocketedUnits(player);
    test.assert(pocketed.length === 1, `Should have 1 pocketed unit, got ${pocketed.length}`);
    test.assert(pocketed[0].entityId === "minecraft:wolf", "Pocketed unit should be a wolf");

    test.succeed();
  });
}

/**
 * Test releasing a pocketed unit spawns it back into the world
 */
export function pocketServiceReleaseUnitTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const wolfLevelingService = new WolfLevelingService(messageProvider);
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);
  const pocketService = new UnitPocketService(
    recruitmentService,
    messageProvider,
    wolfLevelingService
  );

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Recruit and pocket a unit
    resourceService.addEmeralds(player, 20);
    const recruitResult = recruitmentService.recruitUnit(player, UnitDefinitions.PILLAGER);
    const entity = recruitResult.entity!;
    pocketService.pocketUnit(player, entity);

    // Verify it's pocketed
    let pocketed = pocketService.getPocketedUnits(player);
    test.assert(pocketed.length === 1, "Should have 1 pocketed unit");

    // Release the unit
    const releaseResult = pocketService.releaseUnit(player, 0);

    test.assert(releaseResult.success === true, "Release should succeed");
    test.assert(releaseResult.entity !== undefined, "Released entity should be returned");

    // Verify unit is back in world
    const activeUnits = pocketService.getActiveUnits(player);
    test.assert(activeUnits.length === 1, "Should have 1 active unit after release");

    // Verify pocket is empty
    pocketed = pocketService.getPocketedUnits(player);
    test.assert(pocketed.length === 0, "Pocket should be empty after release");

    // Verify entity is owned
    test.assert(
      recruitmentService.isPlayerUnit(player, releaseResult.entity!),
      "Released unit should be owned by player"
    );

    test.succeed();
  });
}

/**
 * Test pocketing fails when player doesn't own the unit
 */
export function pocketServiceOwnershipValidationTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const messageProvider = new MessageProvider();
  const wolfLevelingService = new WolfLevelingService(messageProvider);
  const recruitmentService = new RecruitmentService(new ResourceService(), messageProvider);
  const pocketService = new UnitPocketService(
    recruitmentService,
    messageProvider,
    wolfLevelingService
  );

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Spawn a wild wolf (not recruited)
    const wildWolf = test.spawn("minecraft:wolf", { x: 3, y: 2, z: 3 });
    wildWolf.triggerEvent("minecraft:entity_spawned");

    // Try to pocket the wild wolf
    const pocketResult = pocketService.pocketUnit(player, wildWolf);

    test.assert(pocketResult.success === false, "Pocketing should fail for non-owned unit");

    // Verify pocket is still empty
    const pocketed = pocketService.getPocketedUnits(player);
    test.assert(pocketed.length === 0, "Pocket should remain empty");

    test.succeed();
  });
}

/**
 * Test pocket capacity limit (75 units max)
 */
export function pocketServiceCapacityLimitTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const wolfLevelingService = new WolfLevelingService(messageProvider);
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);
  const pocketService = new UnitPocketService(
    recruitmentService,
    messageProvider,
    wolfLevelingService
  );

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Give player many emeralds
    resourceService.addEmeralds(player, 1000);

    // Recruit and pocket 75 units (the maximum)
    for (let i = 0; i < UnitConstants.MAX_POCKETED_UNITS; i++) {
      const recruitResult = recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_GUARD);
      if (recruitResult.success) {
        pocketService.pocketUnit(player, recruitResult.entity!);
      }
    }

    // Verify we have 75 pocketed units
    const pocketed = pocketService.getPocketedUnits(player);
    test.assert(
      pocketed.length === UnitConstants.MAX_POCKETED_UNITS,
      `Should have ${UnitConstants.MAX_POCKETED_UNITS} pocketed units, got ${pocketed.length}`
    );

    // Try to pocket one more (76th unit)
    const extraRecruit = recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_GUARD);
    const extraPocket = pocketService.pocketUnit(player, extraRecruit.entity!);

    test.assert(extraPocket.success === false, "Pocketing should fail when pocket is full");

    // Pocket count should still be 75
    const pocketedAfter = pocketService.getPocketedUnits(player);
    test.assert(
      pocketedAfter.length === UnitConstants.MAX_POCKETED_UNITS,
      `Pocket should still have ${UnitConstants.MAX_POCKETED_UNITS} units`
    );

    test.succeed();
  });
}

/**
 * Test health preservation when pocketing and releasing
 */
export function pocketServiceHealthPreservationTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const wolfLevelingService = new WolfLevelingService(messageProvider);
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);
  const pocketService = new UnitPocketService(
    recruitmentService,
    messageProvider,
    wolfLevelingService
  );

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Recruit a unit
    resourceService.addEmeralds(player, 30);
    const recruitResult = recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_GUARD);
    const entity = recruitResult.entity!;

    // Damage the unit to 50% health
    const healthComponent = entity.getComponent(EntityComponentTypes.Health) as
      | EntityHealthComponent
      | undefined;
    test.assert(healthComponent !== undefined, "Entity should have health component");

    const maxHP = healthComponent!.defaultValue;
    const damagedHP = Math.round(maxHP * 0.5);
    healthComponent!.setCurrentValue(damagedHP);

    // Verify it's damaged
    test.assert(healthComponent!.currentValue === damagedHP, `Entity should have ${damagedHP} HP`);

    // Pocket the damaged unit
    const pocketResult = pocketService.pocketUnit(player, entity);
    test.assert(pocketResult.success === true, "Pocketing should succeed");

    // Check stored data
    const pocketed = pocketService.getPocketedUnits(player);
    test.assert(pocketed[0].currentHP === damagedHP, "Stored HP should be preserved");
    test.assert(pocketed[0].maxHP === maxHP, "Stored max HP should be preserved");

    // Release the unit
    const releaseResult = pocketService.releaseUnit(player, 0);
    test.assert(releaseResult.success === true, "Release should succeed");

    // Check health was restored proportionally
    const releasedEntity = releaseResult.entity!;
    const releasedHealth = releasedEntity.getComponent(EntityComponentTypes.Health) as
      | EntityHealthComponent
      | undefined;

    test.assert(releasedHealth !== undefined, "Released entity should have health component");

    // Should restore to ~50% of max HP
    const restoredHP = releasedHealth!.currentValue;
    const expectedHP = Math.round(releasedHealth!.defaultValue * 0.5);

    test.assert(
      Math.abs(restoredHP - expectedHP) <= 1,
      `Released entity should have ~${expectedHP} HP, got ${restoredHP}`
    );

    test.succeed();
  });
}

/**
 * Test pocketAllUnits bulk operation
 */
export function pocketServicePocketAllTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const wolfLevelingService = new WolfLevelingService(messageProvider);
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);
  const pocketService = new UnitPocketService(
    recruitmentService,
    messageProvider,
    wolfLevelingService
  );

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Recruit 3 units
    resourceService.addEmeralds(player, 50);
    recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_GUARD);
    recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_TANK);
    recruitmentService.recruitUnit(player, UnitDefinitions.PILLAGER);

    // Verify 3 active units
    let activeUnits = pocketService.getActiveUnits(player);
    test.assert(activeUnits.length === 3, `Should have 3 active units, got ${activeUnits.length}`);

    // Pocket all units
    const pocketAllResult = pocketService.pocketAllUnits(player);

    test.assert(pocketAllResult.success === true, "Pocket all should succeed");
    test.assert(
      pocketAllResult.count === 3,
      `Should have pocketed 3 units, got ${pocketAllResult.count}`
    );

    // Verify all units are pocketed
    activeUnits = pocketService.getActiveUnits(player);
    test.assert(activeUnits.length === 0, "Should have 0 active units after pocket all");

    const pocketed = pocketService.getPocketedUnits(player);
    test.assert(pocketed.length === 3, `Should have 3 pocketed units, got ${pocketed.length}`);

    test.succeed();
  });
}

/**
 * Test releaseAllUnits bulk operation
 */
export function pocketServiceReleaseAllTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const wolfLevelingService = new WolfLevelingService(messageProvider);
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);
  const pocketService = new UnitPocketService(
    recruitmentService,
    messageProvider,
    wolfLevelingService
  );

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Recruit and pocket 3 units
    resourceService.addEmeralds(player, 50);
    const recruit1 = recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_GUARD);
    const recruit2 = recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_DPS);
    const recruit3 = recruitmentService.recruitUnit(player, UnitDefinitions.VINDICATOR);

    pocketService.pocketUnit(player, recruit1.entity!);
    pocketService.pocketUnit(player, recruit2.entity!);
    pocketService.pocketUnit(player, recruit3.entity!);

    // Verify 3 pocketed units
    let pocketed = pocketService.getPocketedUnits(player);
    test.assert(pocketed.length === 3, "Should have 3 pocketed units");

    // Release all units
    const releaseAllResult = pocketService.releaseAllUnits(player);

    test.assert(releaseAllResult.success === true, "Release all should succeed");
    test.assert(
      releaseAllResult.count === 3,
      `Should have released 3 units, got ${releaseAllResult.count}`
    );

    // Verify all units are active again
    const activeUnits = pocketService.getActiveUnits(player);
    test.assert(activeUnits.length === 3, `Should have 3 active units, got ${activeUnits.length}`);

    pocketed = pocketService.getPocketedUnits(player);
    test.assert(pocketed.length === 0, "Pocket should be empty after release all");

    test.succeed();
  });
}

/**
 * Test getTotalUnitCount includes both active and pocketed
 */
export function pocketServiceTotalCountTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const wolfLevelingService = new WolfLevelingService(messageProvider);
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);
  const pocketService = new UnitPocketService(
    recruitmentService,
    messageProvider,
    wolfLevelingService
  );

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Initially 0 units
    let totalCount = pocketService.getTotalUnitCount(player);
    test.assert(totalCount === 0, "Should start with 0 total units");

    // Recruit 5 units
    resourceService.addEmeralds(player, 100);
    for (let i = 0; i < 5; i++) {
      recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_GUARD);
    }

    totalCount = pocketService.getTotalUnitCount(player);
    test.assert(totalCount === 5, `Should have 5 total units (all active), got ${totalCount}`);

    // Pocket 2 units
    const activeUnits = pocketService.getActiveUnits(player);
    pocketService.pocketUnit(player, activeUnits[0]);
    pocketService.pocketUnit(player, activeUnits[1]);

    totalCount = pocketService.getTotalUnitCount(player);
    test.assert(
      totalCount === 5,
      `Should still have 5 total units (3 active + 2 pocketed), got ${totalCount}`
    );

    test.succeed();
  });
}

// Register all tests with proper tags
gametest
  .register("MinecraftRaids", "pocketServiceBasicPocket", pocketServiceBasicPocketTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:pocket")
  .tag("batch");

gametest
  .register("MinecraftRaids", "pocketServiceReleaseUnit", pocketServiceReleaseUnitTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:pocket")
  .tag("batch");

gametest
  .register("MinecraftRaids", "pocketServiceOwnership", pocketServiceOwnershipValidationTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:pocket")
  .tag("batch");

gametest
  .register("MinecraftRaids", "pocketServiceCapacity", pocketServiceCapacityLimitTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:pocket")
  .tag("batch");

gametest
  .register("MinecraftRaids", "pocketServiceHealthPreserve", pocketServiceHealthPreservationTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:pocket")
  .tag("batch");

gametest
  .register("MinecraftRaids", "pocketServicePocketAll", pocketServicePocketAllTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:pocket")
  .tag("batch");

gametest
  .register("MinecraftRaids", "pocketServiceReleaseAll", pocketServiceReleaseAllTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:pocket")
  .tag("batch");

gametest
  .register("MinecraftRaids", "pocketServiceTotalCount", pocketServiceTotalCountTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:pocket")
  .tag("batch");
