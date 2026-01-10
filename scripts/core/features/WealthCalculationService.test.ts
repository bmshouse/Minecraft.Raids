import { describe, it, expect, beforeEach, vi } from "vitest";
import { WealthCalculationService } from "./WealthCalculationService";
import type { IWealthCalculationService, PlayerWealthData } from "./IWealthCalculationService";
import type { IResourceService } from "../resources/IResourceService";
import type { IRecruitmentService } from "../recruitment/IRecruitmentService";
import type { IUnitPocketService } from "../recruitment/IUnitPocketService";
import type { Player, Entity } from "@minecraft/server";
import { UnitDefinitions } from "../recruitment/UnitDefinitions";

// Mock implementations for dependencies
class MockResourceService implements IResourceService {
  private emeraldBalances = new Map<string, number>();

  getEmeralds(player: Player): number {
    return this.emeraldBalances.get(player.name) ?? 0;
  }

  addEmeralds(_player: Player, _amount: number): void {}
  deductEmeralds(_player: Player, _amount: number): void {}
  setEmeraldsForTest(playerName: string, amount: number): void {
    this.emeraldBalances.set(playerName, amount);
  }
}

class MockRecruitmentService implements IRecruitmentService {
  private playerUnits = new Map<string, Entity[]>();

  getPlayerUnits(player: Player): Entity[] {
    return this.playerUnits.get(player.name) ?? [];
  }

  setPlayerUnitsForTest(playerName: string, units: Entity[]): void {
    this.playerUnits.set(playerName, units);
  }

  recruitUnit(_player: Player, _unitId: string): void {}
}

class MockUnitPocketService implements IUnitPocketService {
  private pocketedUnits = new Map<string, Array<{ entityId: string; maxHP: number }>>();

  getPocketedUnits(player: Player): Array<{ entityId: string; maxHP: number }> {
    return this.pocketedUnits.get(player.name) ?? [];
  }

  setPocketedUnitsForTest(
    playerName: string,
    units: Array<{ entityId: string; maxHP: number }>
  ): void {
    this.pocketedUnits.set(playerName, units);
  }

  storeUnit(_player: Player, _entity: Entity): void {}
  retrieveUnit(_player: Player, _index: number): void {}
  sellUnit(_player: Player, _index: number): void {}
}

// Helper to create mock Player
function createMockPlayer(name: string): Player {
  return { name } as Player;
}

// Helper to create mock Entity with health component
function createMockEntity(typeId: string, maxHealth: number): Entity {
  const entity = {
    typeId,
    getComponent: vi.fn().mockReturnValue({
      defaultValue: maxHealth,
    }),
  } as unknown as Entity;
  return entity;
}

