import { toCurveTrackCoordinates } from "./coordinate-transformer";
import type { NormalizedCurve } from "./types";

const HEADER_VALUES = [0n, 0n, 513n, 0n, 1n, 0n, 1n] as const;
const HEADER_SIZE = 64;
const RECORD_SIZE = 20;
const INITIAL_MARKER_TYPE = 999.9;
const INITIAL_STATE_TYPE = 1.0;
const GEOMETRY_POINT_TYPE = 0.0;
const SEGMENT_MARKER_TYPE = 999.9;

export function encodeAdaptiveCurve(input: NormalizedCurve): Uint8Array {
  const lines = input.lines.filter((line) => line.points.length > 0);
  const geometryPointCount = lines.reduce((total, line) => total + line.points.length, 0);
  const recordCount = 2 + geometryPointCount + Math.max(0, lines.length - 1);
  const buffer = new ArrayBuffer(HEADER_SIZE + recordCount * RECORD_SIZE);
  const view = new DataView(buffer);

  HEADER_VALUES.forEach((value, index) => view.setBigUint64(index * 8, value, true));
  view.setBigUint64(56, BigInt(recordCount), true);

  let offset = HEADER_SIZE;
  const writeRecord = (x: number, y: number, type: number) => {
    view.setFloat64(offset, x, true);
    view.setFloat64(offset + 8, y, true);
    view.setFloat32(offset + 16, type, true);
    offset += RECORD_SIZE;
  };

  writeRecord(0, 0, INITIAL_MARKER_TYPE);
  writeRecord(0, 0, INITIAL_STATE_TYPE);

  const reference = {
    referenceLongitude: input.referenceLongitude,
    referenceLatitude: input.referenceLatitude,
  };

  lines.forEach((line, lineIndex) => {
    line.points.forEach((point) => {
      const { x, y } = toCurveTrackCoordinates(point, reference);
      writeRecord(x, y, GEOMETRY_POINT_TYPE);
    });

    if (lineIndex < lines.length - 1) {
      const last = line.points[line.points.length - 1];
      if (last) {
        const { x, y } = toCurveTrackCoordinates(last, reference);
        writeRecord(x, y, SEGMENT_MARKER_TYPE);
      }
    }
  });

  return new Uint8Array(buffer);
}

export const FD_SHAPE_LAYOUT = {
  headerSize: HEADER_SIZE,
  recordSize: RECORD_SIZE,
  recordCountOffset: 56,
  headerValues: HEADER_VALUES,
  initialMarkerType: INITIAL_MARKER_TYPE,
  initialStateType: INITIAL_STATE_TYPE,
  geometryPointType: GEOMETRY_POINT_TYPE,
  segmentMarkerType: SEGMENT_MARKER_TYPE,
} as const;
