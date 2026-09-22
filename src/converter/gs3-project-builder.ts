import JSZip from "jszip";
import { parseAdaptiveCurve } from "./spatial-data-parser";
import { encodeAdaptiveCurve } from "./fdshape-encoder";
import type { ProjectAnalysis, FieldNode, AdaptiveCurveGeometry } from "./types";

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



const xmlEscape = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const makeUuid = () => crypto.randomUUID();

function uuidToHostBytes(uuid: string): Uint8Array {
  const hex = uuid.replaceAll("-", "");
  const out = new Uint8Array(16);
  const bytes = hex.match(/.{2}/g) ?? [];
  for (let i = 0; i < 16; i++) out[i] = Number.parseInt(bytes[i], 16);
  // host stores the UUID in Windows GUID little-endian field order.
  [out[0], out[3]] = [out[3], out[0]];
  [out[1], out[2]] = [out[2], out[1]];
  [out[4], out[5]] = [out[5], out[4]];
  [out[6], out[7]] = [out[7], out[6]];
  return out;
}

function buildGlobalVer(): Uint8Array {
  const bytes = new Uint8Array(1024);
  bytes.fill(0xff);
  new DataView(bytes.buffer).setUint32(0, 7, true);
  return bytes;
}

const makeXml = (text: string) => new TextEncoder().encode(text);

function buildSetupFds(field: FieldNode, farmId: string, farmName: string, clientId: string, clientName: string, node = makeUuid()): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="utf-8"?>
<SetupFile xmlns:spatial="urn:schemas-johndeere-com:SpatialTypes" xmlns:unit="urn:schemas-johndeere-com:UnitSystem" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:rep="urn:schemas-johndeere-com:Representation" xmlns:bt="urn:schemas-johndeere-com:BasicTypes" xmlns="urn:schemas-johndeere-com:RCD:Setup">
  <SourceApp major="10" minor="29" build="3422101" revision="0" nameSourceApp="GEN4OS" uuidSourceApp="{${makeUuid()}}" uuidSourceAppNode="{${node}}" uuidSession="{${makeUuid()}}" />
  <Setup>
    <FileSchemaVersion nonProductionCode="0">
      <bt:FileSchemaContentVersion major="3" minor="28" />
      <bt:UnitOfMeasureVersion major="1" minor="43" />
      <bt:RepresentationSystemVersion major="4" minor="161" />
    </FileSchemaVersion>
    <bt:Synchronization><bt:NodeVersions><bt:Node uuid="{${node}}" lastSeen="${now}" /></bt:NodeVersions><bt:EntityDeletions /></bt:Synchronization>
    <Participant>
      <Client lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(clientId)}}" name="${xmlEscape(clientName)}" />
    </Participant>
    <Farm lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(farmId)}}" name="${xmlEscape(farmName)}" clientRef="{${xmlEscape(clientId)}}" />
    <Field lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(field.id)}}" name="${xmlEscape(field.name)}" farmRef="{${xmlEscape(farmId)}}">
      <Area value="0" sourceUOM="ac" variableRepresentation="vrReportedFieldArea" />
    </Field>
    <Products />
  </Setup>
