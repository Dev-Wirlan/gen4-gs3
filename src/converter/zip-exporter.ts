import JSZip from "jszip";
import { encodeAdaptiveCurve } from "./fdshape-encoder";
import { parseAdaptiveCurve } from "./spatial-data-parser";
import type { ProjectAnalysis } from "./types";

export async function exportValidatedAdaptiveCurves(source: JSZip, analysis: ProjectAnalysis) {
  const output = new JSZip();
  const failures: string[] = [];
  let converted = 0;
  for (const item of analysis.spatial.filter((entry) => entry.type === "AdaptiveCurve")) {
    try {
      const content = await source.file(item.path)?.async("text");
      if (!content) throw new Error("arquivo vazio");
      const geometry = parseAdaptiveCurve(content);
      const safeName = item.name.replace(/[^a-z0-9_-]+/gi, "_");
      output.file(`AdaptiveCurve/${safeName}/CurveTrack.fdShape`, encodeAdaptiveCurve(geometry));
      converted += 1;
    } catch (error) {
      failures.push(`${item.path}: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }
  }
  output.file("RELATORIO.txt", [
    "Exportação parcial validada — Gen4 → GS3 Converter",
    `AdaptiveCurve convertidas: ${converted}`,
    `Falhas: ${failures.length}`,
    "ABCurve, Boundary e Flags não foram convertidos: especificação GS3 pendente.",
    "Este pacote não é apresentado como projeto GS3 completo: setup.fds, global.ver e host ainda não foram especificados.",
    ...failures.map((failure) => `- ${failure}`),
  ].join("\n"));
  if (!converted) throw new Error(failures[0] ?? "Nenhuma AdaptiveCurve compatível foi encontrada.");
  return { blob: await output.generateAsync({ type: "blob" }), converted, failures };
}