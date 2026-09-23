import { describe, expect, it } from "vitest";
import { normalizeAdaptiveCurve } from "./point-selector";
import type { AdaptiveCurveGeometry } from "./types";

describe("AdaptiveCurve normalization", () => {
  it("preserves point metadata and removes only leading -7000000 initialization points", () => {
    const geometry: AdaptiveCurveGeometry = {
      referenceLongitude: -49,
      referenceLatitude: -22,
      lines: [{
        points: [
          { longitude: -49.1, latitude: -22.1, z: -7000000, originalIndex: 0, lineIndex: 0 },
          { longitude: -49.2, latitude: -22.2, z: -7000000, originalIndex: 1, lineIndex: 0 },
          { longitude: -49.3, latitude: -22.3, z: 12, originalIndex: 2, lineIndex: 0 },
          { longitude: -49.4, latitude: -22.4, z: 13, originalIndex: 3, lineIndex: 0 },
        ],
      }],
      metadata: { source: "fixture" },
    };

    const normalized = normalizeAdaptiveCurve(geometry);

    expect(normalized.lines[0]?.points).toHaveLength(2);
    expect(normalized.lines[0]?.points.map((point) => point.originalIndex)).toEqual([2, 3]);
    expect(normalized.lines[0]?.points[0]?.z).toBe(12);
    expect(normalized.metadata).toEqual({ source: "fixture" });
  });

  it("does not simplify ordinary points", () => {
    const geometry: AdaptiveCurveGeometry = {
      referenceLongitude: -49,
      referenceLatitude: -22,
      lines: [{
        points: [
          { longitude: -49.1, latitude: -22.1, z: 1, originalIndex: 0, lineIndex: 0 },
          { longitude: -49.10001, latitude: -22.10001, z: 1, originalIndex: 1, lineIndex: 0 },
          { longitude: -49.2, latitude: -22.2, z: 1, originalIndex: 2, lineIndex: 0 },
        ],
      }],
      metadata: {},
    };

    expect(normalizeAdaptiveCurve(geometry).lines[0]?.points).toHaveLength(3);
  });
});
