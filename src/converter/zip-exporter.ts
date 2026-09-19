import JSZip from "jszip";
import { encodeAdaptiveCurve } from "./fdshape-encoder";
import { convertValidatedAdaptiveCurves } from "./gs3-converter";
import type { ProjectAnalysis } from "./types";

export async function exportValidatedAdaptiveCurves(source: JSZip, analysis: ProjectAnalysis, fieldId: string) {
  const output = new JSZip();
  const result = await convertValidatedAdaptiveCurves(source, analysis, fieldId, encodeAdaptiveCurve);
  const { validation, converted } = result;

  if (!validation.valid) {
    const details = [...validation.errors, ...validation.warnings].join(" ");
    throw new Error(details || "A validação não permitiu gerar o pacote GS3.");
  }

  for (const item of converted) output.file(item.outputPath, item.content);

  const report = [
    "RELATÓRIO DE CONVERSÃO LOCAL — GEN4 → GS3",
    "",
    "A conversão foi executada integralmente no dispositivo.",
    `Talhão selecionado: ${validation.fieldName} (${validation.fieldId})`,
    "",
    "VALIDAÇÃO",
    `Resultado: ${validation.valid ? "válido" : "inválido"}`,
    `Arquivos lidos: ${validation.filesRead.length}`,
    `Arquivos preparados para conversão: ${validation.filesToConvert.length}`,
    `AdaptiveCurve convertidas: ${converted.length}`,
    `Arquivos ignorados: ${validation.ignoredFiles.length}`,
    `Avisos: ${validation.warnings.length}`,
    `Erros: ${validation.errors.length}`,
    "",
    "ARQUIVOS LIDOS",
    ...(validation.filesRead.map((file) => `- ${file}`) || ["- Nenhum"]),
    "",
    "ARQUIVOS GS3 GERADOS",
    ...(converted.map((item) => `- ${item.outputPath} ← ${item.item.path}`) || ["- Nenhum"]),
    "",
    "ARQUIVOS IGNORADOS",
    ...(validation.ignoredFiles.map((file) => `- ${file}`) || ["- Nenhum"]),
    "",
    "AVISOS",
    ...(validation.warnings.map((warning) => `- ${warning}`) || ["- Nenhum"]),
    "",
    "ERROS",
    ...(validation.errors.map((error) => `- ${error}`) || ["- Nenhum"]),
    "",
    "ESCOPO PENDENTE",
    "ABLine, ABCurve, OperationalBoundary, Flags, MasterData GS3, setup.fds, global.ver, host e demais arquivos específicos do pacote GS3 ainda não foram gerados sem os ZIPs reais de referência estrutural.",
  ].join("\n");

  output.file("RELATORIO_CONVERSAO.txt", report);
  return {
    blob: await output.generateAsync({ type: "blob" }),
    converted: converted.length,
    failures: validation.errors,
    validation,
  };
}
