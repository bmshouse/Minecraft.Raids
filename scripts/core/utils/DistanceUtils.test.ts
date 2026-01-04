import { describe, it, expect } from "vitest";
import { DistanceUtils } from "./DistanceUtils";
import type { Vector3 } from "@minecraft/server";

/**
 * Unit tests for DistanceUtils
 *
 * Tests distance calculation utilities for Minecraft world space:
 * - Horizontal (2D) distance calculations (x, z only)
 * - Full 3D Euclidean distance calculations
 * - Edge cases with various coordinate values
 */
describe("DistanceUtils", () => {
  describe("calculateHorizontalDistance", () => {
    it("should calculate correct distance for simple coordinates", () => {
      const a: Vector3 = { x: 0, y: 64, z: 0 };
      const b: Vector3 = { x: 3, y: 64, z: 4 };

      const distance = DistanceUtils.calculateHorizontalDistance(a, b);

      // 3-4-5 triangle
      expect(distance).toBe(5);
    });

    it("should ignore Y coordinate in horizontal distance", () => {
      const a: Vector3 = { x: 0, y: 0, z: 0 };
      const b: Vector3 = { x: 3, y: 1000, z: 4 }; // Very different Y

      const distance = DistanceUtils.calculateHorizontalDistance(a, b);

      // Should still be 5 (3-4-5 triangle)
      expect(distance).toBe(5);
    });

    it("should return zero for same horizontal position", () => {
      const a: Vector3 = { x: 100, y: 64, z: 200 };
      const b: Vector3 = { x: 100, y: 70, z: 200 }; // Different Y but same X, Z

      const distance = DistanceUtils.calculateHorizontalDistance(a, b);

      expect(distance).toBe(0);
    });

    it("should handle negative coordinates", () => {
      const a: Vector3 = { x: -100, y: 64, z: -100 };
      const b: Vector3 = { x: 0, y: 64, z: 0 };

      const distance = DistanceUtils.calculateHorizontalDistance(a, b);

      // sqrt(100^2 + 100^2) ≈ 141.42
      expect(Math.round(distance)).toBe(141);
      expect(distance).toBeCloseTo(141.42, 1);
    });

    it("should handle large coordinate values", () => {
      const a: Vector3 = { x: 0, y: 64, z: 0 };
      const b: Vector3 = { x: 10000, y: 64, z: 0 };

      const distance = DistanceUtils.calculateHorizontalDistance(a, b);

      expect(distance).toBe(10000);
    });

    it("should calculate distance correctly when moving only on X axis", () => {
      const a: Vector3 = { x: 0, y: 64, z: 0 };
      const b: Vector3 = { x: 100, y: 64, z: 0 };

      const distance = DistanceUtils.calculateHorizontalDistance(a, b);

      expect(distance).toBe(100);
    });

    it("should calculate distance correctly when moving only on Z axis", () => {
      const a: Vector3 = { x: 0, y: 64, z: 0 };
      const b: Vector3 = { x: 0, y: 64, z: 100 };

      const distance = DistanceUtils.calculateHorizontalDistance(a, b);

      expect(distance).toBe(100);
    });

    it("should be commutative (distance A->B equals B->A)", () => {
      const a: Vector3 = { x: 10, y: 64, z: 20 };
      const b: Vector3 = { x: 50, y: 64, z: 80 };

      const distance1 = DistanceUtils.calculateHorizontalDistance(a, b);
      const distance2 = DistanceUtils.calculateHorizontalDistance(b, a);

      expect(distance1).toBe(distance2);
    });

    it("should handle fractional coordinates", () => {
      const a: Vector3 = { x: 0.5, y: 64, z: 0.5 };
      const b: Vector3 = { x: 3.5, y: 64, z: 4.5 };

      const distance = DistanceUtils.calculateHorizontalDistance(a, b);

      // 3-4-5 triangle
      expect(distance).toBe(5);
    });

    it("should handle very small distances", () => {
      const a: Vector3 = { x: 0, y: 64, z: 0 };
      const b: Vector3 = { x: 0.01, y: 64, z: 0.01 };

      const distance = DistanceUtils.calculateHorizontalDistance(a, b);

      expect(distance).toBeCloseTo(0.014, 2);
    });
  });

  describe("calculate3DDistance", () => {
    it("should calculate correct 3D distance", () => {
      const a: Vector3 = { x: 0, y: 0, z: 0 };
      const b: Vector3 = { x: 1, y: 1, z: 1 };

      const distance = DistanceUtils.calculate3DDistance(a, b);

      // sqrt(1^2 + 1^2 + 1^2) ≈ 1.732
      expect(distance).toBeCloseTo(1.732, 2);
    });

    it("should include Y coordinate in 3D distance", () => {
      const a: Vector3 = { x: 0, y: 0, z: 0 };
      const b: Vector3 = { x: 3, y: 4, z: 0 };

      const distance = DistanceUtils.calculate3DDistance(a, b);

      // sqrt(3^2 + 4^2 + 0^2) = 5
      expect(distance).toBe(5);
    });

    it("should return zero for identical positions", () => {
      const a: Vector3 = { x: 100, y: 64, z: 200 };
      const b: Vector3 = { x: 100, y: 64, z: 200 };

      const distance = DistanceUtils.calculate3DDistance(a, b);

      expect(distance).toBe(0);
    });

    it("should handle negative coordinates in 3D", () => {
      const a: Vector3 = { x: -10, y: -10, z: -10 };
      const b: Vector3 = { x: 0, y: 0, z: 0 };

      const distance = DistanceUtils.calculate3DDistance(a, b);

      // sqrt(10^2 + 10^2 + 10^2) ≈ 17.32
      expect(distance).toBeCloseTo(17.32, 1);
    });

    it("should calculate distance when moving only on Y axis", () => {
      const a: Vector3 = { x: 0, y: 0, z: 0 };
      const b: Vector3 = { x: 0, y: 100, z: 0 };

      const distance = DistanceUtils.calculate3DDistance(a, b);

      expect(distance).toBe(100);
    });

    it("should be commutative (distance A->B equals B->A)", () => {
      const a: Vector3 = { x: 10, y: 20, z: 30 };
      const b: Vector3 = { x: 50, y: 60, z: 70 };

      const distance1 = DistanceUtils.calculate3DDistance(a, b);
      const distance2 = DistanceUtils.calculate3DDistance(b, a);

      expect(distance1).toBe(distance2);
    });

    it("should handle large 3D coordinate values", () => {
      const a: Vector3 = { x: 0, y: 0, z: 0 };
      const b: Vector3 = { x: 6000, y: 8000, z: 0 };

      const distance = DistanceUtils.calculate3DDistance(a, b);

      // 6000-8000-10000 triangle
      expect(distance).toBe(10000);
    });
  });

  describe("Horizontal vs 3D distance comparison", () => {
    it("should have 3D distance >= horizontal distance", () => {
      const a: Vector3 = { x: 0, y: 0, z: 0 };
      const b: Vector3 = { x: 3, y: 4, z: 4 };

      const horizontal = DistanceUtils.calculateHorizontalDistance(a, b);
      const threeD = DistanceUtils.calculate3DDistance(a, b);

      expect(threeD).toBeGreaterThanOrEqual(horizontal);
    });

    it("should have equal distances when Y is same", () => {
      const a: Vector3 = { x: 0, y: 64, z: 0 };
      const b: Vector3 = { x: 3, y: 64, z: 4 };

      const horizontal = DistanceUtils.calculateHorizontalDistance(a, b);
      const threeD = DistanceUtils.calculate3DDistance(a, b);

      expect(threeD).toBe(horizontal);
    });

    it("should have different distances when Y differs", () => {
      const a: Vector3 = { x: 0, y: 0, z: 0 };
      const b: Vector3 = { x: 3, y: 100, z: 4 };

      const horizontal = DistanceUtils.calculateHorizontalDistance(a, b);
      const threeD = DistanceUtils.calculate3DDistance(a, b);

      expect(horizontal).toBe(5);
      expect(threeD).toBeGreaterThan(100);
      expect(threeD).not.toBe(horizontal);
    });
  });
});
