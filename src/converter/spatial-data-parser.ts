import type { AdaptiveCurveGeometry, Compatibility, CurvePoint, SpatialElement, SpatialType } from "./types";

const TYPES: Array<[SpatialType, RegExp]> = [
  ["AdaptiveCurve", /adaptive[\s_-]*curve/i],
  ["ABLine", /ab[\s_-]*line/i],
  ["ABCurve", /ab[\s_-]*curve/i],
  ["Boundary", /operational[\s_-]*boundary|boundary|limite/i],
  ["Flags", /flags?|marcador/i],
];

export function detectSpatialType(path: string, content = ""): SpatialType {
  const sample = `${path} ${content.slice(0, 5000)}`;
  return TYPES.find(([, pattern]) => pattern.test(sample))?.[0] ?? "Unknown";
}

export function compatibilityFor(type: SpatialType): Compatibility {
  if (type === "AdaptiveCurve") return "compatible";
  if (type === "Unknown") return "unsupported";
  return "pending";
}

export function createSpatialElement(path: string, content: string, fieldId?: string, guid?: string, name?: string, forcedType?: SpatialType): SpatialElement {
  const type = forcedType ?? detectSpatialType(path, content);
  const displayName = name ?? path.split("/").pop()?.replace(/\.gjson$/i, "") ?? path;
  return { id: guid ?? path, ...(guid ? { guid } : {}), name: displayName, path, type, compatibility: compatibilityFor(type), ...(fieldId ? { fieldId } : {}) };
}

const finiteNumber = (...values: unknown[]) => {
  for (const value of values) if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
};

function pointFromCoordinate(value: unknown, originalIndex: number, lineIndex: number): CurvePoint | undefined {
  if (!Array.isArray(value) || !Number.isFinite(value[0]) || !Number.isFinite(value[1])) return undefined;
  const z = typeof value[2] === "number" && Number.isFinite(value[2]) ? value[2] : undefined;
  return {
    longitude: value[0],
    latitude: value[1],
    ...(z !== undefined ? { z } : {}),
    originalIndex,
    lineIndex,
  };
}

export function parseAdaptiveCurve(content: string): AdaptiveCurveGeometry {
  const json = JSON.parse(content) as Record<string, unknown>;
  const feature = json["type"] === "FeatureCollection"
    ? (json["features"] as Array<Record<string, unknown>> | undefined)?.[0]
    : json;
  const geometry = (feature?.["geometry"] ?? json["geometry"] ?? json) as Record<string, unknown>;
  const properties = (feature?.["properties"] ?? json["properties"] ?? {}) as Record<string, unknown>;
  const coordinates = geometry["coordinates"] as unknown;
  const geometryType = String(geometry["type"] ?? "");

  let rawLines: unknown[] = [];
  if (geometryType === "MultiLineString" && Array.isArray(coordinates)) rawLines = coordinates;
  if (geometryType === "LineString" && Array.isArray(coordinates)) rawLines = [coordinates];

  const lines = rawLines.map((rawLine, lineIndex) => ({
    points: Array.isArray(rawLine)
      ? rawLine.map((point, originalIndex) => pointFromCoordinate(point, originalIndex, lineIndex)).filter((point): point is CurvePoint => Boolean(point))
      : [],
  }));

  if (!lines.length || lines.every((line) => line.points.length === 0)) {
    throw new Error("AdaptiveCurve sem LineString/MultiLineString válido.");
  }

  const first = lines.find((line) => line.points.length > 0)?.points[0];
  if (!first) throw new Error("AdaptiveCurve sem coordenadas.");

  const firstLine = lines.find((line) => line.points.length > 0);
  const curveReference = firstLine?.points[0]?.z === -7000000 ? firstLine.points[0] : undefined;
  const firstGeometryPoint = curveReference && firstLine.points[1]?.z === -7000000
    ? firstLine.points[1]
    : undefined;

  const referenceLongitude = curveReference?.longitude ?? finiteNumber(
    properties["referenceLongitude"],
    properties["ReferenceLongitude"],
    json["referenceLongitude"],
  ) ?? first.longitude;
  const referenceLatitude = curveReference?.latitude ?? finiteNumber(
    properties["referenceLatitude"],
    properties["ReferenceLatitude"],
    json["referenceLatitude"],
  ) ?? first.latitude;

  return {
    referenceLongitude,
    referenceLatitude,
    ...(curveReference ? { curveReference } : {}),
    ...(firstGeometryPoint ? { firstGeometryPoint } : {}),
    lines,
    metadata: properties,
  };
}
