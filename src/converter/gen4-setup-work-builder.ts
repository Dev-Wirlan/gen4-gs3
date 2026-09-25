import JSZip from "jszip";
import type { ProjectAnalysis } from "./types";

export interface Gen4SetupWorkBuildResult {
  zip: JSZip;
  masterDataPath: string;
  removedWorkDescriptors: number;
  warnings: string[];
}

function findMasterDataPath(source: JSZip): string | undefined {
  return Object.keys(source.files).find((path) => /(^|\/)masterdata\.xml$/i.test(path));
}

function xmlLocalName(name: string): string {
  const separator = name.lastIndexOf(":");
  return (separator >= 0 ? name.slice(separator + 1) : name).toLowerCase();
}

function findTagEnd(xml: string, start: number): number {
  let quote: '"' | "'" | undefined;

  for (let index = start; index < xml.length; index += 1) {
    const character = xml[index];

    if (quote) {
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }

  throw new Error("MasterData.xml contém XML inválido.");
}

function findDeclarationEnd(xml: string, start: number): number {
  let quote: '"' | "'" | undefined;
  let subsetDepth = 0;

  for (let index = start; index < xml.length; index += 1) {
    const character = xml[index];

    if (quote) {
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "[") {
      subsetDepth += 1;
    } else if (character === "]" && subsetDepth > 0) {
      subsetDepth -= 1;
    } else if (character === ">" && subsetDepth === 0) {
      return index;
    }
  }

  throw new Error("MasterData.xml contém XML inválido.");
}

function readElementName(tag: string, closing: boolean): string {
  let index = closing ? 1 : 0;

  while (/\s/.test(tag[index] ?? "")) {
    index += 1;
  }

  const start = index;

  while (index < tag.length && !/[\s/>]/.test(tag[index])) {
    index += 1;
  }

  if (start === index) {
    throw new Error("MasterData.xml contém XML inválido.");
  }

  return tag.slice(start, index);
}

/**
 * Removes WorkDescriptor elements without relying on browser-only DOM APIs.
 *
 * This is a small XML-aware scanner rather than a regular-expression
 * replacement: comments, CDATA, processing instructions, quoted attributes,
 * namespaces, nested elements, and tag balancing are handled explicitly.
 * The original XML text is preserved byte-for-byte outside removed ranges.
 */
function removeWorkDescriptors(xml: string): { xml: string; removed: number } {
  const stack: Array<{ name: string; start: number; remove: boolean }> = [];
  const removals: Array<{ start: number; end: number }> = [];
  let removed = 0;
  let index = 0;

  while (index < xml.length) {
    const open = xml.indexOf("<", index);

    if (open < 0) {
      break;
    }

    if (xml.startsWith("<!--", open)) {
      const end = xml.indexOf("-->", open + 4);
      if (end < 0) {
        throw new Error("MasterData.xml contém XML inválido.");
      }
      index = end + 3;
      continue;
    }

    if (xml.startsWith("<![CDATA[", open)) {
      const end = xml.indexOf("]]>", open + 9);
      if (end < 0) {
        throw new Error("MasterData.xml contém XML inválido.");
      }
      index = end + 3;
      continue;
    }

    if (xml.startsWith("<?", open)) {
      const end = xml.indexOf("?>", open + 2);
      if (end < 0) {
        throw new Error("MasterData.xml contém XML inválido.");
      }
      index = end + 2;
      continue;
    }

    if (xml.startsWith("<!DOCTYPE", open) || xml.startsWith("<!doctype", open)) {
      const end = findDeclarationEnd(xml, open + 2);
      index = end + 1;
      continue;
    }

    const end = findTagEnd(xml, open + 1);
    const tag = xml.slice(open + 1, end);
    const trimmed = tag.trim();

    if (trimmed.startsWith("!")) {
      index = end + 1;
      continue;
    }

    const closing = trimmed.startsWith("/");
    const selfClosing = !closing && trimmed.endsWith("/");
    const name = xmlLocalName(readElementName(trimmed, closing));

    if (closing) {
      const entry = stack.pop();
      if (!entry || entry.name !== name) {
        throw new Error("MasterData.xml contém XML inválido.");
      }

      if (entry.remove) {
        removals.push({ start: entry.start, end: end + 1 });
        removed += 1;
      }
    } else if (selfClosing) {
      if (name === "workdescriptor") {
        removals.push({ start: open, end: end + 1 });
        removed += 1;
      }
    } else {
      stack.push({
        name,
        start: open,
        remove: name === "workdescriptor",
      });
    }

    index = end + 1;
  }

  if (stack.length > 0) {
    throw new Error("MasterData.xml contém XML inválido.");
  }

  if (removals.length === 0) {
    return { xml, removed: 0 };
  }

  removals.sort((left, right) => left.start - right.start);

  let result = "";
  let cursor = 0;

  for (const removal of removals) {
    if (removal.start < cursor) {
      continue;
    }
    result += xml.slice(cursor, removal.start);
    cursor = removal.end;
  }

  result += xml.slice(cursor);

  return { xml: result, removed };
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
