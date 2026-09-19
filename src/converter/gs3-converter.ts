import JSZip from "jszip";
import { parseAdaptiveCurve } from "./spatial-data-parser";
import type { ProjectAnalysis, SpatialElement } from "./types";

export interface ConversionValidation {
  valid: boolean;
  fieldName: string;
  fieldId: string;
  filesRead: string[];
  filesToConvert: string[];
  ignoredFiles: string[];
  warnings: string[];
  errors: string[];
}

export interface ConvertedAdaptiveCurve {
  item: SpatialElement;
  outputPath: string;
  content: Uint8Array;
}

function fieldFor(analysis: ProjectAnalysis, fieldId: string) {
  return analysis.clients
    .flatMap((client) => client.farms.flatMap((farm) => farm.fields))
    .find((field) => field.id === fieldId);
}

function guidIsValid(value: string | undefined): boolean {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export async function validateAdaptiveCurveConversion(
  source: JSZip,
  analysis: ProjectAnalysis,
  fieldId: string,
): Promise<ConversionValidation> {
  const field = fieldFor(analysis, fieldId);
  if (!field) {
    return {
      valid: false,
      fieldName: "",
      fieldId,
      filesRead: [],
      filesToConvert: [],
      ignoredFiles: [],
      warnings: [],
      errors: ["O talhão selecionado não foi encontrado na análise do projeto."],
    };
  }

  const filesRead: string[] = [];
  const filesToConvert: string[] = [];
  const ignoredFiles: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  if (analysis.zipStatus !== "valid") errors.push("O ZIP de origem não foi validado.");
  if (!analysis.masterDataFound) warnings.push("MasterData.xml não foi encontrado; os vínculos hierárquicos não podem ser confirmados.");
  if (!field.adaptiveCurves.length) errors.push("O talhão selecionado não possui AdaptiveCurve associada.");

  for (const item of field.adaptiveCurves) {
    if (!item.path) {
      errors.push(`${item.name}: arquivo GJSON não localizado.`);
      continue;
    }
    filesRead.push(item.path);
    const entry = source.file(item.path);
    if (!entry) {
      errors.push(`${item.path}: arquivo não existe no ZIP de origem.`);
      continue;
    }
    if (!guidIsValid(item.guid)) {
      errors.push(`${item.path}: GUID ausente ou inválido.`);
      continue;
    }
    try {
      const text = await entry.async("text");
      if (!text.trim()) {
        errors.push(`${item.path}: arquivo vazio.`);
        continue;
      }
      parseAdaptiveCurve(text);
      filesToConvert.push(item.path);
    } catch (error) {
      errors.push(`${item.path}: ${error instanceof Error ? error.message : "GJSON inválido."}`);
    }
  }

  for (const item of field.spatial) {
    if (item.type !== "AdaptiveCurve") ignoredFiles.push(`${item.path || item.name} (${item.type})`);
  }
  if (field.abLines.length) warnings.push(`${field.abLines.length} ABLine(s) foram identificadas, mas permanecem pendentes de mapeamento GS3.`);
  if (field.boundaries.length) warnings.push(`${field.boundaries.length} Boundary/OperationalBoundary foi(ram) identificada(s), mas permanece(m) pendente(s) de mapeamento GS3.`);
  if (field.flags.length) warnings.push(`${field.flags.length} objeto(s) Flags foram identificados, mas permanecem pendentes de mapeamento GS3.`);
  if (analysis.spatial.some((item) => item.type === "ABCurve")) warnings.push("ABCurve foi identificada no projeto, mas permanece pendente de mapeamento GS3.");

  return {
    valid: errors.length === 0 && filesToConvert.length > 0,
    fieldName: field.name,
    fieldId: field.id,
    filesRead,
    filesToConvert,
    ignoredFiles,
    warnings,
    errors,
  };
}

export async function convertValidatedAdaptiveCurves(
  source: JSZip,
  analysis: ProjectAnalysis,
  fieldId: string,
  encode: (geometry: ReturnType<typeof parseAdaptiveCurve>) => Uint8Array,
): Promise<{ validation: ConversionValidation; converted: ConvertedAdaptiveCurve[] }> {
  const validation = await validateAdaptiveCurveConversion(source, analysis, fieldId);
  if (!validation.valid) return { validation, converted: [] };

  const field = fieldFor(analysis, fieldId);
  if (!field) return { validation, converted: [] };
  const converted: ConvertedAdaptiveCurve[] = [];

  for (const item of field.adaptiveCurves) {
    if (!item.path || !validation.filesToConvert.includes(item.path) || !item.guid) continue;
    const text = await source.file(item.path)?.async("text");
    if (!text) continue;
    const geometry = parseAdaptiveCurve(text);
    converted.push({
      item,
      outputPath: `AdaptiveCurve/CurveTrack${item.guid}.fdShape`,
      content: encode(geometry),
    });
  }
  return { validation, converted };
}
