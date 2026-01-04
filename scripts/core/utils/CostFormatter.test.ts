import { describe, it, expect } from "vitest";
import { CostFormatter } from "./CostFormatter";

/**
 * Unit tests for CostFormatter utility
 *
 * Tests cost formatting in different display formats:
 * - Abbreviated format for UI displays (e.g., "10E")
 * - Verbose format for messages and feedback (e.g., "10 emeralds")
 * - Edge cases with various numeric values
 */
describe("CostFormatter", () => {
  describe("formatAbbreviated", () => {
    it("should format typical cost in abbreviated form", () => {
      const result = CostFormatter.formatAbbreviated(10);

      expect(result).toBe("10E");
    });

    it("should format single emerald cost", () => {
      const result = CostFormatter.formatAbbreviated(1);

      expect(result).toBe("1E");
    });

    it("should format zero cost", () => {
      const result = CostFormatter.formatAbbreviated(0);

      expect(result).toBe("0E");
    });

    it("should format large cost values", () => {
      const result = CostFormatter.formatAbbreviated(9999);

      expect(result).toBe("9999E");
    });

    it("should format very large cost values", () => {
      const result = CostFormatter.formatAbbreviated(1000000);

      expect(result).toBe("1000000E");
    });

    it("should handle negative cost values", () => {
      // Negative costs might represent refunds or credits
      const result = CostFormatter.formatAbbreviated(-50);

      expect(result).toBe("-50E");
    });

    it("should format common recruitment costs", () => {
      // Based on typical game costs
      expect(CostFormatter.formatAbbreviated(100)).toBe("100E"); // Wolf
      expect(CostFormatter.formatAbbreviated(300)).toBe("300E"); // Iron Golem
      expect(CostFormatter.formatAbbreviated(500)).toBe("500E"); // Ravager
    });

    it("should include E suffix for all values", () => {
      const results = [
        CostFormatter.formatAbbreviated(0),
        CostFormatter.formatAbbreviated(1),
        CostFormatter.formatAbbreviated(100),
        CostFormatter.formatAbbreviated(9999),
      ];

      results.forEach((result) => {
        expect(result).toContain("E");
        expect(result.endsWith("E")).toBe(true);
      });
    });
  });

  describe("formatVerbose", () => {
    it("should format typical cost in verbose form", () => {
      const result = CostFormatter.formatVerbose(10);

      expect(result).toBe("10 emeralds");
    });

    it("should format single emerald cost", () => {
      const result = CostFormatter.formatVerbose(1);

      // Note: Current implementation doesn't handle singular/plural
      expect(result).toBe("1 emeralds");
    });

    it("should format zero cost", () => {
      const result = CostFormatter.formatVerbose(0);

      expect(result).toBe("0 emeralds");
    });

    it("should format large cost values", () => {
      const result = CostFormatter.formatVerbose(9999);

      expect(result).toBe("9999 emeralds");
    });

    it("should format very large cost values", () => {
      const result = CostFormatter.formatVerbose(1000000);

      expect(result).toBe("1000000 emeralds");
    });

    it("should handle negative cost values", () => {
      const result = CostFormatter.formatVerbose(-50);

      expect(result).toBe("-50 emeralds");
    });

    it("should format common recruitment costs verbosely", () => {
      expect(CostFormatter.formatVerbose(100)).toBe("100 emeralds");
      expect(CostFormatter.formatVerbose(300)).toBe("300 emeralds");
      expect(CostFormatter.formatVerbose(500)).toBe("500 emeralds");
    });

    it("should include emeralds text for all values", () => {
      const results = [
        CostFormatter.formatVerbose(0),
        CostFormatter.formatVerbose(1),
        CostFormatter.formatVerbose(100),
        CostFormatter.formatVerbose(9999),
      ];

      results.forEach((result) => {
        expect(result).toContain("emeralds");
        expect(result.endsWith("emeralds")).toBe(true);
      });
    });

    it("should include space between number and text", () => {
      const result = CostFormatter.formatVerbose(42);

      expect(result).toContain(" ");
      expect(result.split(" ")).toHaveLength(2);
    });
  });

  describe("Format comparison", () => {
    it("should produce different outputs for same cost", () => {
      const cost = 100;
      const abbreviated = CostFormatter.formatAbbreviated(cost);
      const verbose = CostFormatter.formatVerbose(cost);

      expect(abbreviated).not.toBe(verbose);
      expect(abbreviated).toBe("100E");
      expect(verbose).toBe("100 emeralds");
    });

    it("should both contain the cost number", () => {
      const cost = 250;
      const abbreviated = CostFormatter.formatAbbreviated(cost);
      const verbose = CostFormatter.formatVerbose(cost);

      expect(abbreviated).toContain("250");
      expect(verbose).toContain("250");
    });

    it("should have abbreviated format shorter than verbose", () => {
      const cost = 100;
      const abbreviated = CostFormatter.formatAbbreviated(cost);
      const verbose = CostFormatter.formatVerbose(cost);

      expect(abbreviated.length).toBeLessThan(verbose.length);
    });
  });
});
