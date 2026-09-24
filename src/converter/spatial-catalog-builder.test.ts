import { describe, expect, it } from "vitest";
import { buildSpatialCatalog } from "./spatial-catalog-builder";
import type { AdaptiveCurveGeometry } from "./types";

function assertWellFormedXml(xml: string) {
  const stack: string[] = [];
  const tagPattern = /<([^!?][^>]*?)>/g;

  for (const match of xml.matchAll(tagPattern)) {
    const rawMatch = match[1];
    if (!rawMatch) continue;
    const raw = rawMatch.trim();
    if (raw.endsWith("/")) continue;

    if (raw.startsWith("/")) {
      const name = raw.slice(1).trim().split(/\s+/)[0];
      expect(stack.pop()).toBe(name);
      continue;
    }

    const name = raw.split(/\s+/)[0];
    if (name) stack.push(name);
  }

  expect(stack).toEqual([]);
}

describe("SpatialCatalog XML", () => {
  it("generates well-formed XML without literal escaped line breaks", () => {
    const geometry: AdaptiveCurveGeometry = {
      referenceLongitude: -49.1,
      referenceLatitude: -22.1,
      lines: [{
        points: [
          { longitude: -49.2, latitude: -22.2, z: 1, originalIndex: 0, lineIndex: 0 },
          { longitude: -49.3, latitude: -22.3, z: 1, originalIndex: 1, lineIndex: 0 },
        ],
      }],
      metadata: {},
    };

    const xml = buildSpatialCatalog(
      { id: "field-1", name: "Talhão 1" },
      [{ guid: "curve-1", name: "Curva 1", geometry }],
      "client-1",
      "Cliente 1",
      "farm-1",
      "Fazenda 1",
    );

    assertWellFormedXml(xml);
    expect(xml).not.toContain("\\\\n");
    expect(xml).toContain('erid="{curve-1}"');
    expect(xml).toContain('name="Fazenda 1"');
    expect(xml).toContain('name="Talhão 1"');
    expect(xml).toContain("<CurvedTrackLine");
  });
});
