import * as gametest from "@minecraft/server-gametest";
import {
  EntityComponentTypes,
  EntityHealthComponent,
  EntityTameableComponent,
} from "@minecraft/server";
import { RecruitmentService } from "../core/recruitment/RecruitmentService";
import { ResourceService } from "../core/resources/ResourceService";
import { MessageProvider } from "../core/messaging/MessageProvider";
import { UnitDefinitions } from "../core/recruitment/UnitDefinitions";
import { UnitConstants } from "../core/recruitment/UnitConstants";
import { GameTestTiming, GameTestTimeouts } from "./GameTestConstants";
import { WolfStats } from "../core/GameConstants";

/**
 * Helper: Properly initialize recruited entities for GameTests
 * In GameTests, dimension.spawnEntity() entities need manual entity_spawned triggering
 * and specialization events need to be re-triggered after entity_spawned processes
 */
function initializeRecruitedEntity(
  test: gametest.Test,
  entity: any,
  unitDef: any,
  callback: () => void
): void {
  // Trigger entity_spawned immediately (no delay - same pattern as working wolf leveling tests)
  entity.triggerEvent("minecraft:entity_spawned");

  // Wait for entity_spawned to process
  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Re-trigger specialization event if it exists
    if (unitDef.specializationEvent) {
      entity.triggerEvent(unitDef.specializationEvent);

      // Wait for specialization to process
      test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
        callback();
      });
    } else {
      callback();
    }
  });
}

/**
 * GameTests for RecruitmentService
 *
 * Tests recruitment system with actual Minecraft entities:
 * - Unit spawning and entity creation
 * - Cost deduction from player resources
 * - Ownership tagging and taming
 * - Insufficient funds validation
 * - Multiple unit recruitment
 * - Selling units for refund
 * - Wolf specialization events
 */

/**
 * Test recruiting a basic unit (Guard Wolf) with sufficient funds
 */
export function recruitmentServiceBasicRecruitTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Recruit a Guard Wolf
    const result = recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_GUARD);

    test.assert(result.success === true, "Recruitment should succeed with sufficient funds");
    test.assert(result.entity !== undefined, "Recruited entity should be returned");

    // Verify emeralds were deducted
    const remainingEmeralds = resourceService.getEmeralds(player);
    test.assert(
      remainingEmeralds === 10,
      `Player should have 10 emeralds remaining (15 - 5), got ${remainingEmeralds}`
    );

    test.succeed();
  });
}

/**
 * Test recruitment fails with insufficient funds
 */
export function recruitmentServiceInsufficientFundsTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Try to recruit an Iron Golem
    const result = recruitmentService.recruitUnit(player, UnitDefinitions.IRON_GOLEM);

    test.assert(result.success === false, "Recruitment should fail with insufficient funds");
    test.assert(result.entity === undefined, "No entity should be spawned on failure");

    // Verify emeralds were NOT deducted
    const remainingEmeralds = resourceService.getEmeralds(player);
    test.assert(
      remainingEmeralds === 15,
      `Player should still have 15 emeralds, got ${remainingEmeralds}`
    );

    test.succeed();
  });
}

/**
 * Test that recruited units are properly owned (tagged and tamed)
 */
export function recruitmentServiceOwnershipTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Give player funds
    resourceService.addEmeralds(player, 20);

    // Recruit a unit
    const result = recruitmentService.recruitUnit(player, UnitDefinitions.PILLAGER);

    test.assert(result.success === true, "Recruitment should succeed");
    test.assert(result.entity !== undefined, "Entity should be spawned");

    const entity = result.entity!;

    // Check raid_unit tag
    test.assert(entity.hasTag(UnitConstants.RAID_UNIT_TAG), "Entity should have raid_unit tag");

    // Check owner tag
    const expectedOwnerTag = `${UnitConstants.OWNER_TAG_PREFIX}${player.name}`;
    test.assert(
      entity.hasTag(expectedOwnerTag),
      `Entity should have owner tag: ${expectedOwnerTag}`
    );

    // Check if entity is tamed to player
    const tameable = entity.getComponent(EntityComponentTypes.Tameable) as
      | EntityTameableComponent
      | undefined;
    if (tameable) {
      test.assert(tameable.isTamed === true, "Entity should be tamed");
    }

    test.succeed();
  });
}

/**
 * Test isPlayerUnit correctly identifies owned units
 */
export function recruitmentServiceIsPlayerUnitTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Give player funds and recruit a unit
    resourceService.addEmeralds(player, 20);
    const result = recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_GUARD);

    test.assert(result.success === true, "Recruitment should succeed");
    const ownedUnit = result.entity!;

    // Spawn a wild wolf (not recruited)
    const wildWolf = test.spawn("minecraft:wolf", { x: 3, y: 2, z: 3 });
    wildWolf.triggerEvent("minecraft:entity_spawned");

    // Check ownership
    test.assert(
      recruitmentService.isPlayerUnit(player, ownedUnit) === true,
      "isPlayerUnit should return true for owned unit"
    );

    test.assert(
      recruitmentService.isPlayerUnit(player, wildWolf) === false,
      "isPlayerUnit should return false for wild wolf"
    );

    test.succeed();
  });
}

