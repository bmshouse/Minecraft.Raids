/**
 * GameTest for MessageProvider functionality
 * This test validates message retrieval and fallback behavior in-game
 */

import * as gametest from "@minecraft/server-gametest";
import { MessageProvider } from "../core/messaging/MessageProvider";

/**
 * Test that MessageProvider works correctly in-game
 * Validates that messages return RawMessage with correct translate keys
 * The actual translation from .lang file is handled by Minecraft client
 */
export function messageProviderTest(test: gametest.Test) {
  const provider = new MessageProvider();

  // Test 1: Retrieve welcome message - should have translate property
  const welcome = provider.getMessage("mc.raids.welcome");
  test.assert(
    welcome.translate === "mc.raids.welcome",
    `Welcome should have translate key "mc.raids.welcome", got "${welcome.translate}"`
  );

  // Test 2: Retrieve initialized message - should have translate property
  const initialized = provider.getMessage("mc.raids.initialized");
  test.assert(
    initialized.translate === "mc.raids.initialized",
    `Initialized should have translate key "mc.raids.initialized", got "${initialized.translate}"`
  );

  // Test 3: Retrieve version message - should have translate property
  const version = provider.getMessage("mc.raids.version");
  test.assert(
    version.translate === "mc.raids.version",
    `Version should have translate key "mc.raids.version", got "${version.translate}"`
  );

  // Test 4: Test runtime override
  // When using setMessage, should return text property instead of translate
  provider.setMessage("test.key", "Test Override");
  const override = provider.getMessage("test.key");
  test.assert(
    override.text === "Test Override",
    `Override should have text property "Test Override", got "${override.text}"`
  );

  // Test 5: Test that missing keys without override still use translate
  const missing = provider.getMessage("non.existent.key");
  test.assert(
    missing.translate === "non.existent.key",
    `Missing key should still have translate property, got "${missing.translate}"`
  );

  test.succeed();
}

// Register the GameTest
gametest
  .register("MinecraftRaids", "messageProvider", messageProviderTest)
  .maxTicks(50)
  .tag("suite:default");
