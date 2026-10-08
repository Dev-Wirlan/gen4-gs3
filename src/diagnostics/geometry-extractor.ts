import JSZip from "jszip";
import { parseMasterData } from "./master-data-parser";
import { parseAdaptiveCurve } from "./spatial-data-parser";
import type { AdaptiveCurveGeometry, CurvePoint } from "./types";

export interface GeometryExtractorOptions {
  adaptiveCurveId?: string;
  adaptiveCurveNameIncludes?: string;
  maxMappingCandidates?: number;
}

export interface ExtractedPoint {
  index: number;
  latitude: string;
  longitude: string;
  altitude: string;
  x: string;
  y: string;
}

export interface ExtractedLineString {
  lineStringId: string;
  points: ExtractedPoint[];
}

export interface AdaptiveCurveGeometryFile {
  adaptiveCurveId: string;
  lineStrings: ExtractedLineString[];
}

export interface PointSequenceEntry {
  lineStringId: string;
  point_count: number;
  points: Array<{
    index: number;
    latitude: string;
    longitude: string;
    altitude: string;
    x: string;
    y: string;
    distance_to_next: string | null;
    local_angle: string | null;
    curvature: string | null;
  }>;
}

export interface GeometryMappingEntry {
  gen4LineStringId: string;
  setupWorkLineStringId: string;
  start_distance_m: number;
  end_distance_m: number;
  orientation: "same" | "reversed";
  mean_error_m: number;
  max_error_m: number;
}

export interface GeometryExtractionReport {
  status: "ok" | "error";
  adaptive_curves_encontradas: number;
  linestrings_gen4: number;
  linestrings_setupwork: number;
  pontos_gen4: number;
  pontos_setupwork: number;
  erros_detectados: string[];
}

export interface GeometryExtractionResult {
  adaptiveCurvesGeometry: AdaptiveCurveGeometryFile;
  pointSequence: PointSequenceEntry[];
  mappingGeometry: GeometryMappingEntry[];
  report: GeometryExtractionReport;
}

const EARTH_RADIUS_M = 6371008.8;

function cleanGuid(value: string | undefined): string {
  return (value ?? "").replace(/[{}]/g, "").toLowerCase();
}

function toRadians(value: number): number {
  return value * Math.PI / 180;
}

function projectPoint(point: CurvePoint, origin: CurvePoint): { x: number; y: number } {
  const lat0 = toRadians(origin.latitude);
  return {
    x: toRadians(point.longitude - origin.longitude) * EARTH_RADIUS_M * Math.cos(lat0),
    y: toRadians(point.latitude - origin.latitude) * EARTH_RADIUS_M,
  };
}

function distance2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distance3d(a: CurvePoint, b: CurvePoint): number {
  const lat0 = toRadians((a.latitude + b.latitude) / 2);
  const x = toRadians(b.longitude - a.longitude) * EARTH_RADIUS_M * Math.cos(lat0);
  const y = toRadians(b.latitude - a.latitude) * EARTH_RADIUS_M;
  const z = (b.z ?? 0) - (a.z ?? 0);
  return Math.hypot(x, y, z);
}

function angleDegrees(a: CurvePoint, b: CurvePoint, c: CurvePoint): number | null {
  const origin = b;
  const pa = projectPoint(a, origin);
  const pc = projectPoint(c, origin);
  const na = Math.hypot(pa.x, pa.y);
  const nc = Math.hypot(pc.x, pc.y);
  if (na === 0 || nc === 0) return null;
  const cosine = Math.max(-1, Math.min(1, (pa.x * pc.x + pa.y * pc.y) / (na * nc)));
  return Math.acos(cosine) * 180 / Math.PI;
}

function curvatureLocal(a: CurvePoint, b: CurvePoint, c: CurvePoint): number | null {
  const origin = b;
  const pa = projectPoint(a, origin);
  const pc = projectPoint(c, origin);
  const ab = Math.hypot(pa.x, pa.y);
  const bc = Math.hypot(pc.x, pc.y);
  const ac = Math.hypot(pa.x - pc.x, pa.y - pc.y);
  const area2 = Math.abs(pa.x * pc.y - pa.y * pc.x);
  const denominator = ab * bc * ac;
  if (denominator === 0) return null;
  return (2 * area2) / denominator;
}

function pointId(curveId: string, lineIndex: number): string {
  return `${curveId}:line-${lineIndex}`;
}

function serializeNumber(value: number | undefined | null): string {
  return value === undefined || value === null || !Number.isFinite(value)
    ? ""
    : value.toFixed(9);
}

