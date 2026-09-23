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
): CurveTrackCoordinate {
  return {
    x: point.longitude - reference.referenceLongitude,
    y: point.latitude - reference.referenceLatitude,
  };
}

export function getCurveReference(geometry: NormalizedCurve): CurveReference {
  return {
    referenceLongitude: geometry.referenceLongitude,
    referenceLatitude: geometry.referenceLatitude,
  };
}
