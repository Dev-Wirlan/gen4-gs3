import { describe, expect, it } from "vitest";
import { normalizeAdaptiveCurve } from "./point-selector";
import type { AdaptiveCurveGeometry } from "./types";

const makeInitialCurve = (
  point2: { longitude: number; latitude: number },
  point3 = { longitude: -49.4, latitude: -22.4 },
): AdaptiveCurveGeometry => ({
  referenceLongitude: -49.1,
  referenceLatitude: -22.1,
  curveReference: { longitude: -49.1, latitude: -22.1, z: -7000000, originalIndex: 0, lineIndex: 0 },
  firstGeometryPoint: { longitude: -49.2, latitude: -22.2, z: -7000000, originalIndex: 1, lineIndex: 0 },
  lines: [{
    points: [
      { longitude: -49.1, latitude: -22.1, z: -7000000, originalIndex: 0, lineIndex: 0 },
      { longitude: -49.2, latitude: -22.2, z: -7000000, originalIndex: 1, lineIndex: 0 },
      { ...point2, z: 12, originalIndex: 2, lineIndex: 0 },
      { ...point3, z: 13, originalIndex: 3, lineIndex: 0 },
    ],
  }],
  metadata: { source: "fixture" },
});

describe("AdaptiveCurve normalization", () => {
  it("drops only the confirmed initial duplicate after the two -7000000 points", () => {
    const normalized = normalizeAdaptiveCurve(makeInitialCurve({
      longitude: -49.2,
      latitude: -22.2,
    }));

    expect(normalized.curveReference?.originalIndex).toBe(0);
    expect(normalized.firstGeometryPoint?.originalIndex).toBe(1);
    expect(normalized.lines[0]?.points.map((point) => point.originalIndex)).toEqual([1, 3]);
    expect(normalized.lines[0]?.points[0]?.z).toBe(-7000000);
    expect(normalized.metadata).toEqual({ source: "fixture" });
  });

  it("preserves point2 when it does not have the same XY as firstGeometryPoint", () => {
    const normalized = normalizeAdaptiveCurve(makeInitialCurve({
      longitude: -49.3,
      latitude: -22.3,
    }));

    expect(normalized.lines[0]?.points.map((point) => point.originalIndex)).toEqual([1, 2, 3]);
  });

  it("does not deduplicate an equal XY point later in the LineString", () => {
    const normalized = normalizeAdaptiveCurve({
      ...makeInitialCurve({
        longitude: -49.3,
        latitude: -22.3,
      }),
      lines: [{
        points: [
          { longitude: -49.1, latitude: -22.1, z: -7000000, originalIndex: 0, lineIndex: 0 },
          { longitude: -49.2, latitude: -22.2, z: -7000000, originalIndex: 1, lineIndex: 0 },
          { longitude: -49.3, latitude: -22.3, z: 12, originalIndex: 2, lineIndex: 0 },
          { longitude: -49.2, latitude: -22.2, z: 13, originalIndex: 3, lineIndex: 0 },
        ],
      }],
    });

    expect(normalized.lines[0]?.points.map((point) => point.originalIndex)).toEqual([1, 2, 3]);
  });

  it("preserves a non-zero point when both deltas are strictly below 1e-7°", () => {
    const normalized = normalizeAdaptiveCurve(makeInitialCurve({
      longitude: -49.20000005,
      latitude: -22.20000005,
    }));

    expect(normalized.lines[0]?.points.map((point) => point.originalIndex)).toEqual([1, 2, 3]);
  });

  it("preserves when only longitude delta is below 1e-7°", () => {
    const normalized = normalizeAdaptiveCurve(makeInitialCurve({
      longitude: -49.20000005,
      latitude: -22.1999998,
    }));

    expect(normalized.lines[0]?.points.map((point) => point.originalIndex)).toEqual([1, 2, 3]);
  });

  it("preserves when only latitude delta is below 1e-7°", () => {
    const normalized = normalizeAdaptiveCurve(makeInitialCurve({
      longitude: -49.1999998,
      latitude: -22.20000005,
    }));

    expect(normalized.lines[0]?.points.map((point) => point.originalIndex)).toEqual([1, 2, 3]);
  });

  it("preserves a component exactly at 1e-7°", () => {
    const normalized = normalizeAdaptiveCurve(makeInitialCurve({
      longitude: -49.2000002,
      latitude: -22.20000005,
    }));

    expect(normalized.lines[0]?.points.map((point) => point.originalIndex)).toEqual([1, 2, 3]);
  });

  it("preserves negative deltas inside ±1e-7°", () => {
    const normalized = normalizeAdaptiveCurve(makeInitialCurve({
      longitude: -49.19999995,
      latitude: -22.19999995,
    }));

    expect(normalized.lines[0]?.points.map((point) => point.originalIndex)).toEqual([1, 2, 3]);
  });

  it("preserves a later exact duplicate outside the confirmed initial case", () => {
    const normalized = normalizeAdaptiveCurve({
      ...makeInitialCurve({
        longitude: -49.3,
        latitude: -22.3,
      }),
      lines: [{
        points: [
          { longitude: -49.1, latitude: -22.1, z: -7000000, originalIndex: 0, lineIndex: 0 },
          { longitude: -49.2, latitude: -22.2, z: -7000000, originalIndex: 1, lineIndex: 0 },
          { longitude: -49.3, latitude: -22.3, z: 1, originalIndex: 2, lineIndex: 0 },
          { longitude: -49.3, latitude: -22.3, z: 1, originalIndex: 3, lineIndex: 0 },
        ],
      }],
    });

    expect(normalized.lines[0]?.points.map((point) => point.originalIndex)).toEqual([1, 2, 3]);
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
