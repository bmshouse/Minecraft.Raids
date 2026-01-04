/**
 * GameTest timing and configuration constants
 *
 * Common timing patterns used across all GameTests:
 * - Entity initialization requires 5 ticks
 * - Player initialization requires 10 ticks
 * - Complex interactions require 20-30 ticks
 *
 * Usage:
 * ```typescript
 * test.runAfterDelay(GameTestTiming.ENTITY_INIT, () => {
 *   // Entity is ready
 * });
 * ```
 */

/**
 * Standard delay values in ticks (1 tick = 1/20 second)
 */
export const GameTestTiming = {
  /** Entity initialization delay (5 ticks = 250ms) */
  ENTITY_INIT: 5,

  /** Player/SimulatedPlayer initialization delay (10 ticks = 500ms) */
  PLAYER_INIT: 10,

  /** Complex entity interactions (20 ticks = 1s) */
  COMPLEX_INTERACTION: 20,

  /** Multi-step operations (30 ticks = 1.5s) */
  MULTI_STEP: 30,
} as const;

/**
 * Standard test timeout values in ticks
 * Used with .maxTicks() during test registration
 */
export const GameTestTimeouts = {
  /** Quick tests (10 ticks) */
  QUICK: 10,

  /** Short tests (20 ticks) */
  SHORT: 20,

  /** Fast tests (50 ticks) */
  FAST: 50,

  /** Standard tests (100 ticks) */
  STANDARD: 100,

  /** Normal tests (200 ticks) */
  NORMAL: 200,

  /** Extended tests (300 ticks) */
  EXTENDED: 300,

  /** Long tests (500 ticks) */
  LONG: 500,
} as const;

/**
 * Test resource values
 * Used in resource initialization tests
 */
export const GameTestResources = {
  /** Starting emeralds for test scenarios */
  STARTING_EMERALDS: 15,
} as const;
