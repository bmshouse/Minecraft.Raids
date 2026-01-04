import { describe, it, expect, beforeEach } from "vitest";
import { MessageProvider } from "./MessageProvider";
import type { IMessageProvider } from "./IMessageProvider";

describe("MessageProvider", () => {
  let provider: IMessageProvider;

  beforeEach(() => {
    provider = new MessageProvider();
  });

  describe("getMessage", () => {
    it("should return RawMessage with translate property for valid keys", () => {
      const message = provider.getMessage("mc.raids.welcome");
      expect(message).toEqual({ translate: "mc.raids.welcome" });
    });

    it("should return RawMessage with translate for all standard message keys", () => {
      expect(provider.getMessage("mc.raids.welcome")).toEqual({
        translate: "mc.raids.welcome",
      });
      expect(provider.getMessage("mc.raids.initialized")).toEqual({
        translate: "mc.raids.initialized",
      });
      expect(provider.getMessage("mc.raids.version")).toEqual({
        translate: "mc.raids.version",
      });
      expect(provider.getMessage("mc.raids.description")).toEqual({
        translate: "mc.raids.description",
      });
    });

    it("should return RawMessage with translate for missing keys without fallback", () => {
      const message = provider.getMessage("non.existent.key");
      expect(message).toEqual({ translate: "non.existent.key" });
    });

    it("should use fallback parameter when provided", () => {
      const message = provider.getMessage("non.existent.key", "Default message");
      // Fallback parameter is used for dynamic content
      expect(message).toEqual({ text: "Default message" });
    });

    it("should use fallback over translate when fallback is provided", () => {
      const message = provider.getMessage("mc.raids.welcome", "Fallback");
      // When fallback is provided, it takes precedence (for dynamic content like counts)
      expect(message).toEqual({ text: "Fallback" });
    });
  });

  describe("setMessage", () => {
    it("should add a runtime override and return it as RawMessage with text property", () => {
      provider.setMessage("custom.key", "Custom message");
      const message = provider.getMessage("custom.key");
      expect(message).toEqual({ text: "Custom message" });
    });

    it("should override a standard key with runtime value", () => {
      // Before override: should use .lang file translation
      const originalMessage = provider.getMessage("mc.raids.welcome");
      expect(originalMessage).toEqual({ translate: "mc.raids.welcome" });

      // After override: should use the override text
      provider.setMessage("mc.raids.welcome", "Updated welcome");
      const updatedMessage = provider.getMessage("mc.raids.welcome");
      expect(updatedMessage).toEqual({ text: "Updated welcome" });
    });

    it("should support adding multiple runtime overrides", () => {
      provider.setMessage("key1", "Message 1");
      provider.setMessage("key2", "Message 2");
      provider.setMessage("key3", "Message 3");

      expect(provider.getMessage("key1")).toEqual({ text: "Message 1" });
      expect(provider.getMessage("key2")).toEqual({ text: "Message 2" });
      expect(provider.getMessage("key3")).toEqual({ text: "Message 3" });
    });

    it("should distinguish between translate (no override) and text (override)", () => {
      // No override - uses translate
      const noOverride = provider.getMessage("mc.raids.initialized");
      expect(noOverride).toEqual({ translate: "mc.raids.initialized" });

      // With override - uses text
      provider.setMessage("mc.raids.initialized", "Custom initialized");
      const withOverride = provider.getMessage("mc.raids.initialized");
      expect(withOverride).toEqual({ text: "Custom initialized" });
    });
  });
});
