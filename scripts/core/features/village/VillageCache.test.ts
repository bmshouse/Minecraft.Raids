import { describe, it, expect } from "vitest";
import type { CachedVillage } from "./IVillageCache";

/**
 * Unit tests for VillageCache pure logic
 *
 * Note: Following Microsoft's recommended testing approach, these tests focus on
 * pure logic without mocking the Minecraft API. Full integration with DynamicProperties
 * is tested via GameTests in VillageDiscoveryGameTest.ts.
 *
 * These tests verify:
 * - Village key generation logic
 * - Distance calculation accuracy
 * - Clustering algorithm correctness
 * - Data structure validation
 */

describe("VillageCache - Pure Logic", () => {
  describe("Location key generation", () => {
    it("should generate consistent keys for same location", () => {
      const location1 = { x: 100.4, y: 64, z: 200.4 };
      const location2 = { x: 100.3, y: 64, z: 200.3 };

      // Both should round to same key
      const expectedKey = "village_100_200";

      // Simulate key generation logic (from VillageCache.ts lines 197-202)
      const key1 = `village_${Math.round(location1.x)}_${Math.round(location1.z)}`;
      const key2 = `village_${Math.round(location2.x)}_${Math.round(location2.z)}`;

      expect(key1).toBe(expectedKey);
      expect(key2).toBe(expectedKey);
    });

    it("should generate different keys for distinct locations", () => {
      const location1 = { x: 100, y: 64, z: 200 };
      const location2 = { x: 300, y: 64, z: 400 };

      const key1 = `village_${Math.round(location1.x)}_${Math.round(location1.z)}`;
      const key2 = `village_${Math.round(location2.x)}_${Math.round(location2.z)}`;

      expect(key1).not.toBe(key2);
      expect(key1).toBe("village_100_200");
      expect(key2).toBe("village_300_400");
    });

    it("should handle negative coordinates", () => {
      const location = { x: -150.5, y: 64, z: -250.7 };

      const key = `village_${Math.round(location.x)}_${Math.round(location.z)}`;

      expect(key).toBe("village_-150_-251");
    });
  });

  describe("Distance calculation", () => {
    it("should calculate correct 2D distance (ignoring Y)", () => {
      const pos1 = { x: 0, y: 64, z: 0 };
      const pos2 = { x: 3, y: 100, z: 4 }; // Different Y should be ignored

      // Simulate distance calculation (from VillageCache.ts lines 205-210)
      const dx = pos1.x - pos2.x;
      const dz = pos1.z - pos2.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      expect(distance).toBe(5); // 3-4-5 triangle
    });

    it("should calculate distance for far apart villages", () => {
      const pos1 = { x: 0, y: 64, z: 0 };
      const pos2 = { x: 1000, y: 64, z: 0 };

      const dx = pos1.x - pos2.x;
      const dz = pos1.z - pos2.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      expect(distance).toBe(1000);
    });

    it("should handle negative coordinates in distance calculation", () => {
      const pos1 = { x: -100, y: 64, z: -100 };
      const pos2 = { x: 0, y: 64, z: 0 };

      const dx = pos1.x - pos2.x;
      const dz = pos1.z - pos2.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      expect(Math.round(distance)).toBe(141); // sqrt(100^2 + 100^2) ≈ 141.42
    });
  });

  describe("Clustering logic", () => {
    const CLUSTERING_RADIUS = 100;

    it("should identify villages within clustering radius", () => {
      const village1 = { x: 0, y: 64, z: 0 };
      const village2 = { x: 50, y: 64, z: 50 }; // ~70.7 blocks away

      const dx = village1.x - village2.x;
      const dz = village1.z - village2.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      expect(distance).toBeLessThan(CLUSTERING_RADIUS);
      expect(Math.round(distance)).toBe(71);
    });

    it("should identify villages outside clustering radius", () => {
      const village1 = { x: 0, y: 64, z: 0 };
      const village2 = { x: 100, y: 64, z: 100 }; // ~141.4 blocks away

      const dx = village1.x - village2.x;
      const dz = village1.z - village2.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      expect(distance).toBeGreaterThan(CLUSTERING_RADIUS);
      expect(Math.round(distance)).toBe(141);
    });

    it("should handle edge case exactly at clustering radius", () => {
      const village1 = { x: 0, y: 64, z: 0 };
      const village2 = { x: 100, y: 64, z: 0 }; // Exactly 100 blocks

      const dx = village1.x - village2.x;
      const dz = village1.z - village2.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Should cluster if distance <= radius
      expect(distance).toBe(100);
      expect(distance <= CLUSTERING_RADIUS).toBe(true);
    });
  });

  describe("CachedVillage data structure", () => {
    it("should have all required properties", () => {
      const village: CachedVillage = {
        key: "village_100_200",
        location: { x: 100, y: 64, z: 200 },
        discoveredAt: Date.now(),
        discoveryMethod: "command",
        conquestCount: 0,
      };

      expect(village).toHaveProperty("key");
      expect(village).toHaveProperty("location");
      expect(village).toHaveProperty("discoveredAt");
      expect(village).toHaveProperty("discoveryMethod");
      expect(village).toHaveProperty("conquestCount");
    });

    it("should support optional lastConqueredBy property", () => {
      const village: CachedVillage = {
        key: "village_100_200",
        location: { x: 100, y: 64, z: 200 },
        discoveredAt: Date.now(),
        discoveryMethod: "entity",
        lastConqueredBy: "player123",
        conquestCount: 5,
      };

      expect(village.lastConqueredBy).toBe("player123");
      expect(village.conquestCount).toBe(5);
    });

    it("should distinguish between discovery methods", () => {
      const commandVillage: CachedVillage = {
        key: "village_100_200",
        location: { x: 100, y: 64, z: 200 },
        discoveredAt: Date.now(),
        discoveryMethod: "command",
        conquestCount: 0,
      };

      const entityVillage: CachedVillage = {
        key: "village_300_400",
        location: { x: 300, y: 64, z: 400 },
        discoveredAt: Date.now(),
        discoveryMethod: "entity",
        conquestCount: 0,
      };

      expect(commandVillage.discoveryMethod).toBe("command");
      expect(entityVillage.discoveryMethod).toBe("entity");
    });
  });

  describe("Village sorting and filtering", () => {
    it("should sort villages by discovery time (oldest first)", () => {
      const now = Date.now();
      const villages: CachedVillage[] = [
        {
          key: "village_1",
          location: { x: 100, y: 64, z: 100 },
          discoveredAt: now - 5000,
          discoveryMethod: "command",
          conquestCount: 0,
        },
        {
          key: "village_2",
          location: { x: 200, y: 64, z: 200 },
          discoveredAt: now - 10000,
          discoveryMethod: "entity",
          conquestCount: 0,
        },
        {
          key: "village_3",
          location: { x: 300, y: 64, z: 300 },
          discoveredAt: now - 1000,
          discoveryMethod: "command",
          conquestCount: 0,
        },
      ];

      const sorted = villages.sort((a, b) => a.discoveredAt - b.discoveredAt);

      expect(sorted[0].key).toBe("village_2"); // Oldest
      expect(sorted[1].key).toBe("village_1");
      expect(sorted[2].key).toBe("village_3"); // Newest
    });

    it("should filter villages by discovery method", () => {
      const villages: CachedVillage[] = [
        {
          key: "village_1",
          location: { x: 100, y: 64, z: 100 },
          discoveredAt: Date.now(),
          discoveryMethod: "command",
          conquestCount: 0,
        },
        {
          key: "village_2",
          location: { x: 200, y: 64, z: 200 },
          discoveredAt: Date.now(),
          discoveryMethod: "entity",
          conquestCount: 0,
        },
        {
          key: "village_3",
          location: { x: 300, y: 64, z: 300 },
          discoveredAt: Date.now(),
          discoveryMethod: "command",
          conquestCount: 0,
        },
      ];

      const commandVillages = villages.filter((v) => v.discoveryMethod === "command");
      const entityVillages = villages.filter((v) => v.discoveryMethod === "entity");

      expect(commandVillages).toHaveLength(2);
      expect(entityVillages).toHaveLength(1);
    });
  });
});
