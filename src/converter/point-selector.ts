import type { AdaptiveCurveGeometry, AdaptiveCurveLine, CurvePoint, NormalizedCurve } from "./types";

/**
 * The exact GS3 point-selection/simplification rule is not yet known.
 *
 * This module intentionally does not implement a distance, angular, RDP,
 * Douglas-Peucker, threshold, or other inferred simplification algorithm.
 * It only performs the structural normalization established from the real
 * 600057 Gen4/GS3 pair, plus the confirmed initial duplicate rule.
 */
export function normalizeAdaptiveCurve(geometry: AdaptiveCurveGeometry): NormalizedCurve {
  const firstLine = geometry.lines.find((line) => line.points.length > 0);
  const firstPoint = firstLine?.points[0];
  const secondPoint = firstLine?.points[1];
  const inferredReference = firstPoint?.z === -7000000 ? firstPoint : undefined;
  const inferredFirstGeometry = inferredReference && secondPoint?.z === -7000000
    ? secondPoint
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
      const initialGeometryPoints = firstLinePoints.slice(2);
      const firstNormalPoint = initialGeometryPoints[0];

      // Confirmed 600057 rule: the first normal point immediately after the
      // two -7000000 initialization points is omitted only when its XY is
      // exactly the same as firstGeometryPoint. No tolerance or general
      // deduplication is applied.
      const hasConfirmedInitialDuplicate = Boolean(
        firstNormalPoint
        && firstNormalPoint.longitude === firstGeometryPoint.longitude
        && firstNormalPoint.latitude === firstGeometryPoint.latitude,
      );

      lines[0] = {
        points: [
          firstGeometryPoint,
          ...(hasConfirmedInitialDuplicate ? initialGeometryPoints.slice(1) : initialGeometryPoints),
        ],
      };
    }
  }

  return {
    ...(geometry.curveId ? { curveId: geometry.curveId } : {}),
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
