import type { AdaptiveCurveGeometry } from "./types";

const HEADER_VALUES = [0n, 0n, 513n, 0n, 1n, 0n, 1n] as const;

export function encodeAdaptiveCurve(input: AdaptiveCurveGeometry): ArrayBuffer {
  const lines = input.lines.filter((line) => line.length > 0);
  const totalPoints = lines.reduce((total, line) => total + line.length, 0);
  const recordCount = 2 + totalPoints + Math.max(0, lines.length - 1);
  const buffer = new ArrayBuffer(64 + recordCount * 20);
  const view = new DataView(buffer);
  HEADER_VALUES.forEach((value, index) => view.setBigUint64(index * 8, value, true));
  view.setBigUint64(56, BigInt(recordCount), true);
  let offset = 64;
  const write = (x: number, y: number, type: number) => {
    view.setFloat64(offset, x, true);
    view.setFloat64(offset + 8, y, true);
    view.setFloat32(offset + 16, type, true);
    offset += 20;
  };
  write(0, 0, 999.9);
  write(0, 0, 1.0);
  lines.forEach((line, lineIndex) => {
    line.forEach(([longitude, latitude]) =>
      write(longitude - input.referenceLongitude, latitude - input.referenceLatitude, 1.0),
    );
    if (lineIndex < lines.length - 1) {
      const last = line[line.length - 1];
      if (last) write(last[0] - input.referenceLongitude, last[1] - input.referenceLatitude, 999.9);
    }
  });
  return buffer;
}