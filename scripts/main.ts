/**
 * Main entry point for Minecraft Raids behavior pack
 *
 * This file orchestrates the initialization of all systems.
 * Follows SOLID principles:
 * - Single Responsibility: Only orchestrates initialization
 * - Open/Closed: Easy to add new initializers without modifying this file
 * - Dependency Injection: All dependencies are injected
 */

import { system } from "@minecraft/server";
import { MessageProvider } from "./core/messaging/MessageProvider";
import { ResourceService } from "./core/resources/ResourceService";
import { ResourceInitializer } from "./core/initialization/ResourceInitializer";
import { RecruitmentService } from "./core/recruitment/RecruitmentService";
import { UnitPocketService } from "./core/recruitment/UnitPocketService";
import { WelcomeInitializer } from "./core/initialization/WelcomeInitializer";
import { PlayerBookInitializer } from "./core/initialization/PlayerBookInitializer";
import { PlayerBookService } from "./core/features/PlayerBookService";
import { WolfLevelingService } from "./core/features/WolfLevelingService";
import { WolfLevelingInitializer } from "./core/initialization/WolfLevelingInitializer";
import { VillageRaidService } from "./core/features/village/VillageRaidService";
import { ConquestTracker } from "./core/features/village/ConquestTracker";
import { VillageDefenseInitializer } from "./core/initialization/VillageDefenseInitializer";
import { PlayerPowerCalculator } from "./core/features/scaling/PlayerPowerCalculator";
import { WealthCalculationService } from "./core/features/WealthCalculationService";
import { CompassNavigationService } from "./core/features/navigation/CompassNavigationService";
import { CompassInitializer } from "./core/initialization/CompassInitializer";
import { VillageCache } from "./core/features/village/VillageCache";
import { EntityBasedVillageDetector } from "./core/features/village/EntityBasedVillageDetector";
import { VillageDiscoveryCoordinator } from "./core/features/village/VillageDiscoveryCoordinator";
import { ProgressionBasedDifficultyCalculator } from "./core/features/village/ProgressionBasedDifficultyCalculator";
import { VillageDiscoveryInitializer } from "./core/initialization/VillageDiscoveryInitializer";
import type { IInitializer } from "./core/initialization/IInitializer";

/**
 * Initializes all pack systems
 * Uses dependency injection and composition pattern
 */
function initializePack(): void {
  // Create dependencies (Composition Root pattern)
  const messageProvider = new MessageProvider();
  const resourceService = new ResourceService();
  const recruitmentService = new RecruitmentService(resourceService, messageProvider);
  const wolfLevelingService = new WolfLevelingService(messageProvider);
  const unitPocketService = new UnitPocketService(
    recruitmentService,
    messageProvider,
    wolfLevelingService
  );

  // Player power scaling system
  const playerPowerCalculator = new PlayerPowerCalculator(unitPocketService);

  // Wealth tracking and leaderboard system
  const wealthCalculationService = new WealthCalculationService(
    resourceService,
    recruitmentService,
    unitPocketService
  );

  // Village discovery and persistence system
  const villageCache = new VillageCache();
  villageCache.initialize(); // Load from DynamicProperties after world is ready
  const entityDetector = new EntityBasedVillageDetector(villageCache, messageProvider);
  const discoveryCoordinator = new VillageDiscoveryCoordinator(entityDetector, villageCache);

  // Village raid attack system with progression-based difficulty
  const conquestTracker = new ConquestTracker();
  const difficultyCalculator = new ProgressionBasedDifficultyCalculator(
    playerPowerCalculator,
    villageCache
  );
  const villageRaidService = new VillageRaidService(villageCache, difficultyCalculator);

  // Player book with village tracking
  const playerBookService = new PlayerBookService(
    messageProvider,
    resourceService,
    recruitmentService,
    unitPocketService,
    wealthCalculationService,
    villageCache,
    conquestTracker
  );

  // Village compass navigation system (uses village cache)
  const compassNavigationService = new CompassNavigationService(
    messageProvider,
    conquestTracker,
    villageCache
  );

  // Create initializers
  const initializers: IInitializer[] = [
    new WelcomeInitializer(messageProvider),
    new ResourceInitializer(resourceService, messageProvider),
    new PlayerBookInitializer(playerBookService),
    new WolfLevelingInitializer(wolfLevelingService),
    new VillageDiscoveryInitializer(discoveryCoordinator),
    new VillageDefenseInitializer(
      villageRaidService,
      conquestTracker,
      resourceService,
      messageProvider,
      playerPowerCalculator
    ),
    new CompassInitializer(compassNavigationService, messageProvider),
  ];

  // Execute all initializers
  initializers.forEach((initializer) => initializer.initialize());
}

/**
 * Initialize pack on world load
 * Uses runTimeout to defer initialization and ensure dynamic properties are available
 * Note: Messages are sent via playerSpawn events, not at startup
 */
system.run(() => {
  // Defer initialization by 1 tick to ensure world is fully loaded
  system.runTimeout(() => {
    initializePack();
  }, 1);
});
