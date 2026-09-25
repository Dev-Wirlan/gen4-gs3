import JSZip from "jszip";
import type { ProjectAnalysis } from "./types";

export interface Gen4SetupWorkBuildResult {
  zip: JSZip;
  masterDataPath: string;
  removedWorkDescriptors: number;
  warnings: string[];
}

const localName = (element: Element) => element.localName.toLowerCase();

function findMasterDataPath(source: JSZip): string | undefined {
  return Object.keys(source.files).find((path) => /(^|\/)masterdata\.xml$/i.test(path));
}

function removeWorkDescriptors(xml: string): { xml: string; removed: number } {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) {
    throw new Error("MasterData.xml contém XML inválido.");
  }

  const workDescriptors = Array.from(document.querySelectorAll("*")).filter(
    (element) => localName(element) === "workdescriptor",
  );

  for (const element of workDescriptors) {
    element.remove();
  }

  return {
    xml: new XMLSerializer().serializeToString(document),
    removed: workDescriptors.length,
  };
}

/**
 * Builds the minimum evidence-based Gen4 Setup Work representation.
 *
 * Current confirmed transformation:
 * - preserve the input ZIP and its existing Client/Farm/Field hierarchy;
 * - preserve existing GUIDs and spatial files;
 * - omit WorkDescriptor elements, because they are absent from the observed
 *   Setup Work reference;
 * - do not invent Operators, AB entities, Flags, RTKBaseStations,
 *   OperationalBoundary, additional AdaptiveCurves, or version values.
 *
 * The input JSZip instance is never mutated.
 */
export async function buildGen4SetupWorkProject(
  source: JSZip,
  _analysis: ProjectAnalysis,
): Promise<Gen4SetupWorkBuildResult> {
  const output = source.clone();
  const masterDataPath = findMasterDataPath(output);

  if (!masterDataPath) {
    throw new Error("MasterData.xml não encontrado no projeto Gen4.");
  }

  const masterDataFile = output.file(masterDataPath);
  if (!masterDataFile) {
    throw new Error("MasterData.xml não pôde ser lido do projeto Gen4.");
  }

  const masterDataXml = await masterDataFile.async("text");
  const transformed = removeWorkDescriptors(masterDataXml);
  output.file(masterDataPath, transformed.xml);

  return {
    zip: output,
    masterDataPath,
    removedWorkDescriptors: transformed.removed,
    warnings: [
      "A transformação mínima preserva entidades e SpatialFiles de entrada.",
      "Entidades adicionais observadas somente no Golden Setup Work não são inventadas.",
      "Os valores de versionamento do Golden não são aplicados porque a regra universal ainda é desconhecida.",
    ],
  };
}
