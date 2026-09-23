import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { compare600057 } from "./curvetrack-reference-comparator";

const GUID = "c63268f1-5a2e-4f2e-bdce-0e8002ba368a";

function makeFdShape(records: Array<[number, number, number]>): Uint8Array {
  const buffer = new ArrayBuffer(64 + records.length * 20);
  const view = new DataView(buffer);
  [0n, 0n, 513n, 0n, 1n, 0n, 1n].forEach((value, index) => view.setBigUint64(index * 8, value, true));
  view.setBigUint64(56, BigInt(records.length), true);
  records.forEach(([x, y, type], index) => {
    const offset = 64 + index * 20;
    view.setFloat64(offset, x, true);
    view.setFloat64(offset + 8, y, true);
    view.setFloat32(offset + 16, type, true);
  });
  return new Uint8Array(buffer);
}

async function makeZip(name: string, files: Record<string, Uint8Array | string>): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return new File([await zip.generateAsync({ type: "uint8array" })], name, { type: "application/zip" });
}

describe("CurveTrack 600057 comparator", () => {
  it("compares the real conversion pipeline against a reference fdShape and reports penultimate markers without inventing a rule", async () => {
    const gen4 = await makeZip("600057-gen4.zip", {
      "Curves/c63268f1-5a2e-4f2e-bdce-0e8002ba368a.gjson": JSON.stringify({
        type: "Feature",
        geometry: {
          type: "MultiLineString",
          coordinates: [
            [
              [-49.1000, -22.1000, -7000000],
              [-49.0999, -22.0999, -7000000],
              [-49.0998, -22.0998, 10],
              [-49.09970005, -22.09970005, 11],
            ],
            [
              [-49.0996, -22.0996, 12],
            ],
          ],
        },
        properties: {
          referenceLongitude: -49.1,
          referenceLatitude: -22.1,
        },
      }),
    });

    const reference = await makeZip("600057-gs3.zip", {
      "GS3_2630/JD4600/RCD/EIC/Fields/31/field/CurveTrackc63268f1-5a2e-4f2e-bdce-0e8002ba368a.fdShape":
        makeFdShape([
          [0, 0, 999.9],
          [0, 0, 1.0],
          [0, 0, 0.0],
          [0.0002, 0.0002, 0.0],
          [0.0002, 0.0002, 999.9],
          [0.0004, 0.0004, 0.0],
        ]),
    });

    const result = await compare600057(gen4, reference, [GUID]);

    expect(result.curves).toHaveLength(1);
    expect(result.curves[0]?.selectedPoints).toBe(3);
    expect(result.curves[0]?.gen4LineStrings).toBe(2);
    expect(result.curves[0]?.referenceMarkers).toBe(1);
    expect(result.curves[0]?.specialFinalPointCases[0]?.markerMatches).toBe("PENULTIMATE");
    expect(result.curves[0]?.segmentDifferences).toHaveLength(0);
  });
});