function toGeometryFile(curveId: string, geometry: AdaptiveCurveGeometry): AdaptiveCurveGeometryFile {
  const firstPoint = geometry.lines.find((line) => line.points.length)?.points[0];
  const origin = firstPoint ?? {
    longitude: geometry.referenceLongitude,
    latitude: geometry.referenceLatitude,
    originalIndex: 0,
    lineIndex: 0,
  };

  return {
    adaptiveCurveId: curveId,
    lineStrings: geometry.lines.map((line, lineIndex) => ({
      lineStringId: pointId(curveId, lineIndex),
      points: line.points.map((point, index) => {
        const xy = projectPoint(point, origin);
        return {
          index,
          latitude: point.latitude.toFixed(12),
          longitude: point.longitude.toFixed(12),
          altitude: serializeNumber(point.z),
          x: xy.x.toFixed(6),
          y: xy.y.toFixed(6),
        };
      }),
    })),
  };
}

function toPointSequence(curveId: string, geometry: AdaptiveCurveGeometry): PointSequenceEntry[] {
  const firstPoint = geometry.lines.find((line) => line.points.length)?.points[0];
  const origin = firstPoint ?? {
    longitude: geometry.referenceLongitude,
    latitude: geometry.referenceLatitude,
    originalIndex: 0,
    lineIndex: 0,
  };

  return geometry.lines.map((line, lineIndex) => ({
    lineStringId: pointId(curveId, lineIndex),
    point_count: line.points.length,
    points: line.points.map((point, index) => {
      const xy = projectPoint(point, origin);
      const previous = line.points[index - 1];
      const next = line.points[index + 1];
      return {
        index,
        latitude: point.latitude.toFixed(12),
        longitude: point.longitude.toFixed(12),
        altitude: serializeNumber(point.z),
        x: xy.x.toFixed(6),
        y: xy.y.toFixed(6),
        distance_to_next: next ? serializeNumber(distance3d(point, next)) : null,
        local_angle: previous && next ? serializeNumber(angleDegrees(previous, point, next)) : null,
        curvature: previous && next ? serializeNumber(curvatureLocal(previous, point, next)) : null,
      };
    }),
  }));
}

function endpointPairDistance(
  gen: CurvePoint[],
  setup: CurvePoint[],
  reversed: boolean,
): { start: number; end: number; score: number } {
  const genStart = gen[0];
  const genEnd = gen[gen.length - 1];
  const setupStart = reversed ? setup[setup.length - 1] : setup[0];
  const setupEnd = reversed ? setup[0] : setup[setup.length - 1];
  const start = distance3d(genStart, setupStart);
  const end = distance3d(genEnd, setupEnd);
  return { start, end, score: start + end };
}

function sampleLine(line: CurvePoint[], count = 9): CurvePoint[] {
  if (line.length <= count) return line;
  const result: CurvePoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i / (count - 1)) * (line.length - 1));
    result.push(line[index]);
  }
  return result;
}

function nearestDistance(point: CurvePoint, line: CurvePoint[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const candidate of line) {
    best = Math.min(best, distance3d(point, candidate));
  }
  return best;
}

function meanMaxGeometryError(gen: CurvePoint[], setup: CurvePoint[], reversed: boolean) {
  const ordered = reversed ? [...setup].reverse() : setup;
  const samples = sampleLine(gen);
  const errors = samples.map((point) => nearestDistance(point, ordered));
  const mean = errors.reduce((sum, value) => sum + value, 0) / errors.length;
  return { mean, max: Math.max(...errors) };
}

function mapLines(gen: AdaptiveCurveGeometry, setup: AdaptiveCurveGeometry): GeometryMappingEntry[] {
  const result: GeometryMappingEntry[] = [];

  for (let genIndex = 0; genIndex < gen.lines.length; genIndex += 1) {
    const source = gen.lines[genIndex];
    if (source.points.length < 2) continue;

    let best: {
      setupIndex: number;
      reversed: boolean;
      pair: { start: number; end: number; score: number };
    } | undefined;

    for (let setupIndex = 0; setupIndex < setup.lines.length; setupIndex += 1) {
      const target = setup.lines[setupIndex];
      if (target.points.length < 2) continue;

      for (const reversed of [false, true]) {
        const pair = endpointPairDistance(source.points, target.points, reversed);
        if (!best || pair.score < best.pair.score) {
          best = { setupIndex, reversed, pair };
        }
      }
    }

    if (!best) continue;

    const target = setup.lines[best.setupIndex];
    const error = meanMaxGeometryError(source.points, target.points, best.reversed);

    result.push({
      gen4LineStringId: pointId("gen4", genIndex),
      setupWorkLineStringId: pointId("setupwork", best.setupIndex),
      start_distance_m: Number(best.pair.start.toFixed(6)),
      end_distance_m: Number(best.pair.end.toFixed(6)),
      orientation: best.reversed ? "reversed" : "same",
      mean_error_m: Number(error.mean.toFixed(6)),
      max_error_m: Number(error.max.toFixed(6)),
    });
  }

  return result;
}

