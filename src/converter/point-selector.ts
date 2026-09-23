import type { AdaptiveCurveGeometry, AdaptiveCurveLine, CurvePoint, NormalizedCurve } from "./types";

/**
 * The exact GS3 point-selection/simplification rule is not yet known.
 *
 * This module intentionally does not implement a distance, angular, RDP,
 * Douglas-Peucker, threshold, or other inferred simplification algorithm.
 * It only performs the structural normalization already established from
 * the real 600057 Gen4/GS3 pair: leading -7000000 initialization points
 * are kept out of the geometric sequence sent to the CurveTrack encoder.
 */
export function normalizeAdaptiveCurve(geometry: AdaptiveCurveGeometry): NormalizedCurve {
  const lines = geometry.lines.map((line, lineIndex) => ({
    points: line.points.map((point) => ({ ...point, lineIndex })),
  }));

  if (lines[0]) {
    lines[0] = stripLeadingInitializationPoints(lines[0]);
  }

  return {
    curveId: geometry.curveId,
    referenceLongitude: geometry.referenceLongitude,
    referenceLatitude: geometry.referenceLatitude,
    lines,
    metadata: geometry.metadata,
  };
}

function stripLeadingInitializationPoints(line: AdaptiveCurveLine): AdaptiveCurveLine {
  let firstGeometryIndex = 0;
  while (firstGeometryIndex < line.points.length && line.points[firstGeometryIndex]?.z === -7000000) {
    firstGeometryIndex += 1;
  }
  return { points: line.points.slice(firstGeometryIndex) };
}

export function selectCurvePoints(geometry: AdaptiveCurveGeometry): CurvePoint[][] {
  return normalizeAdaptiveCurve(geometry).lines.map((line) => line.points);
}
