import JSZip from "jszip";
import { encodeAdaptiveCurve } from "./fdshape-encoder";
import { normalizeAdaptiveCurve } from "./point-selector";
import { parseAdaptiveCurve } from "./spatial-data-parser";
import type { CurvePoint } from "./types";

export const GS3_600057_CURVE_GUIDS = [
  "c63268f1-5a2e-4f2e-bdce-0e8002ba368a",
  "9f8d31ae-de91-48aa-a2d9-2f8fe2a0bb2a",
  "748f242a-fb47-4385-bdb0-285fe5ae70bb",
  "a23b916c-b099-42ff-910e-ab881ebf49ff",
  "7f5c29a6-7a59-48d1-9b6d-75f3526f7868",
] as const;

const TYPE_EPSILON = 0.01;
const COORDINATE_EPSILON = 1e-12;
const GUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export interface DecodedCurveRecord {
  index: number;
  x: number;
  y: number;
  type: number;
}

export interface DecodedCurveSegment {
  lineIndex: number;
  points: DecodedCurveRecord[];
  marker?: DecodedCurveRecord;
}

export type DivergenceReason = "SELEÇÃO" | "COORDENADA" | "SEGMENTAÇÃO" | "MARKER" | "FORMATO";

export interface CurveComparison {
  guid: string;
  gen4Path?: string;
  referencePath?: string;
  gen4LineStrings: number;
  gen4RawPoints: number;
  selectedPoints: number;
  referenceRecords: number;
  referenceGeometryPoints: number;
  referenceStateRecords: number;
  referenceMarkers: number;
  generatedRecords: number;
  generatedGeometryPoints: number;
  generatedStateRecords: number;
  generatedMarkers: number;
  referenceRecordCount?: number;
  generatedRecordCount?: number;
  firstDivergence?: {
    lineIndex: number;
    pointIndex?: number;
    reason: DivergenceReason;
    gen4?: CurvePoint;
    reference?: DecodedCurveRecord;
    generated?: DecodedCurveRecord;
  };
  specialFinalPointCases: Array<{
    lineIndex: number;
    gen4Last?: CurvePoint;
    gen4Penultimate?: CurvePoint;
    referenceMarker?: DecodedCurveRecord;
    markerMatches: "LAST" | "PENULTIMATE" | "NEITHER" | "NO_MARKER";
  }>;
  segmentDifferences: Array<{
    lineIndex: number;
    expectedPoints: number;
    generatedPoints: number;
    expectedMarker: boolean;
    generatedMarker: boolean;
    firstPointDifference?: number;
  }>;
}

export interface CurveComparisonReport {
  curves: CurveComparison[];
  firstDivergence?: {
    guid: string;
    lineIndex: number;
    pointIndex?: number;
    reason: DivergenceReason;
  };
  report: string;
}

function sameNumber(a: number, b: number, epsilon = COORDINATE_EPSILON): boolean {
  return Math.abs(a - b) <= epsilon;
}

function isType(record: DecodedCurveRecord, type: number): boolean {
  return Math.abs(record.type - type) <= TYPE_EPSILON;
}

function isGuid(value: string): boolean {
  return GUID_PATTERN.test(value);
}

function findGuid(path: string, text: string): string | undefined {
  const fromPath = path.match(GUID_PATTERN)?.[0]?.toLowerCase();
  if (fromPath) return fromPath;
  const fromText = text.match(GUID_PATTERN)?.[0]?.toLowerCase();
  return fromText;
}

async function readZip(file: File): Promise<JSZip> {
  return JSZip.loadAsync(file);
}

async function findGen4Curve(zip: JSZip, guid: string): Promise<{ path: string; text: string } | undefined> {
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".gjson"));
  for (const entry of entries) {
    if (entry.name.toLowerCase().includes(guid)) {
      return { path: entry.name, text: await entry.async("text") };
    }
  }
  for (const entry of entries) {
    const text = await entry.async("text");
    if (text.toLowerCase().includes(guid)) return { path: entry.name, text };
  }
  return undefined;
}

async function findReferenceCurve(zip: JSZip, guid: string): Promise<{ path: string; bytes: Uint8Array } | undefined> {
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && /curvetrack.*\.fdshape$/i.test(entry.name));
  const exact = entries.find((entry) => entry.name.toLowerCase().includes(guid));
  if (!exact) return undefined;
  return { path: exact.name, bytes: await exact.async("uint8array") };
}