async function readAdaptiveCurves(
  zip: JSZip,
  options: GeometryExtractorOptions,
): Promise<Array<{ id: string; name: string; geometry: AdaptiveCurveGeometry }>> {
  const masterPath = Object.keys(zip.files).find((path) => /(^|\/)masterdata\.xml$/i.test(path));
  if (!masterPath) throw new Error("MasterData.xml não encontrado.");

  const masterText = await zip.file(masterPath)!.async("text");
  const master = parseMasterData(masterText);
  const records = master.spatial.filter((item) => item.type === "AdaptiveCurve");
  const candidates = records.filter((item) => {
    const idOk = options.adaptiveCurveId
      ? cleanGuid(item.guid) === cleanGuid(options.adaptiveCurveId)
      : true;
    const nameOk = options.adaptiveCurveNameIncludes
      ? item.name.toLowerCase().includes(options.adaptiveCurveNameIncludes.toLowerCase())
      : true;
    return idOk && nameOk;
  });

  const gjsonPaths = Object.keys(zip.files).filter((path) => /\.gjson$/i.test(path));
  const result: Array<{ id: string; name: string; geometry: AdaptiveCurveGeometry }> = [];

  for (const record of candidates) {
    const normalizedReference = record.path?.replace(/\\/g, "/").toLowerCase();
    const path = gjsonPaths.find((entry) => {
      const lower = entry.toLowerCase();
      return (normalizedReference && (lower === normalizedReference || lower.endsWith(`/${normalizedReference}`)))
        || lower.includes(cleanGuid(record.guid));
    });
    if (!path) continue;

    const content = await zip.file(path)!.async("text");
    const geometry = parseAdaptiveCurve(content);
    result.push({ id: cleanGuid(record.guid), name: record.name, geometry });
  }

  return result;
}

export async function extractP3Geometry(
  gen4Zip: JSZip,
  setupWorkZip: JSZip,
): Promise<GeometryExtractionResult> {
  const [gen4Curves, setupCurves] = await Promise.all([
    readAdaptiveCurves(gen4Zip, { adaptiveCurveId: "942e423c-caef-428e-ba70-fbb75dbfb6a1" }),
    readAdaptiveCurves(setupWorkZip, { adaptiveCurveNameIncludes: "600058_TIPO1_D75_P3" }),
  ]);

  const gen4 = gen4Curves[0];
  const setup = setupCurves[0];
  const errors: string[] = [];

  if (!gen4) errors.push("AdaptiveCurve Gen4 942e423c não encontrada.");
  if (!setup) errors.push("AdaptiveCurve Setup Work P3 não encontrada.");

  if (!gen4 || !setup) {
    return {
      adaptiveCurvesGeometry: {
        adaptiveCurveId: gen4?.id ?? setup?.id ?? "",
        lineStrings: [],
      },
      pointSequence: [],
      mappingGeometry: [],
      report: {
        status: "error",
        adaptive_curves_encontradas: Number(Boolean(gen4)) + Number(Boolean(setup)),
        linestrings_gen4: gen4?.geometry.lines.length ?? 0,
        linestrings_setupwork: setup?.geometry.lines.length ?? 0,
        pontos_gen4: gen4?.geometry.lines.reduce((sum, line) => sum + line.points.length, 0) ?? 0,
        pontos_setupwork: setup?.geometry.lines.reduce((sum, line) => sum + line.points.length, 0) ?? 0,
        erros_detectados: errors,
      },
    };
  }

  const gen4Points = gen4.geometry.lines.reduce((sum, line) => sum + line.points.length, 0);
  const setupPoints = setup.geometry.lines.reduce((sum, line) => sum + line.points.length, 0);

  return {
    adaptiveCurvesGeometry: toGeometryFile(setup.id, setup.geometry),
    pointSequence: [
      ...toPointSequence(gen4.id, gen4.geometry),
      ...toPointSequence(setup.id, setup.geometry),
    ],
    mappingGeometry: mapLines(gen4.geometry, setup.geometry),
    report: {
      status: "ok",
      adaptive_curves_encontradas: 2,
      linestrings_gen4: gen4.geometry.lines.length,
      linestrings_setupwork: setup.geometry.lines.length,
      pontos_gen4: gen4Points,
      pontos_setupwork: setupPoints,
      erros_detectados: errors,
    },
  };
}

export async function createGeometryExtractionZip(
  gen4Zip: JSZip,
  setupWorkZip: JSZip,
): Promise<JSZip> {
  const result = await extractP3Geometry(gen4Zip, setupWorkZip);
  const output = new JSZip();

  output.file(
    "adaptive_curves_geometry.json",
    JSON.stringify(result.adaptiveCurvesGeometry, null, 2),
  );
  output.file(
    "point_sequence.json",
    JSON.stringify(result.pointSequence, null, 2),
  );
  output.file(
    "mapping_geometry.json",
    JSON.stringify(result.mappingGeometry, null, 2),
  );
  output.file(
    "geometry_extraction_report.json",
    JSON.stringify(result.report, null, 2),
  );

  return output;
}