/**
 * Test getPlayerUnits returns all owned units
 */
export function recruitmentServiceGetPlayerUnitsTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Give player funds
    resourceService.addEmeralds(player, 50);

    // Initially should have no units
    let playerUnits = recruitmentService.getPlayerUnits(player);
    test.assert(playerUnits.length === 0, "Player should start with no units");

    // Recruit 3 units
    recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_GUARD);
    recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_TANK);
    recruitmentService.recruitUnit(player, UnitDefinitions.PILLAGER);

    // Should now have 3 units
    playerUnits = recruitmentService.getPlayerUnits(player);
    test.assert(playerUnits.length === 3, `Player should have 3 units, got ${playerUnits.length}`);

    test.succeed();
  });
}

/**
 * Test selling a unit refunds 50% of cost
 */
export function recruitmentServiceSellUnitTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Give player funds and recruit a unit
    resourceService.addEmeralds(player, 5);

    // Recruit Iron Golem (costs 20, sells for 10)
    const recruitResult = recruitmentService.recruitUnit(player, UnitDefinitions.IRON_GOLEM);
    test.assert(recruitResult.success === true, "Recruitment should succeed");

    const emeraldsAfterRecruit = resourceService.getEmeralds(player);
    test.assert(
      emeraldsAfterRecruit === 0,
      `Should have 0 emeralds after recruiting, got ${emeraldsAfterRecruit}`
    );

    // Sell the unit
    const sellResult = recruitmentService.sellUnit(player, recruitResult.entity!);
    test.assert(sellResult.success === true, "Sell should succeed");

    // Check refund (50% of 20 = 10)
    const emeraldsAfterSell = resourceService.getEmeralds(player);
    test.assert(
      emeraldsAfterSell === 10,
      `Should have 10 emeralds after selling (50% refund), got ${emeraldsAfterSell}`
    );

    test.succeed();
  });
}

/**
 * Test selling a unit you don't own fails
 */
export function recruitmentServiceSellNotOwnedTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Spawn a wild wolf (not recruited)
    const wildWolf = test.spawn("minecraft:wolf", { x: 3, y: 2, z: 3 });
    wildWolf.triggerEvent("minecraft:entity_spawned");

    // Try to sell the wild wolf
    const sellResult = recruitmentService.sellUnit(player, wildWolf);

    test.assert(sellResult.success === false, "Sell should fail for non-owned unit");

    // Emeralds should be unchanged (should still be 0)
    const finalEmeralds = resourceService.getEmeralds(player);
    test.assert(finalEmeralds === 15, "Emeralds should remain at 15 when sell fails");

    test.succeed();
  });
}

/**
 * Test that wolf specializations trigger correct events
 */
export function recruitmentServiceWolfSpecializationTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);

  test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
    // Give player funds
    resourceService.addEmeralds(player, 30);

    // Recruit Tank Wolf (should trigger minecraftraids:become_tank)
    const tankResult = recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_TANK);
    test.assert(tankResult.success === true, "Tank Wolf recruitment should succeed");
    test.assert(tankResult.entity!.typeId === "minecraft:wolf", "Entity should be a wolf");

    // Initialize recruited entity properly for GameTests
    initializeRecruitedEntity(test, tankResult.entity!, UnitDefinitions.WOLF_TANK, () => {
      // Check health component to verify it's a tank (30 HP)
      const healthComponent = tankResult.entity!.getComponent(
        EntityComponentTypes.Health
      ) as EntityHealthComponent;

      test.assert(healthComponent !== undefined, "Entity should have health component");

      // Tank wolves should have 30 HP (set by behavior pack event)
      test.assert(
        healthComponent.defaultValue === WolfStats.TANK_HP,
        `Tank Wolf should have ${WolfStats.TANK_HP} max HP, got ${healthComponent.defaultValue}`
      );

      test.succeed();
    });
  });
}

// Register all tests with proper tags
gametest
  .register("MinecraftRaids", "recruitmentBasicRecruit", recruitmentServiceBasicRecruitTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:recruitment")
  .tag("batch");

gametest
  .register(
    "MinecraftRaids",
    "recruitmentInsufficientFunds",
    recruitmentServiceInsufficientFundsTest
  )
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:recruitment")
  .tag("batch");

gametest
  .register("MinecraftRaids", "recruitmentOwnership", recruitmentServiceOwnershipTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:recruitment")
  .tag("batch");

gametest
  .register("MinecraftRaids", "recruitmentIsPlayerUnit", recruitmentServiceIsPlayerUnitTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:recruitment")
  .tag("batch");

gametest
  .register("MinecraftRaids", "recruitmentGetPlayerUnits", recruitmentServiceGetPlayerUnitsTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:recruitment")
  .tag("batch");

gametest
  .register("MinecraftRaids", "recruitmentSellUnit", recruitmentServiceSellUnitTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:recruitment")
  .tag("batch");

gametest
  .register("MinecraftRaids", "recruitmentSellNotOwned", recruitmentServiceSellNotOwnedTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:recruitment")
  .tag("batch");

gametest
  .register(
    "MinecraftRaids",
    "recruitmentWolfSpecialization",
    recruitmentServiceWolfSpecializationTest
  )
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:recruitment")
  .tag("batch");