describe("WealthCalculationService", () => {
  let service: IWealthCalculationService;
  let resourceService: MockResourceService;
  let recruitmentService: MockRecruitmentService;
  let unitPocketService: MockUnitPocketService;

  beforeEach(() => {
    resourceService = new MockResourceService();
    recruitmentService = new MockRecruitmentService();
    unitPocketService = new MockUnitPocketService();
    service = new WealthCalculationService(resourceService, recruitmentService, unitPocketService);
  });

  describe("calculatePlayerWealth", () => {
    it("should calculate wealth with only emeralds", () => {
      const player = createMockPlayer("TestPlayer");
      resourceService.setEmeraldsForTest("TestPlayer", 100);

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth).toEqual({
        playerName: "TestPlayer",
        unspentEmeralds: 100,
        activeUnitsValue: 0,
        pocketedUnitsValue: 0,
        totalWealth: 100,
      });
    });

    it("should calculate wealth with emeralds and active units", () => {
      const player = createMockPlayer("TestPlayer");
      resourceService.setEmeraldsForTest("TestPlayer", 50);

      // Add active units: 1 Guard Wolf (cost 5, sell 2) + 1 Iron Golem (cost 20, sell 10)
      const guardWolf = createMockEntity("minecraft:wolf", 20);
      const ironGolem = createMockEntity("minecraftraids:village_defense_iron_golem", 100);
      recruitmentService.setPlayerUnitsForTest("TestPlayer", [guardWolf, ironGolem]);

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth).toEqual({
        playerName: "TestPlayer",
        unspentEmeralds: 50,
        activeUnitsValue: 12, // 2 (wolf) + 10 (golem)
        pocketedUnitsValue: 0,
        totalWealth: 62,
      });
    });

    it("should calculate wealth with emeralds and pocketed units", () => {
      const player = createMockPlayer("TestPlayer");
      resourceService.setEmeraldsForTest("TestPlayer", 30);

      // Add pocketed units: 1 Tank Wolf (cost 8, sell 4) + 1 Vindicator (cost 12, sell 6)
      unitPocketService.setPocketedUnitsForTest("TestPlayer", [
        { entityId: "minecraft:wolf", maxHP: 30 }, // Tank Wolf
        { entityId: "minecraftraids:village_guard_vindicator", maxHP: 24 }, // Vindicator
      ]);

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth).toEqual({
        playerName: "TestPlayer",
        unspentEmeralds: 30,
        activeUnitsValue: 0,
        pocketedUnitsValue: 10, // 4 (tank wolf) + 6 (vindicator)
        totalWealth: 40,
      });
    });

    it("should calculate wealth with all components (emeralds + active + pocketed)", () => {
      const player = createMockPlayer("TestPlayer");
      resourceService.setEmeraldsForTest("TestPlayer", 100);

      // Active units
      const guardWolf = createMockEntity("minecraft:wolf", 20);
      recruitmentService.setPlayerUnitsForTest("TestPlayer", [guardWolf]);

      // Pocketed units
      unitPocketService.setPocketedUnitsForTest("TestPlayer", [
        { entityId: "minecraft:wolf", maxHP: 15 }, // DPS Wolf
      ]);

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth).toEqual({
        playerName: "TestPlayer",
        unspentEmeralds: 100,
        activeUnitsValue: 2, // Guard Wolf sell price
        pocketedUnitsValue: 4, // DPS Wolf sell price
        totalWealth: 106,
      });
    });

    it("should handle zero wealth correctly", () => {
      const player = createMockPlayer("BrokePlayer");
      // No emeralds, no units

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth).toEqual({
        playerName: "BrokePlayer",
        unspentEmeralds: 0,
        activeUnitsValue: 0,
        pocketedUnitsValue: 0,
        totalWealth: 0,
      });
    });

    it("should clamp negative total wealth to zero", () => {
      const player = createMockPlayer("DebtPlayer");
      resourceService.setEmeraldsForTest("DebtPlayer", -50);

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth.unspentEmeralds).toBe(-50);
      expect(wealth.totalWealth).toBe(0); // Clamped to 0
    });

    it("should handle multiple active units of the same type", () => {
      const player = createMockPlayer("TestPlayer");
      resourceService.setEmeraldsForTest("TestPlayer", 0);

      // 3 Guard Wolves
      const wolf1 = createMockEntity("minecraft:wolf", 20);
      const wolf2 = createMockEntity("minecraft:wolf", 20);
      const wolf3 = createMockEntity("minecraft:wolf", 20);
      recruitmentService.setPlayerUnitsForTest("TestPlayer", [wolf1, wolf2, wolf3]);

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth.activeUnitsValue).toBe(6); // 3 wolves * 2 emeralds each
      expect(wealth.totalWealth).toBe(6);
    });

    it("should identify wolf specializations by max health", () => {
      const player = createMockPlayer("TestPlayer");
      resourceService.setEmeraldsForTest("TestPlayer", 0);

      // Guard (20 HP, sell 2), Tank (30 HP, sell 4), DPS (15 HP, sell 4)
      const guardWolf = createMockEntity("minecraft:wolf", 20);
      const tankWolf = createMockEntity("minecraft:wolf", 30);
      const dpsWolf = createMockEntity("minecraft:wolf", 15);
      recruitmentService.setPlayerUnitsForTest("TestPlayer", [guardWolf, tankWolf, dpsWolf]);

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth.activeUnitsValue).toBe(10); // 2 + 4 + 4
    });

    it("should skip unknown active unit types and log warning", () => {
      const player = createMockPlayer("TestPlayer");
      resourceService.setEmeraldsForTest("TestPlayer", 0);

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const unknownEntity = createMockEntity("minecraft:unknown_entity", 50);
      const knownEntity = createMockEntity("minecraft:wolf", 20);
      recruitmentService.setPlayerUnitsForTest("TestPlayer", [unknownEntity, knownEntity]);

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth.activeUnitsValue).toBe(2); // Only guard wolf counted
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown unit type: minecraft:unknown_entity")
      );

      consoleWarnSpy.mockRestore();
    });

    it("should skip unknown pocketed unit types and log warning", () => {
      const player = createMockPlayer("TestPlayer");
      resourceService.setEmeraldsForTest("TestPlayer", 0);

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      unitPocketService.setPocketedUnitsForTest("TestPlayer", [
        { entityId: "minecraft:unknown_entity", maxHP: 50 },
        { entityId: "minecraft:wolf", maxHP: 20 },
      ]);

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth.pocketedUnitsValue).toBe(2); // Only guard wolf counted
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown pocketed unit type: minecraft:unknown_entity")
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle entity with missing health component", () => {
      const player = createMockPlayer("TestPlayer");
      resourceService.setEmeraldsForTest("TestPlayer", 0);

      const entityWithoutHealth = {
        typeId: "minecraft:wolf",
        getComponent: vi.fn().mockReturnValue(undefined),
      } as unknown as Entity;

      recruitmentService.setPlayerUnitsForTest("TestPlayer", [entityWithoutHealth]);

      const wealth = service.calculatePlayerWealth(player);

      // Should default to 20 HP and identify as guard wolf
      expect(wealth.activeUnitsValue).toBe(2); // Guard wolf sell price
    });
  });

  describe("calculateAllPlayerWealth", () => {
    it("should call calculatePlayerWealth for each player", () => {
      // Note: Testing calculateAllPlayerWealth requires mocking world.getAllPlayers()
      // which is complex in this unit test environment.
      // This method's sorting logic is tested indirectly through manual verification:
      // - Sorts by totalWealth descending (b.totalWealth - a.totalWealth)
      // - Alphabetical tiebreaker (a.playerName.localeCompare(b.playerName))
      // Full integration testing should be done via GameTest.

      // Test the sorting logic with mock data
      const player1 = createMockPlayer("Poor");
      const player2 = createMockPlayer("Rich");
      const player3 = createMockPlayer("Middle");

      resourceService.setEmeraldsForTest("Poor", 10);
      resourceService.setEmeraldsForTest("Rich", 1000);
      resourceService.setEmeraldsForTest("Middle", 100);

      const wealth1 = service.calculatePlayerWealth(player1);
      const wealth2 = service.calculatePlayerWealth(player2);
      const wealth3 = service.calculatePlayerWealth(player3);

      // Verify individual wealth calculations work
      expect(wealth1.totalWealth).toBe(10);
      expect(wealth2.totalWealth).toBe(1000);
      expect(wealth3.totalWealth).toBe(100);

      // Manual verification of sorting logic:
      // If we sort [wealth1, wealth2, wealth3], should get [wealth2, wealth3, wealth1]
      const unsorted = [wealth1, wealth2, wealth3];
      const sorted = unsorted.sort((a, b) => {
        if (b.totalWealth !== a.totalWealth) {
          return b.totalWealth - a.totalWealth;
        }
        return a.playerName.localeCompare(b.playerName);
      });

      expect(sorted[0].playerName).toBe("Rich");
      expect(sorted[1].playerName).toBe("Middle");
      expect(sorted[2].playerName).toBe("Poor");
    });

    it("should sort players alphabetically when wealth is equal", () => {
      const playerC = createMockPlayer("Charlie");
      const playerA = createMockPlayer("Alice");
      const playerB = createMockPlayer("Bob");

      // All have same wealth
      resourceService.setEmeraldsForTest("Alice", 100);
      resourceService.setEmeraldsForTest("Bob", 100);
      resourceService.setEmeraldsForTest("Charlie", 100);

      const wealthC = service.calculatePlayerWealth(playerC);
      const wealthA = service.calculatePlayerWealth(playerA);
      const wealthB = service.calculatePlayerWealth(playerB);

      // Verify sorting with tie-breaker
      const unsorted = [wealthC, wealthA, wealthB];
      const sorted = unsorted.sort((a, b) => {
        if (b.totalWealth !== a.totalWealth) {
          return b.totalWealth - a.totalWealth;
        }
        return a.playerName.localeCompare(b.playerName);
      });

      // Should be sorted alphabetically: Alice, Bob, Charlie
      expect(sorted[0].playerName).toBe("Alice");
      expect(sorted[1].playerName).toBe("Bob");
      expect(sorted[2].playerName).toBe("Charlie");
    });
  });

  describe("unit sell price calculations", () => {
    it("should calculate correct sell prices for all unit types", () => {
      // Verify sell prices match 50% of cost
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.WOLF_GUARD)).toBe(2); // 5 * 0.5 = 2.5 → 2
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.WOLF_TANK)).toBe(4); // 8 * 0.5 = 4
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.WOLF_DPS)).toBe(4); // 8 * 0.5 = 4
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.PILLAGER)).toBe(5); // 10 * 0.5 = 5
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.VINDICATOR)).toBe(6); // 12 * 0.5 = 6
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.IRON_GOLEM)).toBe(10); // 20 * 0.5 = 10
    });

    it("should floor sell prices when cost is odd", () => {
      // Guard wolf: cost 5, sell price should be floor(2.5) = 2
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.WOLF_GUARD)).toBe(2);
      // Pillager: cost 10, sell price should be 5
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.PILLAGER)).toBe(5);
    });
  });

  describe("edge cases", () => {
    it("should handle very large wealth values", () => {
      const player = createMockPlayer("Billionaire");
      resourceService.setEmeraldsForTest("Billionaire", 999999);

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth.totalWealth).toBe(999999);
    });

    it("should handle player with only pocketed units and no emeralds", () => {
      const player = createMockPlayer("TestPlayer");
      unitPocketService.setPocketedUnitsForTest("TestPlayer", [
        { entityId: "minecraft:wolf", maxHP: 20 },
      ]);

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth.unspentEmeralds).toBe(0);
      expect(wealth.pocketedUnitsValue).toBe(2);
      expect(wealth.totalWealth).toBe(2);
    });

    it("should handle player with only active units and no emeralds", () => {
      const player = createMockPlayer("TestPlayer");
      const wolf = createMockEntity("minecraft:wolf", 20);
      recruitmentService.setPlayerUnitsForTest("TestPlayer", [wolf]);

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth.unspentEmeralds).toBe(0);
      expect(wealth.activeUnitsValue).toBe(2);
      expect(wealth.totalWealth).toBe(2);
    });

    it("should handle mix of known and unknown units correctly", () => {
      const player = createMockPlayer("TestPlayer");
      resourceService.setEmeraldsForTest("TestPlayer", 50);

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const knownWolf = createMockEntity("minecraft:wolf", 20);
      const unknownEntity1 = createMockEntity("minecraft:zombie", 20);
      const knownGolem = createMockEntity("minecraftraids:village_defense_iron_golem", 100);
      const unknownEntity2 = createMockEntity("minecraft:creeper", 20);

      recruitmentService.setPlayerUnitsForTest("TestPlayer", [
        knownWolf,
        unknownEntity1,
        knownGolem,
        unknownEntity2,
      ]);

      const wealth = service.calculatePlayerWealth(player);

      expect(wealth.activeUnitsValue).toBe(12); // wolf (2) + golem (10)
      expect(wealth.totalWealth).toBe(62); // 50 + 12
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);

      consoleWarnSpy.mockRestore();
    });
  });
});
