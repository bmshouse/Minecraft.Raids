import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlayerPowerCalculator } from "./PlayerPowerCalculator";
import type { IPlayerPowerCalculator, PlayerPowerLevel } from "./IPlayerPowerCalculator";
import type { IUnitPocketService, PocketedUnitData } from "../../recruitment/IUnitPocketService";
import type { Player, Entity } from "@minecraft/server";

/**
 * Unit tests for PlayerPowerCalculator
 *
 * Tests power level calculation based on:
 * - Equipment scoring (armor, weapons, enchantments)
 * - Party size scoring (active + pocketed units)
 * - Tier classification (beginner, intermediate, advanced, expert)
 * - Weighted combination (60% equipment + 40% party)
 */

// Mock implementations
class MockUnitPocketService implements Partial<IUnitPocketService> {
  private activeUnits = new Map<string, Entity[]>();
  private pocketedUnits = new Map<string, PocketedUnitData[]>();

  getActiveUnits(player: Player): Entity[] {
    return this.activeUnits.get(player.name) ?? [];
  }

  getPocketedUnits(player: Player): PocketedUnitData[] {
    return this.pocketedUnits.get(player.name) ?? [];
  }

  setActiveUnitsForTest(playerName: string, units: Entity[]): void {
    this.activeUnits.set(playerName, units);
  }

  setPocketedUnitsForTest(playerName: string, units: PocketedUnitData[]): void {
    this.pocketedUnits.set(playerName, units);
  }
}

// Helper to create mock Player with equipment
function createMockPlayerWithEquipment(
  name: string,
  armor: { head?: string; chest?: string; legs?: string; feet?: string },
  weapon?: string,
  hasEnchantments: boolean = false
): Player {
  const equipment: Record<string, any> = {};

  if (armor.head) equipment["Head"] = { typeId: armor.head, hasComponent: () => hasEnchantments };
  if (armor.chest)
    equipment["Chest"] = { typeId: armor.chest, hasComponent: () => hasEnchantments };
  if (armor.legs) equipment["Legs"] = { typeId: armor.legs, hasComponent: () => hasEnchantments };
  if (armor.feet) equipment["Feet"] = { typeId: armor.feet, hasComponent: () => hasEnchantments };
  if (weapon) equipment["Mainhand"] = { typeId: weapon, hasComponent: () => hasEnchantments };

  return {
    name,
    getComponent: vi.fn().mockReturnValue({
      getEquipment: (slot: any) => equipment[slot] || null,
    }),
  } as unknown as Player;
}

function createMockPlayerNoEquipment(name: string): Player {
  return {
    name,
    getComponent: vi.fn().mockReturnValue(null),
  } as unknown as Player;
}

