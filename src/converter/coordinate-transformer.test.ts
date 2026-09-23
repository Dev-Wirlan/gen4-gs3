import { describe, expect, it } from "vitest";
import { getCurveReference, toCurveTrackCoordinates } from "./coordinate-transformer";
import type { NormalizedCurve } from "./types";

describe("CurveTrack coordinate transformation", () => {
  it("maps the firstGeometryPoint to 0,0 while keeping curveReference as the global reference", () => {
    const curveReference = { longitude: -49.870430720, latitude: -21.782191390, z: -7000000, originalIndex: 0, lineIndex: 0 };
    const firstGeometryPoint = { longitude: -49.870430716, latitude: -21.782191391, z: -7000000, originalIndex: 1, lineIndex: 0 };
    const curve: NormalizedCurve = {
      referenceLongitude: curveReference.longitude,
      referenceLatitude: curveReference.latitude,
      curveReference,
      firstGeometryPoint,
      lines: [{ points: [firstGeometryPoint, { longitude: -49.870430400, latitude: -21.782187301, originalIndex: 2, lineIndex: 0 }] }],
      metadata: {},
    };

    const reference = getCurveReference(curve);
    expect(toCurveTrackCoordinates(firstGeometryPoint, reference, true)).toEqual({ x: 0, y: 0 });
    expect(toCurveTrackCoordinates(curve.lines[0].points[1], reference)).toEqual({
      x: 0.00000032000000516063665,
      y: 0.0000040890000008175775,
    });
  });

  it("maps the first geometry point to 0,0 even when it differs from the reference", () => {
    const reference = { referenceLongitude: -49.1, referenceLatitude: -22.1 };
    const firstGeometryPoint = { longitude: -49.0999, latitude: -22.0998, originalIndex: 1, lineIndex: 0 };
    const secondPoint = { longitude: -49.0997, latitude: -22.0995, originalIndex: 2, lineIndex: 0 };

    expect(toCurveTrackCoordinates(firstGeometryPoint, reference, true)).toEqual({ x: 0, y: 0 });
    expect(toCurveTrackCoordinates(secondPoint, reference)).toEqual({
      x: 0.00030000000000285354,
      y: 0.0005000000000023874,
    });
  });
});
