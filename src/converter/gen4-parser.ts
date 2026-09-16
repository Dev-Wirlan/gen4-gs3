import JSZip from "jszip";
import { normalizeGuid, parseMasterData } from "./master-data-parser";
import { createSpatialElement } from "./spatial-data-parser";
import type { ProjectAnalysis } from "./types";

export async function analyzeGen4Project(file: File): Promise<{ analysis: ProjectAnalysis; zip: JSZip }> {
  if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Selecione um arquivo .zip.");
  const zip = await JSZip.loadAsync(file);
  const paths = Object.keys(zip.files).filter((path) => !zip.files[path]?.dir);
  const masterPath = paths.find((path) => /(^|\/)masterdata\.xml$/i.test(path));
  const masterText = masterPath ? await zip.file(masterPath)?.async("text") : undefined;
  const warnings: string[] = [];
  let clients = [] as ProjectAnalysis["clients"];
  let masterSpatial = [] as ReturnType<typeof parseMasterData>["spatial"];
  if (masterText) {
    try { const parsed = parseMasterData(masterText); clients = parsed.clients; masterSpatial = parsed.spatial; } catch (error) { warnings.push(error instanceof Error ? error.message : "Falha ao ler MasterData.xml."); }
  } else warnings.push("MasterData.xml não encontrado.");

  const gjsonPaths = paths.filter((entry) => entry.toLowerCase().endsWith(".gjson"));
  const spatial = masterSpatial.map((record) => {
    const normalizedReference = record.path?.replace(/\\/g, "/").toLowerCase();
    const path = gjsonPaths.find((entry) => entry.toLowerCase() === normalizedReference || entry.toLowerCase().endsWith(`/${normalizedReference}`) || entry.toLowerCase().includes(record.guid)) ?? "";
    return createSpatialElement(path, "", record.fieldId, record.guid, record.name, record.type);
  });
  const referencedPaths = new Set(spatial.map((item) => item.path).filter(Boolean));
  for (const path of gjsonPaths.filter((entry) => !referencedPaths.has(entry))) {
    const content = (await zip.file(path)?.async("text")) ?? "";
    const pathGuid = normalizeGuid(path.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0]);
    const record = pathGuid ? masterSpatial.find((item) => item.guid === pathGuid) : undefined;
    spatial.push(createSpatialElement(path, content, record?.fieldId, record?.guid, record?.name, record?.type));
  }
  const fields = clients.flatMap((client) => client.farms.flatMap((farm) => farm.fields));
  for (const item of spatial) {
    const field = fields.find((entry) => entry.id === item.fieldId);
    if (field) {
      field.spatial.push(item);
      if (item.type === "AdaptiveCurve") field.adaptiveCurves.push(item);
      if (item.type === "ABLine") field.abLines.push(item);
      if (item.type === "Boundary") field.boundaries.push(item);
      if (item.type === "Flags") field.flags.push(item);
    }
  }
  const fieldIds = new Set(fields.map((field) => field.id));
  const unassigned = spatial.filter((item) => !item.fieldId || !fieldIds.has(item.fieldId));
  if (unassigned.length) warnings.push(`${unassigned.length} arquivo(s) espacial(is) sem vínculo confirmado no MasterData.xml.`);
  return {
    zip,
    analysis: { fileName: file.name, fileSize: file.size, zipStatus: "valid", masterDataFound: Boolean(masterPath), gjsonCount: spatial.length, clients, unassigned, spatial, warnings },
  };
}