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
  const firstLine = geometry.lines.find((line) => line.points.length > 0);
  const inferredReference = firstLine?.points[0]?.z === -7000000 ? firstLine.points[0] : undefined;
  const inferredFirstGeometry = inferredReference && firstLine.points[1]?.z === -7000000
    ? firstLine.points[1]
    : undefined;

  const curveReference = geometry.curveReference ?? inferredReference;
  const firstGeometryPoint = geometry.firstGeometryPoint ?? inferredFirstGeometry;

  const lines = geometry.lines.map((line, lineIndex) => ({
    points: line.points.map((point) => ({ ...point, lineIndex })),
  }));

  if (firstGeometryPoint && curveReference && lines[0]) {
    const firstLinePoints = lines[0].points;
    const firstSpecialIndex = firstLinePoints.findIndex((point) => point.originalIndex === curveReference.originalIndex);
    const secondSpecialIndex = firstLinePoints.findIndex((point) => point.originalIndex === firstGeometryPoint.originalIndex);
    if (firstSpecialIndex === 0 && secondSpecialIndex === 1) {
      lines[0] = {
        points: [firstGeometryPoint, ...firstLinePoints.slice(2)],
      };
    }
  }

  return {
    curveId: geometry.curveId,
    referenceLongitude: geometry.referenceLongitude,
    referenceLatitude: geometry.referenceLatitude,
    ...(curveReference ? { curveReference } : {}),
    ...(firstGeometryPoint ? { firstGeometryPoint } : {}),
    lines,
    metadata: geometry.metadata,
  };
}

export function selectCurvePoints(geometry: AdaptiveCurveGeometry): CurvePoint[][] {
  return normalizeAdaptiveCurve(geometry).lines.map((line) => line.points);
}
