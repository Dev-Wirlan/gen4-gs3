import JSZip from "jszip";
import { parseAdaptiveCurve } from "./spatial-data-parser";
import { encodeAdaptiveCurve } from "./fdshape-encoder";
import type { ProjectAnalysis, FieldNode } from "./types";

export type Gs3FileType = "CurveTrack" | "SpatialCatalog" | "setup.fds" | "global.ver" | "host" | "ABLine" | "Boundary" | "Flags";
export type Gs3Status = "OK" | "PENDENTE" | "ERRO";

export interface Gs3File {
  path: string;
  content: Uint8Array | null;
  type: Gs3FileType;
  status: Gs3Status;
  gen4Path?: string;
}

export interface Gs3StructureStatus {
  AdaptiveCurve: Gs3Status;
  CurveTrack: Gs3Status;
  ABLine: Gs3Status;
  Boundary: Gs3Status;
  Flags: Gs3Status;
  SpatialCatalog: Gs3Status;
  "setup.fds": Gs3Status;
  "global.ver": Gs3Status;
  host: Gs3Status;
}

export interface Gs3Project {
  folders: string[];
  files: Gs3File[];
  structureStatus: Gs3StructureStatus;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function getFieldFor(analysis: ProjectAnalysis, fieldId: string): FieldNode | undefined {
  return analysis.clients
    .flatMap((c) => c.farms.flatMap((f) => f.fields))
    .find((f) => f.id === fieldId);
}

export function validateGs3Project(files: Gs3File[], field: FieldNode | undefined): { status: Gs3StructureStatus; valid: boolean; errors: string[]; warnings: string[] } {
  const status: Gs3StructureStatus = {
    AdaptiveCurve: field?.adaptiveCurves.length ? "OK" : "PENDENTE",
    CurveTrack: "PENDENTE",
    ABLine: "PENDENTE",
    Boundary: "PENDENTE",
    Flags: "PENDENTE",
    SpatialCatalog: "PENDENTE",
    "setup.fds": "PENDENTE",
    "global.ver": "PENDENTE",
    host: "PENDENTE",
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  const curveTracks = files.filter(f => f.type === "CurveTrack");
  if (curveTracks.length > 0) {
    if (curveTracks.some(f => f.status === "ERRO")) {
      status.CurveTrack = "ERRO";
      errors.push("Ocorreram erros durante a codificação das CurveTracks");
    } else {
      status.CurveTrack = "OK";
    }
  } else if (field?.adaptiveCurves.length) {
    status.CurveTrack = "ERRO";
    errors.push("Talhão possui AdaptiveCurves identificadas, mas o mapeamento com os bytes CurveTrack falhou ou faltam dados.");
  } else {
    status.CurveTrack = "OK";
  }

  if (field?.abLines.length === 0) status.ABLine = "OK";
  if (field?.boundaries.length === 0) status.Boundary = "OK";
  if (field?.flags.length === 0) status.Flags = "OK";

  warnings.push("Os arquivos centrais (SpatialCatalog, setup.fds, global.ver, host) foram listados pelo builder, mas permanecem como PENDENTE pois seu formato exato ainda está em estudo.");

  const missingMandatory = status.SpatialCatalog === "PENDENTE" || status["setup.fds"] === "PENDENTE" || status["global.ver"] === "PENDENTE" || status.host === "PENDENTE";
  const valid = errors.length === 0 && !missingMandatory;

  return { status, valid, errors, warnings };
}

export async function buildGs3Project(source: JSZip, analysis: ProjectAnalysis, fieldId: string): Promise<Gs3Project> {
  const field = getFieldFor(analysis, fieldId);
  const files: Gs3File[] = [];
  const folders: string[] = [
    "SpatialCatalog",
    "Fields",
    "CurveTracks",
    "Boundaries"
  ];

  if (!field) {
    return {
      folders: [],
      files: [],
      structureStatus: validateGs3Project([], undefined).status,
      valid: false,
      errors: ["O talhão selecionado não foi encontrado."],
      warnings: []
    };
  }

  for (const curve of field.adaptiveCurves) {
    if (!curve.path || !curve.guid) continue;
    try {
      const text = await source.file(curve.path)?.async("text");
      if (!text) continue;
      const geom = parseAdaptiveCurve(text);
      files.push({
        path: `CurveTracks/CurveTrack${curve.guid}.fdShape`,
        content: encodeAdaptiveCurve(geom),
        type: "CurveTrack",
        status: "OK",
        gen4Path: curve.path
      });
    } catch (e) {
      files.push({
        path: `CurveTracks/CurveTrack${curve.guid}.fdShape`,
        content: null,
        type: "CurveTrack",
        status: "ERRO",
        gen4Path: curve.path
      });
    }
  }

  files.push({ path: "SpatialCatalog/spatial_catalog_PENDING", content: null, type: "SpatialCatalog", status: "PENDENTE" });
  files.push({ path: "setup.fds", content: null, type: "setup.fds", status: "PENDENTE" });
  files.push({ path: "global.ver", content: null, type: "global.ver", status: "PENDENTE" });
  files.push({ path: "host", content: null, type: "host", status: "PENDENTE" });

  if (field.abLines.length > 0) files.push({ path: "ABLines_PENDING", content: null, type: "ABLine", status: "PENDENTE" });
  if (field.boundaries.length > 0) files.push({ path: "Boundaries_PENDING", content: null, type: "Boundary", status: "PENDENTE" });
  if (field.flags.length > 0) files.push({ path: "Flags_PENDING", content: null, type: "Flags", status: "PENDENTE" });

  const validation = validateGs3Project(files, field);

  return {
    folders,
    files,
    structureStatus: validation.status,
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings
  };
}
