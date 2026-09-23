import { describe, expect, it } from "vitest";
import { encodeAdaptiveCurve, FD_SHAPE_LAYOUT } from "./fdshape-encoder";
import type { NormalizedCurve } from "./types";

const makeCurve = (lines: number[][][]): NormalizedCurve => ({
  referenceLongitude: -49,
  referenceLatitude: -22,
  lines: lines.map((line, lineIndex) => ({
    points: line.map(([longitude, latitude], originalIndex) => ({
      longitude,
      latitude,
      originalIndex,
      lineIndex,
    })),
  })),
  metadata: {},
});

function readRecord(bytes: Uint8Array, index: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = FD_SHAPE_LAYOUT.headerSize + index * FD_SHAPE_LAYOUT.recordSize;
  return {
    x: view.getFloat64(offset, true),
    y: view.getFloat64(offset + 8, true),
    type: view.getFloat32(offset + 16, true),
  };
}

describe("CurveTrack fdShape", () => {
  it("writes the confirmed 64-byte header and recordCount at offset 56", () => {
    const bytes = encodeAdaptiveCurve(makeCurve([[[-49, -22]]]));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    expect(bytes.byteLength).toBe(64 + 3 * 20);
    expect(Array.from({ length: 7 }, (_, index) => view.getBigUint64(index * 8, true))).toEqual([
      0n, 0n, 513n, 0n, 1n, 0n, 1n,
    ]);
    expect(view.getBigUint64(56, true)).toBe(3n);
  });

  it("writes the initial marker and state records", () => {
    const bytes = encodeAdaptiveCurve(makeCurve([[[-49, -22]]]));
    expect(readRecord(bytes, 0).x).toBe(0);
    expect(readRecord(bytes, 0).y).toBe(0);
    expect(readRecord(bytes, 0).type).toBeCloseTo(999.9, 5);
    expect(readRecord(bytes, 1)).toEqual({ x: 0, y: 0, type: 1 });
  });

  it("writes geometric points as type 0.0", () => {
    const bytes = encodeAdaptiveCurve(makeCurve([[[-48.9999, -21.9998]]]));
    expect(readRecord(bytes, 2)).toEqual({ x: 0.00010000000000331966, y: 0.00019999999999953388, type: 0 });
  });

  it("writes segment markers at the last preserved point", () => {
    const bytes = encodeAdaptiveCurve(makeCurve([
      [[-49, -22], [-48.9, -21.9]],
      [[-48.8, -21.8]],
    ]));
    expect(readRecord(bytes, 2).type).toBe(0);
    expect(readRecord(bytes, 3)).toEqual({ x: 0.10000000000000142, y: 0.10000000000000142, type: 0 });
    expect(readRecord(bytes, 4).x).toBe(0.10000000000000142);
    expect(readRecord(bytes, 4).y).toBe(0.10000000000000142);
    expect(readRecord(bytes, 4).type).toBeCloseTo(999.9, 5);
    expect(readRecord(bytes, 5).type).toBe(0);
  });

  it("does not write a final marker", () => {
    const bytes = encodeAdaptiveCurve(makeCurve([
      [[-49, -22]],
      [[-48.9, -21.9]],
    ]));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getBigUint64(56, true)).toBe(5n);
    expect(readRecord(bytes, 4).type).toBe(0);
  });

  it("uses the confirmed coordinate transform", () => {
    const bytes = encodeAdaptiveCurve(makeCurve([[[-48.75, -21.5]]]));
    expect(readRecord(bytes, 2)).toEqual({ x: 0.25, y: 0.5, type: 0 });
  });

  it("uses normalized point count for recordCount", () => {
    const bytes = encodeAdaptiveCurve(makeCurve([
      [[-49, -22], [-48.9, -21.9]],
      [[-48.8, -21.8], [-48.7, -21.7]],
      [[-48.6, -21.6]],
    ]));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getBigUint64(56, true)).toBe(9n);
  });
});