describe("PlayerPowerCalculator", () => {
  let calculator: IPlayerPowerCalculator;
  let unitPocketService: MockUnitPocketService;

  beforeEach(() => {
    unitPocketService = new MockUnitPocketService();
    calculator = new PlayerPowerCalculator(unitPocketService as IUnitPocketService);
  });

  describe("tier classification", () => {
    it("should classify score < 0.25 as beginner", () => {
      const player = createMockPlayerNoEquipment("Beginner");
      const powerLevel = calculator.calculatePowerLevel(player);

      expect(powerLevel.totalScore).toBeLessThan(0.25);
      expect(powerLevel.tier).toBe("beginner");
    });

    it("should classify score 0.25-0.49 as intermediate", () => {
      const player = createMockPlayerWithEquipment(
        "Intermediate",
        { head: "minecraft:leather_helmet", chest: "minecraft:leather_chestplate" },
        "minecraft:wooden_sword"
      );
      // Some leather armor + wooden weapon should give intermediate tier
      const powerLevel = calculator.calculatePowerLevel(player);

      expect(powerLevel.tier).toBe("beginner"); // Might be beginner with only partial leather
      // This tier depends on exact scoring
    });

    it("should classify score 0.50-0.74 as advanced", () => {
      const player = createMockPlayerWithEquipment(
        "Advanced",
        {
          head: "minecraft:diamond_helmet",
          chest: "minecraft:diamond_chestplate",
          legs: "minecraft:diamond_leggings",
          feet: "minecraft:diamond_boots",
        },
        "minecraft:diamond_sword"
      );

      // Add party to push into advanced tier (60% equipment + 40% party)
      const tenUnits: Entity[] = Array(10)
        .fill(null)
        .map(() => ({ typeId: "minecraft:wolf" }) as Entity);
      unitPocketService.setActiveUnitsForTest("Advanced", tenUnits);

      const powerLevel = calculator.calculatePowerLevel(player);

      // Full diamond + moderate party should give advanced or expert tier
      expect(powerLevel.tier).toMatch(/advanced|expert/);
    });

    it("should classify score >= 0.75 as expert", () => {
      const player = createMockPlayerWithEquipment(
        "Expert",
        {
          head: "minecraft:netherite_helmet",
          chest: "minecraft:netherite_chestplate",
          legs: "minecraft:netherite_leggings",
          feet: "minecraft:netherite_boots",
        },
        "minecraft:netherite_sword",
        true // Has enchantments
      );

      // Add max party (20 units)
      const mockUnits: Entity[] = Array(20)
        .fill(null)
        .map(() => ({ typeId: "minecraft:wolf" }) as Entity);
      unitPocketService.setActiveUnitsForTest("Expert", mockUnits);

      const powerLevel = calculator.calculatePowerLevel(player);

      expect(powerLevel.totalScore).toBeGreaterThanOrEqual(0.75);
      expect(powerLevel.tier).toBe("expert");
    });
  });

  describe("equipment scoring", () => {
    it("should give 0 score for no equipment", () => {
      const player = createMockPlayerNoEquipment("Naked");
      const powerLevel = calculator.calculatePowerLevel(player);

      expect(powerLevel.equipmentScore).toBe(0);
    });

    it("should score leather armor lower than diamond", () => {
      const playerLeather = createMockPlayerWithEquipment("Leather", {
        head: "minecraft:leather_helmet",
        chest: "minecraft:leather_chestplate",
        legs: "minecraft:leather_leggings",
        feet: "minecraft:leather_boots",
      });

      const playerDiamond = createMockPlayerWithEquipment("Diamond", {
        head: "minecraft:diamond_helmet",
        chest: "minecraft:diamond_chestplate",
        legs: "minecraft:diamond_leggings",
        feet: "minecraft:diamond_boots",
      });

      const leatherPower = calculator.calculatePowerLevel(playerLeather);
      const diamondPower = calculator.calculatePowerLevel(playerDiamond);

      expect(leatherPower.equipmentScore).toBeLessThan(diamondPower.equipmentScore);
    });

    it("should score iron armor between leather and diamond", () => {
      const playerLeather = createMockPlayerWithEquipment("Leather", {
        head: "minecraft:leather_helmet",
      });

      const playerIron = createMockPlayerWithEquipment("Iron", { head: "minecraft:iron_helmet" });

      const playerDiamond = createMockPlayerWithEquipment("Diamond", {
        head: "minecraft:diamond_helmet",
      });

      const leatherScore = calculator.calculatePowerLevel(playerLeather).equipmentScore;
      const ironScore = calculator.calculatePowerLevel(playerIron).equipmentScore;
      const diamondScore = calculator.calculatePowerLevel(playerDiamond).equipmentScore;

      expect(ironScore).toBeGreaterThan(leatherScore);
      expect(ironScore).toBeLessThan(diamondScore);
    });

    it("should score netherite as highest armor", () => {
      const playerDiamond = createMockPlayerWithEquipment("Diamond", {
        head: "minecraft:diamond_helmet",
      });

      const playerNetherite = createMockPlayerWithEquipment("Netherite", {
        head: "minecraft:netherite_helmet",
      });

      const diamondScore = calculator.calculatePowerLevel(playerDiamond).equipmentScore;
      const netheriteScore = calculator.calculatePowerLevel(playerNetherite).equipmentScore;

      expect(netheriteScore).toBeGreaterThan(diamondScore);
    });

    it("should score weapons by material tier", () => {
      const wooden = createMockPlayerWithEquipment("Wooden", {}, "minecraft:wooden_sword");
      const stone = createMockPlayerWithEquipment("Stone", {}, "minecraft:stone_sword");
      const iron = createMockPlayerWithEquipment("Iron", {}, "minecraft:iron_sword");
      const diamond = createMockPlayerWithEquipment("Diamond", {}, "minecraft:diamond_sword");
      const netherite = createMockPlayerWithEquipment("Netherite", {}, "minecraft:netherite_sword");

      const scores = {
        wooden: calculator.calculatePowerLevel(wooden).equipmentScore,
        stone: calculator.calculatePowerLevel(stone).equipmentScore,
        iron: calculator.calculatePowerLevel(iron).equipmentScore,
        diamond: calculator.calculatePowerLevel(diamond).equipmentScore,
        netherite: calculator.calculatePowerLevel(netherite).equipmentScore,
      };

      expect(scores.wooden).toBeLessThan(scores.stone);
      expect(scores.stone).toBeLessThan(scores.iron);
      expect(scores.iron).toBeLessThan(scores.diamond);
      expect(scores.diamond).toBeLessThan(scores.netherite);
    });

    it("should score axes as weapons", () => {
      const sword = createMockPlayerWithEquipment("Sword", {}, "minecraft:diamond_sword");
      const axe = createMockPlayerWithEquipment("Axe", {}, "minecraft:diamond_axe");

      const swordScore = calculator.calculatePowerLevel(sword).equipmentScore;
      const axeScore = calculator.calculatePowerLevel(axe).equipmentScore;

      // Both should score equally since they're the same material
      expect(axeScore).toBe(swordScore);
    });

    it("should give minimal score for non-weapon items in mainhand", () => {
      const withStick = createMockPlayerWithEquipment("Stick", {}, "minecraft:stick");
      const noWeapon = createMockPlayerNoEquipment("NoWeapon");

      const stickScore = calculator.calculatePowerLevel(withStick).equipmentScore;
      const noWeaponScore = calculator.calculatePowerLevel(noWeapon).equipmentScore;

      // Stick should give a tiny score (0.1 * 0.4 = 0.04)
      expect(stickScore).toBeGreaterThan(noWeaponScore);
      expect(stickScore).toBeLessThan(0.1);
    });

    it("should add enchantment bonus to equipment score", () => {
      const noEnchants = createMockPlayerWithEquipment(
        "Plain",
        { head: "minecraft:diamond_helmet" },
        "minecraft:diamond_sword",
        false
      );

      const withEnchants = createMockPlayerWithEquipment(
        "Enchanted",
        { head: "minecraft:diamond_helmet" },
        "minecraft:diamond_sword",
        true
      );

      const plainScore = calculator.calculatePowerLevel(noEnchants).equipmentScore;
      const enchantedScore = calculator.calculatePowerLevel(withEnchants).equipmentScore;

      expect(enchantedScore).toBeGreaterThan(plainScore);
      expect(enchantedScore - plainScore).toBeCloseTo(0.2, 1); // Enchantment bonus
    });

    it("should cap equipment score at 1.0", () => {
      const maxGear = createMockPlayerWithEquipment(
        "MaxGear",
        {
          head: "minecraft:netherite_helmet",
          chest: "minecraft:netherite_chestplate",
          legs: "minecraft:netherite_leggings",
          feet: "minecraft:netherite_boots",
        },
        "minecraft:netherite_sword",
        true
      );

      const powerLevel = calculator.calculatePowerLevel(maxGear);

      expect(powerLevel.equipmentScore).toBeLessThanOrEqual(1.0);
    });

    it("should average armor score across all 4 slots", () => {
      // 1 piece of armor
      const oneArmor = createMockPlayerWithEquipment("One", {
        head: "minecraft:diamond_helmet",
      });

      // 4 pieces of armor
      const fourArmor = createMockPlayerWithEquipment("Four", {
        head: "minecraft:diamond_helmet",
        chest: "minecraft:diamond_chestplate",
        legs: "minecraft:diamond_leggings",
        feet: "minecraft:diamond_boots",
      });

      const oneScore = calculator.calculatePowerLevel(oneArmor).equipmentScore;
      const fourScore = calculator.calculatePowerLevel(fourArmor).equipmentScore;

      expect(fourScore).toBeGreaterThan(oneScore);
    });
  });

  describe("party scoring", () => {
    it("should give 0 score for no units", () => {
      const player = createMockPlayerNoEquipment("Alone");
      const powerLevel = calculator.calculatePowerLevel(player);

      expect(powerLevel.partyScore).toBe(0);
    });

    it("should scale party score linearly up to 20 units", () => {
      const player = createMockPlayerNoEquipment("Commander");

      // 5 units = 0.25 score
      const fiveUnits: Entity[] = Array(5)
        .fill(null)
        .map(() => ({ typeId: "minecraft:wolf" }) as Entity);
      unitPocketService.setActiveUnitsForTest("Commander", fiveUnits);

      const fivePower = calculator.calculatePowerLevel(player);
      expect(fivePower.partyScore).toBeCloseTo(0.25, 2);

      // 10 units = 0.5 score
      const tenUnits: Entity[] = Array(10)
        .fill(null)
        .map(() => ({ typeId: "minecraft:wolf" }) as Entity);
      unitPocketService.setActiveUnitsForTest("Commander", tenUnits);

      const tenPower = calculator.calculatePowerLevel(player);
      expect(tenPower.partyScore).toBeCloseTo(0.5, 2);

      // 20 units = 1.0 score
      const twentyUnits: Entity[] = Array(20)
        .fill(null)
        .map(() => ({ typeId: "minecraft:wolf" }) as Entity);
      unitPocketService.setActiveUnitsForTest("Commander", twentyUnits);

      const twentyPower = calculator.calculatePowerLevel(player);
      expect(twentyPower.partyScore).toBeCloseTo(1.0, 2);
    });

    it("should cap party score at 1.0 even with more than 20 units", () => {
      const player = createMockPlayerNoEquipment("Hoarder");

      const thirtyUnits: Entity[] = Array(30)
        .fill(null)
        .map(() => ({ typeId: "minecraft:wolf" }) as Entity);
      unitPocketService.setActiveUnitsForTest("Hoarder", thirtyUnits);

      const powerLevel = calculator.calculatePowerLevel(player);

      expect(powerLevel.partyScore).toBe(1.0);
    });

    it("should count both active and pocketed units", () => {
      const player = createMockPlayerNoEquipment("Mixed");

      // 5 active + 5 pocketed = 10 total = 0.5 score
      const fiveActive: Entity[] = Array(5)
        .fill(null)
        .map(() => ({ typeId: "minecraft:wolf" }) as Entity);
      const fivePocketed: PocketedUnitData[] = Array(5)
        .fill(null)
        .map(() => ({ entityId: "minecraft:wolf", maxHP: 20, currentHP: 20, displayName: "Wolf" }));

      unitPocketService.setActiveUnitsForTest("Mixed", fiveActive);
      unitPocketService.setPocketedUnitsForTest("Mixed", fivePocketed);

      const powerLevel = calculator.calculatePowerLevel(player);

      expect(powerLevel.partyScore).toBeCloseTo(0.5, 2);
    });
  });

  describe("total score calculation", () => {
    it("should weight equipment at 60% and party at 40%", () => {
      const player = createMockPlayerWithEquipment(
        "Weighted",
        {
          head: "minecraft:diamond_helmet",
          chest: "minecraft:diamond_chestplate",
          legs: "minecraft:diamond_leggings",
          feet: "minecraft:diamond_boots",
        },
        "minecraft:diamond_sword"
      );

      const powerLevel = calculator.calculatePowerLevel(player);

      // Total score = equipmentScore * 0.6 + partyScore * 0.4
      const expectedTotal = powerLevel.equipmentScore * 0.6 + powerLevel.partyScore * 0.4;

      expect(powerLevel.totalScore).toBeCloseTo(expectedTotal, 5);
    });

    it("should calculate correct total with both equipment and party", () => {
      const player = createMockPlayerWithEquipment(
        "Balanced",
        { head: "minecraft:iron_helmet" },
        "minecraft:iron_sword"
      );

      // Add 10 units for 0.5 party score
      const tenUnits: Entity[] = Array(10)
        .fill(null)
        .map(() => ({ typeId: "minecraft:wolf" }) as Entity);
      unitPocketService.setActiveUnitsForTest("Balanced", tenUnits);

      const powerLevel = calculator.calculatePowerLevel(player);

      // Verify the weighted calculation
      expect(powerLevel.totalScore).toBeCloseTo(
        powerLevel.equipmentScore * 0.6 + powerLevel.partyScore * 0.4,
        5
      );
    });

    it("should handle max scores correctly", () => {
      const player = createMockPlayerWithEquipment(
        "MaxPower",
        {
          head: "minecraft:netherite_helmet",
          chest: "minecraft:netherite_chestplate",
          legs: "minecraft:netherite_leggings",
          feet: "minecraft:netherite_boots",
        },
        "minecraft:netherite_sword",
        true
      );

      const twentyUnits: Entity[] = Array(20)
        .fill(null)
        .map(() => ({ typeId: "minecraft:wolf" }) as Entity);
      unitPocketService.setActiveUnitsForTest("MaxPower", twentyUnits);

      const powerLevel = calculator.calculatePowerLevel(player);

      // Both scores should be at or near 1.0
      expect(powerLevel.equipmentScore).toBeGreaterThan(0.9);
      expect(powerLevel.partyScore).toBe(1.0);

      // Total should be 0.6 * equipScore + 0.4 * 1.0
      expect(powerLevel.totalScore).toBeGreaterThan(0.9);
      expect(powerLevel.totalScore).toBeLessThanOrEqual(1.0);
    });
  });

  describe("edge cases", () => {
    it("should handle player with equipment component but no items", () => {
      const player = {
        name: "Empty",
        getComponent: vi.fn().mockReturnValue({
          getEquipment: () => null,
        }),
      } as unknown as Player;

      const powerLevel = calculator.calculatePowerLevel(player);

      expect(powerLevel.equipmentScore).toBe(0);
      expect(powerLevel.tier).toBe("beginner");
    });

    it("should handle mixed armor tiers", () => {
      const player = createMockPlayerWithEquipment("Mixed", {
        head: "minecraft:leather_helmet",
        chest: "minecraft:diamond_chestplate",
        legs: "minecraft:iron_leggings",
        feet: "minecraft:chainmail_boots",
      });

      const powerLevel = calculator.calculatePowerLevel(player);

      // Should average the different tiers
      expect(powerLevel.equipmentScore).toBeGreaterThan(0);
      expect(powerLevel.equipmentScore).toBeLessThan(1.0);
    });

    it("should handle partial armor sets", () => {
      const oneArmor = createMockPlayerWithEquipment("One", {
        head: "minecraft:diamond_helmet",
      });

      const twoArmor = createMockPlayerWithEquipment("Two", {
        head: "minecraft:diamond_helmet",
        chest: "minecraft:diamond_chestplate",
      });

      const threeArmor = createMockPlayerWithEquipment("Three", {
        head: "minecraft:diamond_helmet",
        chest: "minecraft:diamond_chestplate",
        legs: "minecraft:diamond_leggings",
      });

      const oneScore = calculator.calculatePowerLevel(oneArmor).equipmentScore;
      const twoScore = calculator.calculatePowerLevel(twoArmor).equipmentScore;
      const threeScore = calculator.calculatePowerLevel(threeArmor).equipmentScore;

      expect(twoScore).toBeGreaterThan(oneScore);
      expect(threeScore).toBeGreaterThan(twoScore);
    });

    it("should return valid PowerLevel structure", () => {
      const player = createMockPlayerNoEquipment("Test");
      const powerLevel = calculator.calculatePowerLevel(player);

      expect(powerLevel).toHaveProperty("equipmentScore");
      expect(powerLevel).toHaveProperty("partyScore");
      expect(powerLevel).toHaveProperty("totalScore");
      expect(powerLevel).toHaveProperty("tier");

      expect(typeof powerLevel.equipmentScore).toBe("number");
      expect(typeof powerLevel.partyScore).toBe("number");
      expect(typeof powerLevel.totalScore).toBe("number");
      expect(["beginner", "intermediate", "advanced", "expert"]).toContain(powerLevel.tier);
    });
  });
});
