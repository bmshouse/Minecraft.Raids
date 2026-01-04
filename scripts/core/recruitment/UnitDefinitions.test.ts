import { describe, it, expect } from "vitest";
import { UnitDefinitions, UnitDefinition } from "./UnitDefinitions";
import { UnitConstants } from "./UnitConstants";

/**
 * Unit tests for UnitDefinitions
 *
 * Tests unit data structure validation and helper methods:
 * - All unit definitions are properly structured
 * - Cost calculations and sell prices
 * - Wolf specialization identification by health
 * - Unit lookup methods
 */

describe("UnitDefinitions", () => {
  describe("unit definition structure", () => {
    it("should have all required properties for each unit", () => {
      const allUnits = UnitDefinitions.getAllUnits();

      expect(allUnits.length).toBeGreaterThan(0);

      allUnits.forEach((unit) => {
        expect(unit).toHaveProperty("id");
        expect(unit).toHaveProperty("displayName");
        expect(unit).toHaveProperty("entityId");
        expect(unit).toHaveProperty("cost");
        expect(unit).toHaveProperty("description");

        expect(typeof unit.id).toBe("string");
        expect(typeof unit.displayName).toBe("string");
        expect(typeof unit.entityId).toBe("string");
        expect(typeof unit.cost).toBe("number");
        expect(typeof unit.description).toBe("string");

        expect(unit.id.length).toBeGreaterThan(0);
        expect(unit.displayName.length).toBeGreaterThan(0);
        expect(unit.entityId.length).toBeGreaterThan(0);
        expect(unit.cost).toBeGreaterThan(0);
        expect(unit.description.length).toBeGreaterThan(0);
      });
    });

    it("should have unique IDs for each unit", () => {
      const allUnits = UnitDefinitions.getAllUnits();
      const ids = allUnits.map((u) => u.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have valid entity IDs", () => {
      const allUnits = UnitDefinitions.getAllUnits();

      allUnits.forEach((unit) => {
        expect(unit.entityId).toMatch(/^(minecraft:|minecraftraids:)/);
      });
    });

    it("should have wolf specializations with proper events", () => {
      expect(UnitDefinitions.WOLF_GUARD.specializationEvent).toBe("minecraftraids:become_guard");
      expect(UnitDefinitions.WOLF_TANK.specializationEvent).toBe("minecraftraids:become_tank");
      expect(UnitDefinitions.WOLF_DPS.specializationEvent).toBe("minecraftraids:become_dps");
    });

    it("should have non-wolf units without specialization events", () => {
      expect(UnitDefinitions.PILLAGER.specializationEvent).toBeUndefined();
      expect(UnitDefinitions.VINDICATOR.specializationEvent).toBeUndefined();
      expect(UnitDefinitions.IRON_GOLEM.specializationEvent).toBeUndefined();
    });
  });

  describe("getAllUnits", () => {
    it("should return exactly 6 units", () => {
      const allUnits = UnitDefinitions.getAllUnits();
      expect(allUnits).toHaveLength(6);
    });

    it("should return array containing all unit types", () => {
      const allUnits = UnitDefinitions.getAllUnits();

      expect(allUnits).toContain(UnitDefinitions.WOLF_GUARD);
      expect(allUnits).toContain(UnitDefinitions.WOLF_TANK);
      expect(allUnits).toContain(UnitDefinitions.WOLF_DPS);
      expect(allUnits).toContain(UnitDefinitions.PILLAGER);
      expect(allUnits).toContain(UnitDefinitions.VINDICATOR);
      expect(allUnits).toContain(UnitDefinitions.IRON_GOLEM);
    });

    it("should return a new array instance each time", () => {
      const array1 = UnitDefinitions.getAllUnits();
      const array2 = UnitDefinitions.getAllUnits();

      expect(array1).not.toBe(array2); // Different array instances
      expect(array1).toEqual(array2); // Same content
    });
  });

  describe("getUnitById", () => {
    it("should find wolf guard by ID", () => {
      const unit = UnitDefinitions.getUnitById("wolf_guard");
      expect(unit).toBe(UnitDefinitions.WOLF_GUARD);
    });

    it("should find all units by their IDs", () => {
      expect(UnitDefinitions.getUnitById("wolf_guard")).toBe(UnitDefinitions.WOLF_GUARD);
      expect(UnitDefinitions.getUnitById("wolf_tank")).toBe(UnitDefinitions.WOLF_TANK);
      expect(UnitDefinitions.getUnitById("wolf_dps")).toBe(UnitDefinitions.WOLF_DPS);
      expect(UnitDefinitions.getUnitById("pillager")).toBe(UnitDefinitions.PILLAGER);
      expect(UnitDefinitions.getUnitById("vindicator")).toBe(UnitDefinitions.VINDICATOR);
      expect(UnitDefinitions.getUnitById("iron_golem")).toBe(UnitDefinitions.IRON_GOLEM);
    });

    it("should return undefined for non-existent ID", () => {
      const unit = UnitDefinitions.getUnitById("nonexistent_unit");
      expect(unit).toBeUndefined();
    });

    it("should be case-sensitive", () => {
      const unit = UnitDefinitions.getUnitById("WOLF_GUARD");
      expect(unit).toBeUndefined();
    });
  });

  describe("getByEntityId", () => {
    it("should find wolf by entity ID", () => {
      const unit = UnitDefinitions.getByEntityId("minecraft:wolf");
      expect(unit).toBeDefined();
      expect(unit?.entityId).toBe("minecraft:wolf");
    });

    it("should find pillager by entity ID", () => {
      const unit = UnitDefinitions.getByEntityId("minecraftraids:village_guard_pillager");
      expect(unit).toBe(UnitDefinitions.PILLAGER);
    });

    it("should find vindicator by entity ID", () => {
      const unit = UnitDefinitions.getByEntityId("minecraftraids:village_guard_vindicator");
      expect(unit).toBe(UnitDefinitions.VINDICATOR);
    });

    it("should find iron golem by entity ID", () => {
      const unit = UnitDefinitions.getByEntityId("minecraftraids:village_defense_iron_golem");
      expect(unit).toBe(UnitDefinitions.IRON_GOLEM);
    });

    it("should return undefined for non-existent entity ID", () => {
      const unit = UnitDefinitions.getByEntityId("minecraft:zombie");
      expect(unit).toBeUndefined();
    });

    it("should return first wolf when multiple wolves match", () => {
      // Since all wolves have the same entityId, it returns the first one
      const unit = UnitDefinitions.getByEntityId("minecraft:wolf");
      expect(unit).toBe(UnitDefinitions.WOLF_GUARD);
    });
  });

  describe("getByEntityIdAndHealth", () => {
    it("should identify guard wolf by 20 HP", () => {
      const unit = UnitDefinitions.getByEntityIdAndHealth("minecraft:wolf", 20);
      expect(unit).toBe(UnitDefinitions.WOLF_GUARD);
    });

    it("should identify tank wolf by 30 HP", () => {
      const unit = UnitDefinitions.getByEntityIdAndHealth("minecraft:wolf", 30);
      expect(unit).toBe(UnitDefinitions.WOLF_TANK);
    });

    it("should identify DPS wolf by 15 HP", () => {
      const unit = UnitDefinitions.getByEntityIdAndHealth("minecraft:wolf", 15);
      expect(unit).toBe(UnitDefinitions.WOLF_DPS);
    });

    it("should default to guard wolf for unknown wolf HP", () => {
      const unit1 = UnitDefinitions.getByEntityIdAndHealth("minecraft:wolf", 25);
      expect(unit1).toBe(UnitDefinitions.WOLF_GUARD);

      const unit2 = UnitDefinitions.getByEntityIdAndHealth("minecraft:wolf", 100);
      expect(unit2).toBe(UnitDefinitions.WOLF_GUARD);

      const unit3 = UnitDefinitions.getByEntityIdAndHealth("minecraft:wolf", 5);
      expect(unit3).toBe(UnitDefinitions.WOLF_GUARD);
    });

    it("should ignore health for non-wolf entities", () => {
      const pillager = UnitDefinitions.getByEntityIdAndHealth(
        "minecraftraids:village_guard_pillager",
        100
      );
      expect(pillager).toBe(UnitDefinitions.PILLAGER);

      const golem = UnitDefinitions.getByEntityIdAndHealth(
        "minecraftraids:village_defense_iron_golem",
        50
      );
      expect(golem).toBe(UnitDefinitions.IRON_GOLEM);
    });

    it("should return undefined for non-existent entity with any health", () => {
      const unit = UnitDefinitions.getByEntityIdAndHealth("minecraft:zombie", 20);
      expect(unit).toBeUndefined();
    });
  });

  describe("getSellPrice", () => {
    it("should calculate 50% sell price for all units", () => {
      const allUnits = UnitDefinitions.getAllUnits();

      allUnits.forEach((unit) => {
        const sellPrice = UnitDefinitions.getSellPrice(unit);
        const expectedPrice = Math.floor(unit.cost * UnitConstants.SELL_PRICE_MULTIPLIER);

        expect(sellPrice).toBe(expectedPrice);
        expect(sellPrice).toBeLessThanOrEqual(unit.cost / 2);
      });
    });

    it("should calculate correct sell prices for specific units", () => {
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.WOLF_GUARD)).toBe(2); // 5 * 0.5 = 2.5 → 2
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.WOLF_TANK)).toBe(4); // 8 * 0.5 = 4
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.WOLF_DPS)).toBe(4); // 8 * 0.5 = 4
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.PILLAGER)).toBe(5); // 10 * 0.5 = 5
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.VINDICATOR)).toBe(6); // 12 * 0.5 = 6
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.IRON_GOLEM)).toBe(10); // 20 * 0.5 = 10
    });

    it("should floor odd cost values", () => {
      // Wolf guard costs 5, so 5 * 0.5 = 2.5, which should floor to 2
      expect(UnitDefinitions.getSellPrice(UnitDefinitions.WOLF_GUARD)).toBe(2);
    });

    it("should never exceed 50% of original cost", () => {
      const allUnits = UnitDefinitions.getAllUnits();

      allUnits.forEach((unit) => {
        const sellPrice = UnitDefinitions.getSellPrice(unit);
        expect(sellPrice).toBeLessThanOrEqual(unit.cost * 0.5);
      });
    });
  });

  describe("unit cost balance", () => {
    it("should have wolves as cheapest units", () => {
      const wolfGuardCost = UnitDefinitions.WOLF_GUARD.cost;
      const allUnits = UnitDefinitions.getAllUnits();

      // Wolf guard should be the cheapest (or tied for cheapest)
      allUnits.forEach((unit) => {
        expect(unit.cost).toBeGreaterThanOrEqual(wolfGuardCost);
      });
    });

    it("should have iron golem as most expensive unit", () => {
      const ironGolemCost = UnitDefinitions.IRON_GOLEM.cost;
      const allUnits = UnitDefinitions.getAllUnits();

      // Iron golem should be the most expensive
      allUnits.forEach((unit) => {
        expect(unit.cost).toBeLessThanOrEqual(ironGolemCost);
      });
    });

    it("should have reasonable cost progression", () => {
      expect(UnitDefinitions.WOLF_GUARD.cost).toBe(5); // Starter unit
      expect(UnitDefinitions.WOLF_TANK.cost).toBe(8); // Specialized wolves cost more
      expect(UnitDefinitions.WOLF_DPS.cost).toBe(8);
      expect(UnitDefinitions.PILLAGER.cost).toBe(10); // Mid-tier
      expect(UnitDefinitions.VINDICATOR.cost).toBe(12);
      expect(UnitDefinitions.IRON_GOLEM.cost).toBe(20); // Premium unit
    });
  });

  describe("unit descriptions", () => {
    it("should have meaningful descriptions mentioning stats", () => {
      const allUnits = UnitDefinitions.getAllUnits();

      allUnits.forEach((unit) => {
        // Each description should mention HP or damage
        const hasStats =
          unit.description.includes("HP") ||
          unit.description.includes("damage") ||
          unit.description.includes("health");

        expect(hasStats).toBe(true);
      });
    });

    it("should have unique descriptions", () => {
      const allUnits = UnitDefinitions.getAllUnits();
      const descriptions = allUnits.map((u) => u.description);
      const uniqueDescriptions = new Set(descriptions);

      expect(uniqueDescriptions.size).toBe(descriptions.length);
    });
  });
});