function decodeFdShape(bytes: Uint8Array): { records: DecodedCurveRecord[]; recordCount: number } {
  if (bytes.length < 64) throw new Error(`fdShape menor que o header mínimo: ${bytes.length} bytes`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const recordCount = Number(view.getBigUint64(56, true));
  const expectedSize = 64 + recordCount * 20;
  if (expectedSize > bytes.length) {
    throw new Error(`fdShape truncado: header indica ${recordCount} registros, mas existem ${bytes.length} bytes`);
  }
  const records: DecodedCurveRecord[] = [];
  for (let index = 0; index < recordCount; index++) {
    const offset = 64 + index * 20;
    records.push({
      index,
      x: view.getFloat64(offset, true),
      y: view.getFloat64(offset + 8, true),
      type: view.getFloat32(offset + 16, true),
    });
  }
  return { records, recordCount };
}

function splitSegments(records: DecodedCurveRecord[]): DecodedCurveSegment[] {
  const body = records.slice(2);
  const segments: DecodedCurveSegment[] = [];
  let current: DecodedCurveSegment = { lineIndex: 0, points: [] };
  for (const record of body) {
    if (isType(record, 999.9)) {
      current.marker = record;
      segments.push(current);
      current = { lineIndex: segments.length, points: [] };
    } else {
      current.points.push(record);
    }
  }
  if (current.points.length || !segments.length) segments.push(current);
  return segments;
}

function transformed(point: CurvePoint, referenceLongitude: number, referenceLatitude: number): { x: number; y: number } {
  return {
    x: point.longitude - referenceLongitude,
    y: point.latitude - referenceLatitude,
  };
}

function recordMatchesPoint(record: DecodedCurveRecord | undefined, point: CurvePoint | undefined, refLon: number, refLat: number): boolean {
  if (!record || !point) return false;
  const expected = transformed(point, refLon, refLat);
  return sameNumber(record.x, expected.x) && sameNumber(record.y, expected.y);
}

function summarizeReason(
  reference: DecodedCurveSegment | undefined,
  generated: DecodedCurveSegment | undefined,
  gen4: ReturnType<typeof parseAdaptiveCurve>["lines"][number] | undefined,
): CurveComparison["firstDivergence"]["reason"] {
  if (!reference || !generated || reference.points.length !== generated.points.length || Boolean(reference.marker) !== Boolean(generated.marker)) {
    return "SEGMENTAÇÃO";
  }
  if (gen4 && reference.points.length !== gen4.points.length) return "SELEÇÃO";
  for (let i = 0; i < Math.min(reference.points.length, generated.points.length); i++) {
    if (!sameNumber(reference.points[i]!.x, generated.points[i]!.x) || !sameNumber(reference.points[i]!.y, generated.points[i]!.y)) {
      return "COORDENADA";
    }
  }
  if (reference.marker && generated.marker && (!sameNumber(reference.marker.x, generated.marker.x) || !sameNumber(reference.marker.y, generated.marker.y) || !sameNumber(reference.marker.type, generated.marker.type, TYPE_EPSILON))) {
    return "MARKER";
  }
  return "FORMATO";
}

function compareCurve(
  guid: string,
  gen4Path: string,
  geometry: ReturnType<typeof parseAdaptiveCurve>,
  referencePath: string,
  referenceBytes: Uint8Array,
  generatedBytes: Uint8Array,
): CurveComparison {
  const reference = decodeFdShape(referenceBytes);
  const generated = decodeFdShape(generatedBytes);
  const referenceSegments = splitSegments(reference.records);
  const generatedSegments = splitSegments(generated.records);
  const normalized = normalizeAdaptiveCurve({ ...geometry, curveId: guid });
  const selectedPoints = normalized.lines.reduce((total, line) => total + line.points.length, 0);
  const referenceGeometryPoints = reference.records.filter((record) => isType(record, 0)).length;
  const generatedGeometryPoints = generated.records.filter((record) => isType(record, 0)).length;
  const referenceMarkers = reference.records.filter((record) => isType(record, 999.9)).length;
  const generatedMarkers = generated.records.filter((record) => isType(record, 999.9)).length;
  const referenceStateRecords = reference.records.filter((record) => isType(record, 1)).length;
  const generatedStateRecords = generated.records.filter((record) => isType(record, 1)).length;
  const segmentDifferences: CurveComparison["segmentDifferences"] = [];
  const specialFinalPointCases: CurveComparison["specialFinalPointCases"] = [];
  let firstDivergence: CurveComparison["firstDivergence"];

  const segmentCount = Math.max(geometry.lines.length, referenceSegments.length, generatedSegments.length);
  for (let lineIndex = 0; lineIndex < segmentCount; lineIndex++) {
    const gen4Line = geometry.lines[lineIndex];
    const refSegment = referenceSegments[lineIndex];
    const genSegment = generatedSegments[lineIndex];
    const expectedPoints = refSegment?.points.length ?? 0;
    const generatedPoints = genSegment?.points.length ?? 0;
    let firstPointDifference: number | undefined;
    const pointCount = Math.max(expectedPoints, generatedPoints);
    for (let pointIndex = 0; pointIndex < pointCount; pointIndex++) {
      const a = refSegment?.points[pointIndex];
      const b = genSegment?.points[pointIndex];
      if (!a || !b || !sameNumber(a.x, b.x) || !sameNumber(a.y, b.y)) {
        firstPointDifference = pointIndex;
        break;
      }
    }
    const markerDifference = Boolean(refSegment?.marker) !== Boolean(genSegment?.marker)
      || (refSegment?.marker && genSegment?.marker
        && (!sameNumber(refSegment.marker.x, genSegment.marker.x)
          || !sameNumber(refSegment.marker.y, genSegment.marker.y)
          || !sameNumber(refSegment.marker.type, genSegment.marker.type, TYPE_EPSILON)));
    if (expectedPoints !== generatedPoints || markerDifference || firstPointDifference !== undefined) {
      segmentDifferences.push({
        lineIndex,
        expectedPoints,
        generatedPoints,
        expectedMarker: Boolean(refSegment?.marker),
        generatedMarker: Boolean(genSegment?.marker),
        ...(firstPointDifference !== undefined ? { firstPointDifference } : {}),
      });
    }

    if (gen4Line && refSegment) {
      const last = gen4Line.points[gen4Line.points.length - 1];
      const penultimate = gen4Line.points[gen4Line.points.length - 2];
      const marker = refSegment.marker;
      let markerMatches: "LAST" | "PENULTIMATE" | "NEITHER" | "NO_MARKER" = "NO_MARKER";
      if (marker) {
        if (recordMatchesPoint(marker, last, geometry.referenceLongitude, geometry.referenceLatitude)) markerMatches = "LAST";
        else if (recordMatchesPoint(marker, penultimate, geometry.referenceLongitude, geometry.referenceLatitude)) markerMatches = "PENULTIMATE";
        else markerMatches = "NEITHER";
      }
      specialFinalPointCases.push({ lineIndex, ...(last ? { gen4Last: last } : {}), ...(penultimate ? { gen4Penultimate: penultimate } : {}), ...(marker ? { referenceMarker: marker } : {}), markerMatches });
    }

    if (!firstDivergence && (expectedPoints !== generatedPoints || firstPointDifference !== undefined || markerDifference)) {
      firstDivergence = {
        lineIndex,
        ...(firstPointDifference !== undefined ? { pointIndex: firstPointDifference } : {}),
        reason: markerDifference && expectedPoints === generatedPoints && firstPointDifference === undefined ? "MARKER" : summarizeReason(refSegment, genSegment, gen4Line),
        ...(gen4Line?.points[firstPointDifference ?? 0] ? { gen4: gen4Line.points[firstPointDifference ?? 0] } : {}),
        ...(refSegment?.points[firstPointDifference ?? 0] ? { reference: refSegment.points[firstPointDifference ?? 0] } : {}),
        ...(genSegment?.points[firstPointDifference ?? 0] ? { generated: genSegment.points[firstPointDifference ?? 0] } : {}),
      };
    }
  }

  const first = firstDivergence;
  return {
    guid,
    gen4Path,
    referencePath,
    gen4LineStrings: geometry.lines.length,
    gen4RawPoints: geometry.lines.reduce((total, line) => total + line.points.length, 0),
    selectedPoints,
    referenceRecords: reference.recordCount,
    referenceGeometryPoints,
    referenceStateRecords,
    referenceMarkers,
    generatedRecords: generated.recordCount,
    generatedGeometryPoints,
    generatedStateRecords,
    generatedMarkers,
    referenceRecordCount: reference.recordCount,
    generatedRecordCount: generated.recordCount,
    ...(first ? { firstDivergence: first } : {}),
    specialFinalPointCases,
    segmentDifferences,
  };
}

export async function compare600057(gen4File: File, gs3File: File, curveGuids: readonly string[] = GS3_600057_CURVE_GUIDS): Promise<CurveComparisonReport> {
  const [gen4Zip, gs3Zip] = await Promise.all([readZip(gen4File), readZip(gs3File)]);
  const curves: CurveComparison[] = [];

  for (const rawGuid of curveGuids) {
    const guid = rawGuid.toLowerCase();
    if (!isGuid(guid)) throw new Error(`GUID inválido: ${rawGuid}`);
    const gen4 = await findGen4Curve(gen4Zip, guid);
    const reference = await findReferenceCurve(gs3Zip, guid);
    if (!gen4 || !reference) {
      curves.push({
        guid,
        ...(gen4 ? { gen4Path: gen4.path } : {}),
        ...(reference ? { referencePath: reference.path } : {}),
        gen4LineStrings: gen4 ? parseAdaptiveCurve(gen4.text).lines.length : 0,
        gen4RawPoints: gen4 ? parseAdaptiveCurve(gen4.text).lines.reduce((total, line) => total + line.points.length, 0) : 0,
        selectedPoints: 0,
        referenceRecords: 0,
        referenceGeometryPoints: 0,
        referenceStateRecords: 0,
        referenceMarkers: 0,
        generatedRecords: 0,
        generatedGeometryPoints: 0,
        generatedStateRecords: 0,
        generatedMarkers: 0,
        segmentDifferences: [],
        specialFinalPointCases: [],
        firstDivergence: { lineIndex: -1, reason: "FORMATO" },
      });
      continue;
    }
    const geometry = { ...parseAdaptiveCurve(gen4.text), curveId: guid };
    const normalized = normalizeAdaptiveCurve(geometry);
    const generatedBytes = encodeAdaptiveCurve(normalized);
    curves.push(compareCurve(guid, gen4.path, geometry, reference.path, reference.bytes, generatedBytes));
  }

  const first = curves
    .flatMap((curve) => curve.firstDivergence ? [{ guid: curve.guid, ...curve.firstDivergence }] : [])
    .sort((a, b) => a.guid.localeCompare(b.guid))[0];

  const reportLines = [
    "COMPARADOR CURVETRACK — SETUP WORK 600057",
    "",
    "GEN4 600057 → PointSelector → fdShape gerado → GS3 600057 real",
    "",
  ];
  for (const curve of curves) {
    reportLines.push(
      `Curve ${curve.guid}`,
      `  LineStrings Gen4: ${curve.gen4LineStrings}`,
      `  Pontos Gen4 brutos: ${curve.gen4RawPoints}`,
      `  Pontos selecionados: ${curve.selectedPoints}`,
      `  Registros GS3 real: ${curve.referenceRecords}`,
      `  Pontos type=0.0 real: ${curve.referenceGeometryPoints}`,
      `  Estados type=1.0 real: ${curve.referenceStateRecords}`,
      `  Marcadores 999.9 reais: ${curve.referenceMarkers}`,
      `  Registros gerados: ${curve.generatedRecords}`,
      `  Pontos type=0.0 gerados: ${curve.generatedGeometryPoints}`,
      `  Estados type=1.0 gerados: ${curve.generatedStateRecords}`,
      `  Marcadores 999.9 gerados: ${curve.generatedMarkers}`,
      `  RecordCount real/gerado: ${curve.referenceRecordCount ?? "N/D"} / ${curve.generatedRecordCount ?? "N/D"}`,
      `  Segmentos divergentes: ${curve.segmentDifferences.length}`,
      `  Casos marker LAST/PENULTIMATE/NEITHER: ${curve.specialFinalPointCases.filter((item) => item.markerMatches === "LAST").length}/${curve.specialFinalPointCases.filter((item) => item.markerMatches === "PENULTIMATE").length}/${curve.specialFinalPointCases.filter((item) => item.markerMatches === "NEITHER").length}`,
      curve.firstDivergence
        ? `  Primeira divergência: LineString ${curve.firstDivergence.lineIndex}, ponto ${curve.firstDivergence.pointIndex ?? "N/D"}, motivo ${curve.firstDivergence.reason}`
        : "  Primeira divergência: nenhuma",
      "",
    );
  }
  const firstDivergence = curves.find((curve) => curve.firstDivergence)?.firstDivergence;
  reportLines.push(
    firstDivergence
      ? `PRIMEIRA DIVERGÊNCIA GLOBAL: ${curves.find((curve) => curve.firstDivergence)?.guid} / LineString ${firstDivergence.lineIndex} / ${firstDivergence.reason}`
      : "PRIMEIRA DIVERGÊNCIA GLOBAL: nenhuma",
    "",
    "Os casos PENULTIMATE são apenas diagnósticos; o comparador não transforma essa observação em regra de seleção.",
  );

  return {
    curves,
    ...(first ? { firstDivergence: first } : {}),
    report: reportLines.join("\n"),
  };
}