</SetupFile>`;
}

function curveMbr(geometry: AdaptiveCurveGeometry) {
  const points = geometry.lines.flat();
  return {
    north: Math.max(...points.map((p) => p[1])),
    south: Math.min(...points.map((p) => p[1])),
    east: Math.max(...points.map((p) => p[0])),
    west: Math.min(...points.map((p) => p[0])),
  };
}

function buildSpatialCatalog(field: FieldNode, clientId: string, clientName: string, farmId: string, farmName: string, curves: Array<{ guid: string; name: string; geometry: AdaptiveCurveGeometry }>): string {
  const node = makeUuid();
  const now = new Date().toISOString();
  const items = curves.map(({ guid, name, geometry }) => {
    const mbr = curveMbr(geometry);
    return `    <CurvedTrackLine lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(guid)}}" spatialGeometryType="point" fileName="CurveTrack${xmlEscape(guid)}" name="${xmlEscape(name)}">
      <spatial:MBR uomSource="arcdeg" uomTarget="arcdeg" north="${mbr.north}" south="${mbr.south}" east="${mbr.east}" west="${mbr.west}" />
      <rcdscbase:vrEastShiftComponent value="0" sourceUOM="mm" variableRepresentation="vrEastShiftComponent" />
      <rcdscbase:vrNorthShiftComponent value="0" sourceUOM="mm" variableRepresentation="vrNorthShiftComponent" />
      <rcdscbase:vrReferenceLatitude value="${geometry.referenceLatitude}" sourceUOM="arcdeg" variableRepresentation="vrLatitude" />
      <rcdscbase:vrReferenceLongitude value="${geometry.referenceLongitude}" sourceUOM="arcdeg" variableRepresentation="vrLongitude" />
    </CurvedTrackLine>`;
  }).join("\\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<rcdscfldie:SpatialCatalog xmlns:rcdsetup="urn:schemas-johndeere-com:RCD:Setup" xmlns:bt="urn:schemas-johndeere-com:BasicTypes" xmlns:rcdscbase="urn:schemas-johndeere-com:RCD:SpatialCatalog:Base" xmlns:unit="urn:schemas-johndeere-com:UnitSystem" xmlns:rep="urn:schemas-johndeere-com:Representation" xmlns:spatial="urn:schemas-johndeere-com:SpatialTypes" xmlns:rcdscfldie="urn:schemas-johndeere-com:RCD:SpatialCatalog:FieldImportExport">
  <FileSchemaVersion nonProductionCode="0">
    <bt:FileSchemaContentVersion major="1" minor="11" />
    <bt:UnitOfMeasureVersion major="1" minor="43" />
    <bt:RepresentationSystemVersion major="4" minor="161" />
  </FileSchemaVersion>
  <SourceApp major="2" minor="0" build="0" revision="135" nameSourceApp="RCD Target Provider" uuidSourceApp="{b050528e-f328-4dd8-9e9c-71fe8153692e}" uuidSourceAppNode="{${node}}" uuidSession="{${makeUuid()}}" />
  <Setup>
    <rcdsetup:FileSchemaVersion nonProductionCode="0"><bt:FileSchemaContentVersion major="3" minor="28" /><bt:UnitOfMeasureVersion major="1" minor="43" /><bt:RepresentationSystemVersion major="4" minor="161" /></rcdsetup:FileSchemaVersion>
    <bt:Synchronization><bt:NodeVersions><bt:Node uuid="{${node}}" lastSeen="${now}" /></bt:NodeVersions><bt:EntityDeletions /></bt:Synchronization>
    <rcdsetup:Participant><rcdsetup:Client lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(clientId)}}" name="${xmlEscape(clientName)}" /></rcdsetup:Participant>
    <rcdsetup:Farm lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(farmId)}}" name="${xmlEscape(farmName)}" clientRef="{${xmlEscape(clientId)}}" />
    <rcdsetup:Field lastModified="${now}" sourceNode="{00000000-0000-0000-0000-000000000000}" erid="{${xmlEscape(field.id)}}" name="${xmlEscape(field.name)}" farmRef="{${xmlEscape(farmId)}}" />
    <rcdsetup:Products />
  </Setup>
  <SpatialItems eridFieldRef="{${xmlEscape(field.id)}}">
${items}
  </SpatialItems>
</rcdscfldie:SpatialCatalog>`;
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
    errors.push("Talhão possui AdaptiveCurves identificadas, mas a conversão não gerou saída ou faltam dados.");
  } else {
    status.CurveTrack = "OK";
  }

  if (field?.abLines.length === 0) status.ABLine = "OK";
  if (field?.boundaries.length === 0) {
    status.Boundary = "OK";
  } else if (files.some((f) => f.type === "Boundary" && f.status === "OK")) {
    status.Boundary = "OK";
  } else {
    status.Boundary = "PENDENTE";
    warnings.push("Boundary permanece isolado como etapa pendente: a engenharia reversa confirmou a estrutura do fdShape e a origem dos pontos, mas ainda não confirmou a regra Gen4 → Boundary.fdShape (ordenação, ParentBoundary/Headland e 181 ocorrências adicionais). O conversor não inventará essa regra.");
  }
  if (field?.flags.length === 0) status.Flags = "OK";

  if (files.some((f) => f.type === "SpatialCatalog" && f.status === "OK")) status.SpatialCatalog = "OK";
  if (files.some((f) => f.type === "setup.fds" && f.status === "OK")) status["setup.fds"] = "OK";
  if (files.some((f) => f.type === "global.ver" && f.status === "OK")) status["global.ver"] = "OK";
  if (files.some((f) => f.type === "host" && f.status === "OK")) status.host = "OK";
  warnings.push("global.ver e host seguem o formato binário observado no GS3 de referência 600057; a semântica desses bytes ainda não foi totalmente determinada.");

  const missingMandatory = status["global.ver"] === "PENDENTE" || status.host === "PENDENTE";
  const valid = errors.length === 0 && !missingMandatory;

  return { status, valid, errors, warnings };
}

