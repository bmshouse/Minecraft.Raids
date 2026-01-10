import * as gametest from "@minecraft/server-gametest";
import { WealthCalculationService } from "../core/features/WealthCalculationService";
import { ResourceService } from "../core/resources/ResourceService";
import { RecruitmentService } from "../core/recruitment/RecruitmentService";
import { UnitPocketService } from "../core/recruitment/UnitPocketService";
import { MessageProvider } from "../core/messaging/MessageProvider";
import { WolfLevelingService } from "../core/features/WolfLevelingService";
import { UnitDefinitions } from "../core/recruitment/UnitDefinitions";
import { GameTestTiming, GameTestTimeouts } from "./GameTestConstants";

/**
 * GameTests for WealthCalculationService
 *
 * Tests wealth tracking with actual Minecraft entities:
 * - Calculating wealth from emeralds, active units, and pocketed units
 * - Real-time wealth updates as units are recruited/sold/pocketed
 * - Multi-player wealth comparison
 */

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
 * Test calculating wealth from emeralds only
 */
export function wealthCalculationEmeraldsOnlyTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const wolfLevelingService = new WolfLevelingService(messageProvider);
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);
  const unitPocketService = new UnitPocketService(
    recruitmentService,
    messageProvider,
    wolfLevelingService
  );
  const wealthService = new WealthCalculationService(
    resourceService,
    recruitmentService,
    unitPocketService
  );

  // SimulatedPlayer needs extra time to fully initialize (including name property)
  test.runAfterDelay(GameTestTiming.COMPLEX_INTERACTION, () => {
    // Give player 100 emeralds
    resourceService.addEmeralds(player, 85);

    // Calculate wealth
    const wealth = wealthService.calculatePlayerWealth(player);

    // SimulatedPlayer names have an ID suffix like "TestPlayer(39)"
    test.assert(
      wealth.playerName.startsWith("TestPlayer"),
      `Player name should start with 'TestPlayer', got '${wealth.playerName}'`
    );
    test.assert(
      wealth.unspentEmeralds === 100,
      `Should have 100 emeralds, got ${wealth.unspentEmeralds}`
    );
    test.assert(wealth.activeUnitsValue === 0, "Should have 0 active units value");
    test.assert(wealth.pocketedUnitsValue === 0, "Should have 0 pocketed units value");
    test.assert(
      wealth.totalWealth === 100,
      `Total wealth should be 100, got ${wealth.totalWealth}`
    );

    test.succeed();
  });
}

/**
 * Test calculating wealth with active units
 */
export function wealthCalculationWithActiveUnitsTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const wolfLevelingService = new WolfLevelingService(messageProvider);
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);
  const unitPocketService = new UnitPocketService(
    recruitmentService,
    messageProvider,
    wolfLevelingService
  );
  const wealthService = new WealthCalculationService(
    resourceService,
    recruitmentService,
    unitPocketService
  );

  test.runAfterDelay(GameTestTiming.COMPLEX_INTERACTION, () => {
    // Give player emeralds and recruit units
    resourceService.addEmeralds(player, 35);

    // Recruit 2 units: Wolf (cost 5, sell 2) + Pillager (cost 10, sell 5)
    const wolf = recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_GUARD);
    const pillager = recruitmentService.recruitUnit(player, UnitDefinitions.PILLAGER);

    // CRITICAL: Trigger entity_spawned for GameTest entities
    wolf.entity!.triggerEvent("minecraft:entity_spawned");
    pillager.entity!.triggerEvent("minecraft:entity_spawned");

    // Player should have 35 emeralds left (50 - 5 - 10)
    // Units value: 2 + 5 = 7
    // Total wealth: 35 + 7 = 42

    const wealth = wealthService.calculatePlayerWealth(player);

    test.assert(
      wealth.unspentEmeralds === 35,
      `Should have 35 emeralds remaining, got ${wealth.unspentEmeralds}`
    );
    test.assert(
      wealth.activeUnitsValue === 7,
      `Active units should be worth 7 emeralds, got ${wealth.activeUnitsValue}`
    );
    test.assert(wealth.totalWealth === 42, `Total wealth should be 42, got ${wealth.totalWealth}`);

    test.succeed();
  });
}

/**
 * Test calculating wealth with pocketed units
 */
export function wealthCalculationWithPocketedUnitsTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const wolfLevelingService = new WolfLevelingService(messageProvider);
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);
  const unitPocketService = new UnitPocketService(
    recruitmentService,
    messageProvider,
    wolfLevelingService
  );
  const wealthService = new WealthCalculationService(
    resourceService,
    recruitmentService,
    unitPocketService
  );

  test.runAfterDelay(GameTestTiming.COMPLEX_INTERACTION, () => {
    // Give player emeralds
    resourceService.addEmeralds(player, 85);

    // Recruit units
    const recruit1 = recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_GUARD);
    const recruit2 = recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_TANK);

    // Initialize both recruited entities properly for GameTests
    initializeRecruitedEntity(test, recruit1.entity!, UnitDefinitions.WOLF_GUARD, () => {
      initializeRecruitedEntity(test, recruit2.entity!, UnitDefinitions.WOLF_TANK, () => {
        // Pocket both units
        unitPocketService.pocketUnit(player, recruit1.entity!);
        unitPocketService.pocketUnit(player, recruit2.entity!);

        // Player spent 13 emeralds (5 + 8), has 87 left
        // Pocketed units worth: 2 + 4 = 6
        // Total: 87 + 6 = 93

        const wealth = wealthService.calculatePlayerWealth(player);

        test.assert(
          wealth.unspentEmeralds === 87,
          `Should have 87 emeralds, got ${wealth.unspentEmeralds}`
        );
        test.assert(
          wealth.activeUnitsValue === 0,
          `Should have 0 active units (both pocketed), got ${wealth.activeUnitsValue}`
        );
        test.assert(
          wealth.pocketedUnitsValue === 6,
          `Pocketed units should be worth 6, got ${wealth.pocketedUnitsValue}`
        );
        test.assert(
          wealth.totalWealth === 93,
          `Total wealth should be 93, got ${wealth.totalWealth}`
        );

        test.succeed();
      });
    });
  });
}

/**
 * Test wealth calculation with mixed active and pocketed units
 */
export function wealthCalculationMixedUnitsTest(test: gametest.Test) {
  const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 0 }, "TestPlayer");
  const resourceService = new ResourceService();
  const messageProvider = new MessageProvider();
  const wolfLevelingService = new WolfLevelingService(messageProvider);
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);
  const unitPocketService = new UnitPocketService(
    recruitmentService,
    messageProvider,
    wolfLevelingService
  );
  const wealthService = new WealthCalculationService(
    resourceService,
    recruitmentService,
    unitPocketService
  );

  test.runAfterDelay(GameTestTiming.COMPLEX_INTERACTION, () => {
    // Give player emeralds
    resourceService.addEmeralds(player, 85);

    // Recruit 3 units
    const unit1 = recruitmentService.recruitUnit(player, UnitDefinitions.WOLF_GUARD); // Cost 5, sell 2
    const unit2 = recruitmentService.recruitUnit(player, UnitDefinitions.PILLAGER); // Cost 10, sell 5 - keep active
    const unit3 = recruitmentService.recruitUnit(player, UnitDefinitions.VINDICATOR); // Cost 12, sell 6 - keep active

    // CRITICAL: Trigger entity_spawned for GameTest entities
    unit1.entity!.triggerEvent("minecraft:entity_spawned");
    unit2.entity!.triggerEvent("minecraft:entity_spawned");
    unit3.entity!.triggerEvent("minecraft:entity_spawned");

    // Pocket unit1, keep the other two active
    unitPocketService.pocketUnit(player, unit1.entity!);

    // Spent: 5 + 10 + 12 = 27
    // Remaining emeralds: 73
    // Active units: 5 + 6 = 11
    // Pocketed units: 2
    // Total: 73 + 11 + 2 = 86

    const wealth = wealthService.calculatePlayerWealth(player);

    test.assert(
      wealth.unspentEmeralds === 73,
      `Should have 73 emeralds, got ${wealth.unspentEmeralds}`
    );
    test.assert(
      wealth.activeUnitsValue === 11,
      `Active units should be worth 11, got ${wealth.activeUnitsValue}`
    );
    test.assert(
      wealth.pocketedUnitsValue === 2,
      `Pocketed units should be worth 2, got ${wealth.pocketedUnitsValue}`
    );
    test.assert(wealth.totalWealth === 86, `Total wealth should be 86, got ${wealth.totalWealth}`);

    test.succeed();
  });
}

// Register all tests with proper tags
gametest
  .register("MinecraftRaids", "wealthCalculationEmeralds", wealthCalculationEmeraldsOnlyTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:wealth")
  .tag("batch");

gametest
  .register("MinecraftRaids", "wealthCalculationActiveUnits", wealthCalculationWithActiveUnitsTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:wealth")
  .tag("batch");

gametest
  .register("MinecraftRaids", "wealthCalculationPocketed", wealthCalculationWithPocketedUnitsTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:wealth")
  .tag("batch");

gametest
  .register("MinecraftRaids", "wealthCalculationMixed", wealthCalculationMixedUnitsTest)
  .maxTicks(GameTestTimeouts.NORMAL)
  .structureName("MinecraftRaids:simple")
  .tag("suite:wealth")
  .tag("batch");
