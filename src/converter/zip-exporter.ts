import JSZip from "jszip";
import { encodeAdaptiveCurve } from "./fdshape-encoder";
import { parseAdaptiveCurve } from "./spatial-data-parser";
import type { ProjectAnalysis } from "./types";

export async function exportValidatedAdaptiveCurves(source: JSZip, analysis: ProjectAnalysis, fieldId: string) {
  const output = new JSZip();
  const failures: string[] = [];
  let converted = 0;
  const field = analysis.clients.flatMap((client) => client.farms.flatMap((farm) => farm.fields)).find((entry) => entry.id === fieldId);
  if (!field) throw new Error("Selecione um talhão válido para exportar.");
  for (const item of field.adaptiveCurves) {
    try {
      if (!item.path) throw new Error("arquivo .gjson não localizado");
      const content = await source.file(item.path)?.async("text");
      if (!content) throw new Error("arquivo vazio");
      const geometry = parseAdaptiveCurve(content);
      const fileGuid = item.guid ?? item.id;
      output.file(`AdaptiveCurve/CurveTrack${fileGuid}.fdShape`, encodeAdaptiveCurve(geometry));
      converted += 1;
    } catch (error) {
      failures.push(`${item.path}: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }
  }
  output.file("RELATORIO.txt", [
    "Exportação parcial validada — Gen4 → GS3 Converter",
    `AdaptiveCurve convertidas: ${converted}`,
    `Talhão selecionado: ${field.name} (${field.id})`,
    `Falhas: ${failures.length}`,
    "ABLine, ABCurve, Boundary e Flags não foram convertidos: especificação GS3 pendente.",
    "Este pacote não é apresentado como projeto GS3 completo: setup.fds, global.ver e host ainda não foram especificados.",
    ...failures.map((failure) => `- ${failure}`),
  ].join("\n"));
  if (!converted) throw new Error(failures[0] ?? "Nenhuma AdaptiveCurve compatível foi encontrada.");
  return { blob: await output.generateAsync({ type: "blob" }), converted, failures };
}