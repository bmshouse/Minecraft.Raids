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
import { WelcomeInitializer } from "./core/initialization/WelcomeInitializer";
import { PlayerBookInitializer } from "./core/initialization/PlayerBookInitializer";
import { PlayerBookService } from "./core/features/PlayerBookService";
import type { IInitializer } from "./core/initialization/IInitializer";

// Import GameTest files to register them
import "./gametests/WelcomeGameTest";
import "./gametests/MessageProviderGameTest";
import "./gametests/PlayerListGameTest";
import "./gametests/RaidPartyGameTest";

/**
 * Initializes all pack systems
 * Uses dependency injection and composition pattern
 */
function initializePack(): void {
  // Create dependencies (Composition Root pattern)
  const messageProvider = new MessageProvider();
  const playerBookService = new PlayerBookService(messageProvider);

  // Create initializers
  const initializers: IInitializer[] = [
    new WelcomeInitializer(messageProvider),
    new PlayerBookInitializer(playerBookService),
  ];

  // Execute all initializers
  initializers.forEach((initializer) => initializer.initialize());
}

/**
 * Register startup event to initialize pack on world load
 * Note: Messages are sent via playerSpawn events, not at startup
 */
system.beforeEvents.startup.subscribe(() => {
  initializePack();
});
