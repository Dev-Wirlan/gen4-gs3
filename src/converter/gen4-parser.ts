import JSZip from "jszip";
import { findReferencedFieldId, parseMasterData } from "./master-data-parser";
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
  if (masterText) {
    try { clients = parseMasterData(masterText); } catch (error) { warnings.push(error instanceof Error ? error.message : "Falha ao ler MasterData.xml."); }
  } else warnings.push("MasterData.xml não encontrado.");

  const spatial = [] as ProjectAnalysis["spatial"];
  for (const path of paths.filter((entry) => entry.toLowerCase().endsWith(".gjson"))) {
    const content = (await zip.file(path)?.async("text")) ?? "";
    const fieldId = masterText ? findReferencedFieldId(masterText, path, clients) : undefined;
    spatial.push(createSpatialElement(path, content, fieldId));
  }
  const fields = clients.flatMap((client) => client.farms.flatMap((farm) => farm.fields));
  for (const item of spatial) {
    const field = fields.find((entry) => entry.id === item.fieldId);
    if (field) field.spatial.push(item);
  }
  const unassigned = spatial.filter((item) => !item.fieldId);
  if (unassigned.length) warnings.push(`${unassigned.length} arquivo(s) espacial(is) sem vínculo confirmado no MasterData.xml.`);
  return {
    zip,
    analysis: { fileName: file.name, fileSize: file.size, zipStatus: "valid", masterDataFound: Boolean(masterPath), gjsonCount: spatial.length, clients, unassigned, spatial, warnings },
  };
}