import { describe, expect, it } from "vitest";
import { validateGs3Project } from "@/converter/gs3-project-builder";
import type { FieldNode } from "@/converter/types";

const emptyField = {
  id: "field-1",
  name: "Talhão 1",
  adaptiveCurves: [],
  abLines: [],
  boundaries: [],
  flags: [],
} as unknown as FieldNode;

describe("validateGs3Project", () => {
  it("não libera um projeto enquanto estruturas GS3 obrigatórias não estiverem comprovadas", () => {
    const result = validateGs3Project([], emptyField);

    expect(result.valid).toBe(false);
    expect(result.status.SpatialCatalog).toBe("PENDENTE");
    expect(result.status["setup.fds"]).toBe("PENDENTE");
    expect(result.status["global.ver"]).toBe("PENDENTE");
    expect(result.status.host).toBe("PENDENTE");
  });

  it("marca CurveTrack como OK quando existe uma saída codificada sem erro", () => {
    const result = validateGs3Project(
      [{ path: "curve.fdShape", content: new Uint8Array([1]), type: "CurveTrack", status: "OK" }],
      emptyField,
    );

    expect(result.status.CurveTrack).toBe("OK");
    expect(result.valid).toBe(false);
  });

  it("não aceita CurveTrack ausente quando há AdaptiveCurve de origem", () => {
    const field = {
      ...emptyField,
      adaptiveCurves: [{ id: "curve-1", guid: "guid-1", path: "curve.gjson" }],
    } as unknown as FieldNode;

    const result = validateGs3Project([], field);

    expect(result.status.CurveTrack).toBe("ERRO");
    expect(result.errors).toContain("Talhão possui AdaptiveCurves identificadas, mas a conversão não gerou saída ou faltam dados.");
    expect(result.valid).toBe(false);
  });
});
