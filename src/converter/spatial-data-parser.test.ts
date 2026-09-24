import { describe, expect, it } from "vitest";
import { parseAdaptiveCurve } from "./spatial-data-parser";

describe("AdaptiveCurve parser", () => {
  it("preserves the first two -7000000 points as explicit CurveTrack metadata", () => {
    const geometry = parseAdaptiveCurve(JSON.stringify({
      type: "Feature",
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [
            [-49.870430720, -21.782191390, -7000000],
            [-49.870430716, -21.782191391, -7000000],
            [-49.870430400, -21.782187301, 12],
          ],
        ],
      },
      properties: {},
    }));

    expect(geometry.curveReference?.originalIndex).toBe(0);
    expect(geometry.firstGeometryPoint?.originalIndex).toBe(1);
    expect(geometry.referenceLongitude).toBe(-49.870430720);
    expect(geometry.referenceLatitude).toBe(-21.782191390);
    expect(geometry.lines[0].points.map((point) => point.originalIndex)).toEqual([0, 1, 2]);
  });

  it("keeps the existing metadata/reference fallback when the initialization pair is absent", () => {
    const geometry = parseAdaptiveCurve(JSON.stringify({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-49.1, -22.1, 10],
          [-49.2, -22.2, 11],
        ],
      },
      properties: {
        referenceLongitude: -49,
        referenceLatitude: -22,
      },
    }));

    expect(geometry.curveReference).toBeUndefined();
    expect(geometry.firstGeometryPoint).toBeUndefined();
    expect(geometry.referenceLongitude).toBe(-49);
    expect(geometry.referenceLatitude).toBe(-22);
  });
});
