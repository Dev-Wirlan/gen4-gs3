import JSZip from "jszip";
import { buildGs3Project } from "./gs3-project-builder";
import type { ProjectAnalysis } from "./types";

export async function exportValidatedAdaptiveCurves(source: JSZip, analysis: ProjectAnalysis, fieldId: string) {
  const output = new JSZip();
  const project = await buildGs3Project(source, analysis);

  for (const folder of project.folders) {
    output.folder(folder);
  }

  for (const item of project.files) {
    if (item.content && item.status === "OK") {
      output.file(item.path, item.content);
    }
  }

  const getCheck = (status: string) => status === "OK" ? "✓ " : status === "ERRO" ? "✗ " : "○ ";

  const report = [
    "RELATÓRIO DE CONSTRUÇÃO DO PROJETO GS3",
    "",
    `Status da Conversão Geral: ${project.valid ? "CONCLUÍDA" : "INCOMPLETA / PENDENTE"}`,
    "OZIP contém as curvas funcionais, mas o projeto estrutural permanecerá inconcluído até que todas as matrizes pendentes sejam resolvidas a partir da exploração dos diretórios reais.",
    "",
    "ESTRUTURA GS3",
    `${getCheck(project.structureStatus.AdaptiveCurve)}AdaptiveCurve (Origem)`,
    `${getCheck(project.structureStatus.CurveTrack)}CurveTrack`,
    `${getCheck(project.structureStatus.ABLine)}ABLine`,
    `${getCheck(project.structureStatus.Boundary)}Boundary`,
    `${getCheck(project.structureStatus.Flags)}Flags`,
    `${getCheck(project.structureStatus.SpatialCatalog)}SpatialCatalog`,
    `${getCheck(project.structureStatus["setup.fds"])}setup.fds`,
    `${getCheck(project.structureStatus["global.ver"])}global.ver`,
    `${getCheck(project.structureStatus.host)}host`,
    "",
    "ARQUIVOS GRAVADOS NO BLOB DO ZIP",
    ...(project.files.filter(f => f.content && f.status === "OK").map((item) => `- ${item.path} ← ${item.gen4Path}`) || ["- Nenhum"]),
    "",
    "AVISOS",
    ...(project.warnings.map(w => `- ${w}`) || ["- Nenhum"]),
    "",
    "ERROS",
    ...(project.errors.map(e => `- ${e}`) || ["- Nenhum"])
  ].join("\n");

  output.file("RELATORIO_CONVERSAO.txt", report);

  return {
    blob: await output.generateAsync({ type: "blob" }),
    converted: project.files.filter(f => f.type === "CurveTrack" && f.status === "OK").length,
    failures: project.errors,
    validation: project // mantido retrocompativel para a view reagir caso preciso
  };
}
