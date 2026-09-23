import { describe, expect, it } from "vitest";
import { parseAdaptiveCurve } from "./spatial-data-parser";
import { toCurveTrackCoordinates } from "./coordinate-transformer";

function gjson(coordinates: unknown[][][], properties: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties,
      geometry: { type: "MultiLineString", coordinates },
    }],
  });
}

describe("AdaptiveCurve spatial reference", () => {
  it("preserves an explicit reference from the leading Gen4 initialization record", () => {
    const content = gjson([[
      [-49.87043072, -21.78219139, -7000000, 0],
      [-49.870430716, -21.782191391, -7000000, 0],
      [-49.870430716, -21.782191391, 0, 0],
    ]]);

    const geometry = parseAdaptiveCurve(content);

    expect(geometry.referenceLongitude).toBe(-49.870430716);
    expect(geometry.referenceLatitude).toBe(-21.782191391);

    const firstGeometryPoint = geometry.lines[0].points[2];
    expect(firstGeometryPoint).toBeDefined();
    expect(toCurveTrackCoordinates(firstGeometryPoint, geometry)).toEqual({ x: 0, y: 0 });
  });

  it("prefers an explicit metadata reference when one is present", () => {
    const content = gjson([[
      [-49.87043072, -21.78219139, -7000000, 0],
      [-49.870430716, -21.782191391, -7000000, 0],
      [-49.870430716, -21.782191391, 0, 0],
    ]], {
      referenceLongitude: -49.9,
      referenceLatitude: -21.9,
    });

    const geometry = parseAdaptiveCurve(content);

    expect(geometry.referenceLongitude).toBe(-49.9);
    expect(geometry.referenceLatitude).toBe(-21.9);
  });

  it("keeps the existing first-point fallback when no explicit reference exists", () => {
    const content = gjson([[
      [-49.87043072, -21.78219139, 0, 0],
      [-49.870430716, -21.782191391, 0, 0],
    ]]);

    const geometry = parseAdaptiveCurve(content);

    expect(geometry.referenceLongitude).toBe(-49.87043072);
    expect(geometry.referenceLatitude).toBe(-21.78219139);
  });
});
