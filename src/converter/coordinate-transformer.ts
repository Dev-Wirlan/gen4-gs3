import type { CurvePoint, NormalizedCurve } from "./types";

export interface CurveReference {
  referenceLongitude: number;
  referenceLatitude: number;
}

export interface CurveTrackCoordinate {
  x: number;
  y: number;
}

export function toCurveTrackCoordinates(
  point: Pick<CurvePoint, "longitude" | "latitude">,
  reference: CurveReference,
  isFirstGeometryPoint = false,
): CurveTrackCoordinate {
  if (isFirstGeometryPoint) return { x: 0, y: 0 };

  return {
    x: point.longitude - reference.referenceLongitude,
    y: point.latitude - reference.referenceLatitude,
  };
}

export function getCurveReference(geometry: NormalizedCurve): CurveReference {
  if (geometry.curveReference) {
    return {
      referenceLongitude: geometry.curveReference.longitude,
      referenceLatitude: geometry.curveReference.latitude,
    };
  }

  return {
    referenceLongitude: geometry.referenceLongitude,
    referenceLatitude: geometry.referenceLatitude,
  };
}
