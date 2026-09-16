import type { AdaptiveCurveGeometry, Compatibility, SpatialElement, SpatialType } from "./types";

const TYPES: Array<[SpatialType, RegExp]> = [
  ["AdaptiveCurve", /adaptive[\s_-]*curve/i],
  ["ABCurve", /ab[\s_-]*curve/i],
  ["Boundary", /boundary|limite/i],
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

export function createSpatialElement(path: string, content: string, fieldId?: string): SpatialElement {
  const type = detectSpatialType(path, content);
  const name = path.split("/").pop()?.replace(/\.gjson$/i, "") ?? path;
  return { id: path, name, path, type, compatibility: compatibilityFor(type), ...(fieldId ? { fieldId } : {}) };
}

const finiteNumber = (...values: unknown[]) => {
  for (const value of values) if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
};

export function parseAdaptiveCurve(content: string): AdaptiveCurveGeometry {
  const json = JSON.parse(content) as Record<string, unknown>;
  const feature = json["type"] === "FeatureCollection"
    ? (json["features"] as Array<Record<string, unknown>> | undefined)?.[0]
    : json;
  const geometry = (feature?.["geometry"] ?? json["geometry"] ?? json) as Record<string, unknown>;
  const properties = (feature?.["properties"] ?? json["properties"] ?? {}) as Record<string, unknown>;
  const coordinates = geometry["coordinates"] as unknown;
  const geometryType = String(geometry["type"] ?? "");
  let lines: Array<Array<[number, number]>> = [];
  if (geometryType === "MultiLineString" && Array.isArray(coordinates)) lines = coordinates as Array<Array<[number, number]>>;
  if (geometryType === "LineString" && Array.isArray(coordinates)) lines = [coordinates as Array<[number, number]>];
  lines = lines.map((line) => line.filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])));
  if (!lines.length || lines.every((line) => line.length === 0)) throw new Error("AdaptiveCurve sem LineString/MultiLineString válido.");
  const first = lines[0]?.[0];
  if (!first) throw new Error("AdaptiveCurve sem coordenadas.");
  const referenceLongitude = finiteNumber(properties["referenceLongitude"], properties["ReferenceLongitude"], json["referenceLongitude"]) ?? first[0];
  const referenceLatitude = finiteNumber(properties["referenceLatitude"], properties["ReferenceLatitude"], json["referenceLatitude"]) ?? first[1];
  return { lines, referenceLongitude, referenceLatitude };
}