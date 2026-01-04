import { describe, it, expect } from "vitest";
import { DynamicPropertyKeys } from "./DynamicPropertyKeys";

/**
 * Unit tests for DynamicPropertyKeys utility
 *
 * Tests centralized dynamic property key generation to ensure:
 * - Consistent key formatting across the application
 * - Collision prevention through proper prefixing
 * - Edge case handling for various input types
 */
describe("DynamicPropertyKeys", () => {
  describe("wolfKillCount", () => {
    it("should generate consistent key for wolf ID", () => {
      const wolfId = "wolf_12345";
      const key = DynamicPropertyKeys.wolfKillCount(wolfId);

      expect(key).toBe("minecraftraids:wolf_wolf_12345_kills");
    });

    it("should include prefix to prevent collisions", () => {
      const wolfId = "abc123";
      const key = DynamicPropertyKeys.wolfKillCount(wolfId);

      expect(key).toContain("minecraftraids:");
      expect(key).toContain("wolf_");
      expect(key).toContain("_kills");
    });

    it("should generate different keys for different wolf IDs", () => {
      const key1 = DynamicPropertyKeys.wolfKillCount("wolf_1");
      const key2 = DynamicPropertyKeys.wolfKillCount("wolf_2");

      expect(key1).not.toBe(key2);
    });

    it("should handle numeric wolf IDs", () => {
      const wolfId = "12345";
      const key = DynamicPropertyKeys.wolfKillCount(wolfId);

      expect(key).toBe("minecraftraids:wolf_12345_kills");
    });

    it("should handle long wolf IDs", () => {
      const longId = "a".repeat(100);
      const key = DynamicPropertyKeys.wolfKillCount(longId);

      expect(key).toContain(longId);
      expect(key).toContain("minecraftraids:wolf_");
    });

    it("should handle empty string wolf ID", () => {
      const key = DynamicPropertyKeys.wolfKillCount("");

      expect(key).toBe("minecraftraids:wolf__kills");
    });
  });

  describe("pocketedUnits", () => {
    it("should generate consistent key for player name", () => {
      const playerName = "Steve";
      const key = DynamicPropertyKeys.pocketedUnits(playerName);

      expect(key).toBe("minecraftraids:pocketed_Steve");
    });

    it("should include prefix to prevent collisions", () => {
      const playerName = "Alex";
      const key = DynamicPropertyKeys.pocketedUnits(playerName);

      expect(key).toContain("minecraftraids:");
      expect(key).toContain("pocketed_");
    });

    it("should generate different keys for different players", () => {
      const key1 = DynamicPropertyKeys.pocketedUnits("Player1");
      const key2 = DynamicPropertyKeys.pocketedUnits("Player2");

      expect(key1).not.toBe(key2);
    });

    it("should handle player names with spaces", () => {
      const playerName = "Player One";
      const key = DynamicPropertyKeys.pocketedUnits(playerName);

      expect(key).toBe("minecraftraids:pocketed_Player One");
    });

    it("should handle player names with special characters", () => {
      const playerName = "Player_123";
      const key = DynamicPropertyKeys.pocketedUnits(playerName);

      expect(key).toBe("minecraftraids:pocketed_Player_123");
    });

    it("should handle empty player name", () => {
      const key = DynamicPropertyKeys.pocketedUnits("");

      expect(key).toBe("minecraftraids:pocketed_");
    });
  });

  describe("playerEmeralds", () => {
    it("should generate consistent key for player name", () => {
      const playerName = "Steve";
      const key = DynamicPropertyKeys.playerEmeralds(playerName);

      expect(key).toBe("minecraftraids:emeralds_Steve");
    });

    it("should include prefix to prevent collisions", () => {
      const playerName = "Alex";
      const key = DynamicPropertyKeys.playerEmeralds(playerName);

      expect(key).toContain("minecraftraids:");
      expect(key).toContain("emeralds_");
    });

    it("should generate different keys for different players", () => {
      const key1 = DynamicPropertyKeys.playerEmeralds("Player1");
      const key2 = DynamicPropertyKeys.playerEmeralds("Player2");

      expect(key1).not.toBe(key2);
    });

    it("should distinguish emeralds from pocketed units", () => {
      const playerName = "Steve";
      const emeraldsKey = DynamicPropertyKeys.playerEmeralds(playerName);
      const pocketedKey = DynamicPropertyKeys.pocketedUnits(playerName);

      expect(emeraldsKey).not.toBe(pocketedKey);
    });

    it("should handle case-sensitive player names", () => {
      const key1 = DynamicPropertyKeys.playerEmeralds("steve");
      const key2 = DynamicPropertyKeys.playerEmeralds("Steve");

      expect(key1).toBe("minecraftraids:emeralds_steve");
      expect(key2).toBe("minecraftraids:emeralds_Steve");
      expect(key1).not.toBe(key2);
    });
  });

  describe("playerConquests", () => {
    it("should generate consistent key for player ID", () => {
      const playerId = "player_uuid_12345";
      const key = DynamicPropertyKeys.playerConquests(playerId);

      expect(key).toBe("minecraftraids:player_player_uuid_12345_conquests");
    });

    it("should include prefix to prevent collisions", () => {
      const playerId = "abc123";
      const key = DynamicPropertyKeys.playerConquests(playerId);

      expect(key).toContain("minecraftraids:");
      expect(key).toContain("player_");
      expect(key).toContain("_conquests");
    });

    it("should generate different keys for different player IDs", () => {
      const key1 = DynamicPropertyKeys.playerConquests("id_1");
      const key2 = DynamicPropertyKeys.playerConquests("id_2");

      expect(key1).not.toBe(key2);
    });

    it("should handle UUID-like player IDs", () => {
      const playerId = "550e8400-e29b-41d4-a716-446655440000";
      const key = DynamicPropertyKeys.playerConquests(playerId);

      expect(key).toContain(playerId);
      expect(key).toContain("minecraftraids:player_");
    });
  });

  describe("villageCache", () => {
    it("should generate consistent key", () => {
      const key = DynamicPropertyKeys.villageCache();

      expect(key).toBe("minecraftraids:discovered_villages");
    });

    it("should include prefix to prevent collisions", () => {
      const key = DynamicPropertyKeys.villageCache();

      expect(key).toContain("minecraftraids:");
    });

    it("should return same key on multiple calls", () => {
      const key1 = DynamicPropertyKeys.villageCache();
      const key2 = DynamicPropertyKeys.villageCache();

      expect(key1).toBe(key2);
    });
  });

  describe("Key collision prevention", () => {
    it("should generate unique keys across different methods", () => {
      const playerName = "Steve";
      const wolfId = "wolf_123";
      const playerId = "player_123";

      const keys = [
        DynamicPropertyKeys.wolfKillCount(wolfId),
        DynamicPropertyKeys.pocketedUnits(playerName),
        DynamicPropertyKeys.playerEmeralds(playerName),
        DynamicPropertyKeys.playerConquests(playerId),
        DynamicPropertyKeys.villageCache(),
      ];

      // All keys should be unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it("should prevent collisions with common prefixes", () => {
      const wolfKey = DynamicPropertyKeys.wolfKillCount("test");
      const pocketKey = DynamicPropertyKeys.pocketedUnits("test");
      const emeraldKey = DynamicPropertyKeys.playerEmeralds("test");
      const conquestKey = DynamicPropertyKeys.playerConquests("test");

      expect(wolfKey).not.toBe(pocketKey);
      expect(wolfKey).not.toBe(emeraldKey);
      expect(wolfKey).not.toBe(conquestKey);
      expect(pocketKey).not.toBe(emeraldKey);
      expect(pocketKey).not.toBe(conquestKey);
      expect(emeraldKey).not.toBe(conquestKey);
    });
  });

  describe("Prefix consistency", () => {
    it("should use same prefix for all keys", () => {
      const prefix = "minecraftraids:";

      expect(DynamicPropertyKeys.wolfKillCount("test")).toContain(prefix);
      expect(DynamicPropertyKeys.pocketedUnits("test")).toContain(prefix);
      expect(DynamicPropertyKeys.playerEmeralds("test")).toContain(prefix);
      expect(DynamicPropertyKeys.playerConquests("test")).toContain(prefix);
      expect(DynamicPropertyKeys.villageCache()).toContain(prefix);
    });

    it("should start all keys with the prefix", () => {
      const prefix = "minecraftraids:";

      expect(DynamicPropertyKeys.wolfKillCount("test").startsWith(prefix)).toBe(true);
      expect(DynamicPropertyKeys.pocketedUnits("test").startsWith(prefix)).toBe(true);
      expect(DynamicPropertyKeys.playerEmeralds("test").startsWith(prefix)).toBe(true);
      expect(DynamicPropertyKeys.playerConquests("test").startsWith(prefix)).toBe(true);
      expect(DynamicPropertyKeys.villageCache().startsWith(prefix)).toBe(true);
    });
  });
});
