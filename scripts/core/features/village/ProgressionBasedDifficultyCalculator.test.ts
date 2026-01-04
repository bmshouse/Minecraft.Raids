import { describe, it, expect, beforeEach } from "vitest";
import { ProgressionBasedDifficultyCalculator } from "./ProgressionBasedDifficultyCalculator";
import { DefenseTier } from "./DefenseConfiguration";
import type { IPlayerPowerCalculator, PlayerPowerLevel } from "../scaling/IPlayerPowerCalculator";
import type { IVillageCache, CachedVillage } from "./IVillageCache";
import type { Player } from "@minecraft/server";

/**
 * Unit tests for ProgressionBasedDifficultyCalculator
 *
 * Tests difficulty calculation logic based on:
 * - Player conquest count (progression)
 * - Player power level (equipment + party)
 * - Village sorting and recommendation algorithms
 */
describe("ProgressionBasedDifficultyCalculator", () => {
  let calculator: ProgressionBasedDifficultyCalculator;
  let mockPowerCalculator: IPlayerPowerCalculator;
  let mockVillageCache: IVillageCache;
  let mockPlayer: Partial<Player>;

  // Helper to create mock villages
  const createMockVillage = (
    key: string,
    x: number,
    z: number,
    conqueredBy?: string
  ): CachedVillage => ({
    key,
    location: { x, y: 64, z },
    discoveredAt: Date.now(),
    discoveryMethod: "entity",
    lastConqueredBy: conqueredBy,
    conquestCount: conqueredBy ? 1 : 0,
  });

  // Helper to create mock power level
  const createMockPowerLevel = (totalScore: number): PlayerPowerLevel => {
    let tier: "beginner" | "intermediate" | "advanced" | "expert";
    if (totalScore < 0.25) tier = "beginner";
    else if (totalScore < 0.5) tier = "intermediate";
    else if (totalScore < 0.75) tier = "advanced";
    else tier = "expert";

    return {
      equipmentScore: totalScore * 0.6,
      partyScore: totalScore * 0.4,
      totalScore,
      tier,
    };
  };

  beforeEach(() => {
    mockPlayer = {
      id: "test-player-id",
      name: "TestPlayer",
      location: { x: 0, y: 64, z: 0 },
    } as Player;

    mockPowerCalculator = {
      calculatePowerLevel: () => createMockPowerLevel(0.3), // Default: intermediate
    };

    mockVillageCache = {
      getDiscoveredVillages: () => [],
      addVillage: () => true,
      getVillageByKey: () => null,
      hasDiscovered: () => false,
      recordConquest: () => {},
      clear: () => {},
    };

    calculator = new ProgressionBasedDifficultyCalculator(mockPowerCalculator, mockVillageCache);
  });

  describe("calculateDifficulty - Base tiers from conquest count", () => {
    it("should return None tier for first 3 villages (0-2 conquests)", () => {
      // 0 conquests
      mockVillageCache.getDiscoveredVillages = () => [];
      const village = createMockVillage("v1", 100, 100);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      expect(difficulty).toBe(DefenseTier.None);
    });

    it("should return None tier for exactly 2 conquests", () => {
      mockVillageCache.getDiscoveredVillages = () => [
        createMockVillage("v1", 100, 100, "test-player-id"),
        createMockVillage("v2", 200, 200, "test-player-id"),
      ];
      const village = createMockVillage("v3", 300, 300);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      expect(difficulty).toBe(DefenseTier.None);
    });

    it("should return Light tier for villages 4-8 (3-7 conquests)", () => {
      mockVillageCache.getDiscoveredVillages = () => [
        createMockVillage("v1", 100, 100, "test-player-id"),
        createMockVillage("v2", 200, 200, "test-player-id"),
        createMockVillage("v3", 300, 300, "test-player-id"),
      ];
      const village = createMockVillage("v4", 400, 400);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      expect(difficulty).toBe(DefenseTier.Light);
    });

    it("should return Light tier for exactly 7 conquests", () => {
      mockVillageCache.getDiscoveredVillages = () =>
        Array.from({ length: 7 }, (_, i) =>
          createMockVillage(`v${i}`, i * 100, i * 100, "test-player-id")
        );
      const village = createMockVillage("v8", 800, 800);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      expect(difficulty).toBe(DefenseTier.Light);
    });

    it("should return Medium tier for villages 9-15 (8-14 conquests)", () => {
      mockVillageCache.getDiscoveredVillages = () =>
        Array.from({ length: 8 }, (_, i) =>
          createMockVillage(`v${i}`, i * 100, i * 100, "test-player-id")
        );
      const village = createMockVillage("v9", 900, 900);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      expect(difficulty).toBe(DefenseTier.Medium);
    });

    it("should return Medium tier for exactly 14 conquests", () => {
      mockVillageCache.getDiscoveredVillages = () =>
        Array.from({ length: 14 }, (_, i) =>
          createMockVillage(`v${i}`, i * 100, i * 100, "test-player-id")
        );
      const village = createMockVillage("v15", 1500, 1500);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      expect(difficulty).toBe(DefenseTier.Medium);
    });

    it("should return Heavy tier for 15+ conquests", () => {
      mockVillageCache.getDiscoveredVillages = () =>
        Array.from({ length: 15 }, (_, i) =>
          createMockVillage(`v${i}`, i * 100, i * 100, "test-player-id")
        );
      const village = createMockVillage("v16", 1600, 1600);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      expect(difficulty).toBe(DefenseTier.Heavy);
    });

    it("should return Heavy tier for many conquests", () => {
      mockVillageCache.getDiscoveredVillages = () =>
        Array.from({ length: 50 }, (_, i) =>
          createMockVillage(`v${i}`, i * 100, i * 100, "test-player-id")
        );
      const village = createMockVillage("v51", 5100, 5100);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      expect(difficulty).toBe(DefenseTier.Heavy);
    });
  });

  describe("calculateDifficulty - Power level adjustments", () => {
    it("should increase tier for expert player (0.75+ power)", () => {
      mockPowerCalculator.calculatePowerLevel = () => createMockPowerLevel(0.8); // Expert
      mockVillageCache.getDiscoveredVillages = () => [
        createMockVillage("v1", 100, 100, "test-player-id"),
      ];
      const village = createMockVillage("v2", 200, 200);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      // Base would be None (1 conquest), but expert player gets +1 tier
      expect(difficulty).toBe(DefenseTier.Light);
    });

    it("should not increase tier beyond Heavy for expert player", () => {
      mockPowerCalculator.calculatePowerLevel = () => createMockPowerLevel(0.9); // Expert
      mockVillageCache.getDiscoveredVillages = () =>
        Array.from({ length: 20 }, (_, i) =>
          createMockVillage(`v${i}`, i * 100, i * 100, "test-player-id")
        );
      const village = createMockVillage("v21", 2100, 2100);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      // Base is Heavy, cannot increase further
      expect(difficulty).toBe(DefenseTier.Heavy);
    });

    it("should increase tier for advanced player with 5+ conquests", () => {
      mockPowerCalculator.calculatePowerLevel = () => createMockPowerLevel(0.6); // Advanced
      mockVillageCache.getDiscoveredVillages = () =>
        Array.from({ length: 5 }, (_, i) =>
          createMockVillage(`v${i}`, i * 100, i * 100, "test-player-id")
        );
      const village = createMockVillage("v6", 600, 600);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      // Base would be Light (5 conquests), advanced player with experience gets +1 tier
      expect(difficulty).toBe(DefenseTier.Medium);
    });

    it("should NOT increase tier for advanced player with <5 conquests", () => {
      mockPowerCalculator.calculatePowerLevel = () => createMockPowerLevel(0.6); // Advanced
      mockVillageCache.getDiscoveredVillages = () =>
        Array.from({ length: 3 }, (_, i) =>
          createMockVillage(`v${i}`, i * 100, i * 100, "test-player-id")
        );
      const village = createMockVillage("v4", 400, 400);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      // Base is Light (3 conquests), but not enough experience for boost
      expect(difficulty).toBe(DefenseTier.Light);
    });

    it("should NOT increase tier for beginner player regardless of conquests", () => {
      mockPowerCalculator.calculatePowerLevel = () => createMockPowerLevel(0.1); // Beginner
      mockVillageCache.getDiscoveredVillages = () =>
        Array.from({ length: 10 }, (_, i) =>
          createMockVillage(`v${i}`, i * 100, i * 100, "test-player-id")
        );
      const village = createMockVillage("v11", 1100, 1100);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      // Base is Medium (10 conquests), no power boost for beginner
      expect(difficulty).toBe(DefenseTier.Medium);
    });

    it("should NOT increase tier for intermediate player", () => {
      mockPowerCalculator.calculatePowerLevel = () => createMockPowerLevel(0.4); // Intermediate
      mockVillageCache.getDiscoveredVillages = () =>
        Array.from({ length: 5 }, (_, i) =>
          createMockVillage(`v${i}`, i * 100, i * 100, "test-player-id")
        );
      const village = createMockVillage("v6", 600, 600);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      // Base is Light (5 conquests), intermediate doesn't qualify for boost
      expect(difficulty).toBe(DefenseTier.Light);
    });
  });

  describe("calculateDifficulty - Player filtering", () => {
    it("should only count conquests by the same player", () => {
      mockVillageCache.getDiscoveredVillages = () => [
        createMockVillage("v1", 100, 100, "test-player-id"), // This player
        createMockVillage("v2", 200, 200, "other-player-id"), // Other player
        createMockVillage("v3", 300, 300, "test-player-id"), // This player
        createMockVillage("v4", 400, 400), // Not conquered
      ];
      const village = createMockVillage("v5", 500, 500);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      // Only 2 conquests by test-player-id (within None tier 0-2)
      expect(difficulty).toBe(DefenseTier.None);
    });

    it("should not count unconquered villages", () => {
      mockVillageCache.getDiscoveredVillages = () => [
        createMockVillage("v1", 100, 100, "test-player-id"),
        createMockVillage("v2", 200, 200, "test-player-id"),
        createMockVillage("v3", 300, 300), // Discovered but not conquered
        createMockVillage("v4", 400, 400), // Discovered but not conquered
      ];
      const village = createMockVillage("v5", 500, 500);

      const difficulty = calculator.calculateDifficulty(mockPlayer as Player, village);

      // Only 2 conquests (None tier)
      expect(difficulty).toBe(DefenseTier.None);
    });
  });

  describe("getSuggestedVillages - Sorting algorithm", () => {
    it("should sort villages by difficulty ascending", () => {
      mockPowerCalculator.calculatePowerLevel = () => createMockPowerLevel(0.1); // Beginner
      mockPlayer = { ...mockPlayer, location: { x: 0, y: 64, z: 0 } };

      mockVillageCache.getDiscoveredVillages = () => {
        // Set different conquest counts to create different difficulties
        const villages = [
          createMockVillage("v1", 100, 100), // None (0 conquests)
          createMockVillage("v2", 200, 200), // None
          createMockVillage("v3", 300, 300), // None
        ];

        // Override conquest counts by adding conquered villages
        const conqueredVillages = Array.from({ length: 10 }, (_, i) =>
          createMockVillage(`conquered_${i}`, i * 1000, i * 1000, "test-player-id")
        );

        return [...conqueredVillages, ...villages];
      };

      const allVillages = mockVillageCache
        .getDiscoveredVillages()
        .filter((v) => !v.lastConqueredBy);
      const suggested = calculator.getSuggestedVillages(mockPlayer as Player, allVillages);

      // All should be suggested (no conquered villages in input)
      expect(suggested.length).toBe(3);
    });

    it("should sort by distance when difficulties are equal", () => {
      mockPowerCalculator.calculatePowerLevel = () => createMockPowerLevel(0.1);
      mockPlayer = { ...mockPlayer, location: { x: 0, y: 64, z: 0 } };
      mockVillageCache.getDiscoveredVillages = () => [];

      const villages = [
        createMockVillage("v_far", 1000, 1000), // Distance ~1414
        createMockVillage("v_medium", 300, 400), // Distance = 500
        createMockVillage("v_close", 30, 40), // Distance = 50
      ];

      const suggested = calculator.getSuggestedVillages(mockPlayer as Player, villages);

      // All None tier, should be sorted by distance
      expect(suggested[0].key).toBe("v_close");
      expect(suggested[1].key).toBe("v_medium");
      expect(suggested[2].key).toBe("v_far");
    });

    it("should prioritize easier difficulty over closer distance", () => {
      mockPowerCalculator.calculatePowerLevel = () => createMockPowerLevel(0.1);
      mockPlayer = { ...mockPlayer, location: { x: 0, y: 64, z: 0 } };

      // Create conquests to make different difficulties
      const createVillageWithConquests = (count: number) => {
        mockVillageCache.getDiscoveredVillages = () =>
          Array.from({ length: count }, (_, i) =>
            createMockVillage(`conquered_${i}`, i * 1000, i * 1000, "test-player-id")
          );
      };

      createVillageWithConquests(0);
      const easyFarVillage = createMockVillage("easy_far", 1000, 1000); // None tier, far
      const difficulty1 = calculator.calculateDifficulty(mockPlayer as Player, easyFarVillage);

      createVillageWithConquests(10);
      const hardCloseVillage = createMockVillage("hard_close", 10, 10); // Medium tier, close
      const difficulty2 = calculator.calculateDifficulty(mockPlayer as Player, hardCloseVillage);

      // Verify difficulties are different
      expect(difficulty1).toBeLessThan(difficulty2);
    });

    it("should return empty array for no villages", () => {
      mockVillageCache.getDiscoveredVillages = () => [];

      const suggested = calculator.getSuggestedVillages(mockPlayer as Player, []);

      expect(suggested).toEqual([]);
    });

    it("should handle single village", () => {
      mockVillageCache.getDiscoveredVillages = () => [];
      const village = createMockVillage("v1", 100, 100);

      const suggested = calculator.getSuggestedVillages(mockPlayer as Player, [village]);

      expect(suggested.length).toBe(1);
      expect(suggested[0]).toBe(village);
    });
  });
});