export async function buildGs3Project(source: JSZip, analysis: ProjectAnalysis, fieldId: string): Promise<Gs3Project> {
  const field = getFieldFor(analysis, fieldId);
  const files: Gs3File[] = [];
  const folders: string[] = [];

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

  const client = analysis.clients.find((item) => item.farms.some((farm) => farm.fields.some((candidate) => candidate.id === field.id)));
  const farm = client?.farms.find((item) => item.fields.some((candidate) => candidate.id === field.id));
  const clientId = client?.id ?? "00000000-0000-0000-0000-000000000000";
  const clientName = client?.name ?? "";
  const farmId = farm?.id ?? "00000000-0000-0000-0000-000000000000";
  const farmName = farm?.name ?? "";
  const base = `GS3_2630/JD4600/RCD/EIC/Fields/31/${field.id}`;
  const curves: Array<{ guid: string; name: string; geometry: AdaptiveCurveGeometry }> = [];

  for (const curve of field.adaptiveCurves) {
    if (!curve.path || !curve.guid) continue;
    try {
      const text = await source.file(curve.path)?.async("text");
      if (!text) continue;
      const geom = parseAdaptiveCurve(text);
      curves.push({ guid: curve.guid, name: curve.name, geometry: geom });
      files.push({
        path: `${base}/CurveTrack${curve.guid}.fdShape`,
        content: encodeAdaptiveCurve(geom),
        type: "CurveTrack",
        status: "OK",
        gen4Path: curve.path
      });
    } catch (e) {
      files.push({
        path: `${base}/CurveTrack${curve.guid}.fdShape`,
        content: null,
        type: "CurveTrack",
        status: "ERRO",
        gen4Path: curve.path
      });
    }
  }

  const node = makeUuid();
  files.push({ path: "GS3_2630/JD4600/RCD/EIC/setup.fds", content: makeXml(buildSetupFds(field, farmId, farmName, clientId, clientName, node)), type: "setup.fds", status: "OK" });
  files.push({ path: "GS3_2630/JD4600/RCD/EIC/host", content: uuidToHostBytes(node), type: "host", status: "OK" });
  files.push({ path: "GS3_2630/JD4600/RCD/EIC/global.ver", content: buildGlobalVer(), type: "global.ver", status: "OK" });
  files.push({ path: `${base}/ImportExport.SpatialCatalog`, content: makeXml(buildSpatialCatalog(field, clientId, clientName, farmId, farmName, curves)), type: "SpatialCatalog", status: "OK" });

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
