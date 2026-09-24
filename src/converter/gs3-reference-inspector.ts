import JSZip from "jszip";

export interface ReferenceGuidOccurrence {
  value: string;
  offset?: number;
}

export interface ReferenceStringOccurrence {
  value: string;
  offset: number;
}

export interface ReferenceXmlTag {
  name: string;
  attributes: Record<string, string>;
  offset?: number;
}

export interface ReferenceFileInspection {
  path: string;
  name: string;
  extension: string;
  size: number;
  probableType: string;
  isText: boolean;
  isBinary: boolean;
  isXml: boolean;
  text?: string;
  hexPreview?: string;
  strings: ReferenceStringOccurrence[];
  guids: ReferenceGuidOccurrence[];
  references: string[];
  fieldReferences: string[];
  curveTrackReferences: string[];
  xmlTags: ReferenceXmlTag[];
  relationships: string[];
}

export interface Gs3ReferenceInspectionResult {
  fileName: string;
  files: ReferenceFileInspection[];
  report: string;
}

const GUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const TEXT_EXTENSIONS = new Set([
  ".xml",
  ".gjson",
  ".json",
  ".txt",
  ".ver",
  ".fds",
  ".fddata",
  ".fdshape",
  ".ini",
  ".cfg",
  ".csv",
  ".eic",
  ".rcd",
]);
const FILE_REFERENCE_PATTERN = /(?:[A-Za-z0-9_.-]+[\\/])+(?:[A-Za-z0-9_.-]+)|[A-Za-z0-9_.-]+\.(?:fds|ver|fdshape|fddata|xml|gjson|eic|rcd)/gi;
const FIELD_PATTERN = /(?:field|talh[aã]o)[^\s"'<>;,)]{0,180}/gi;
const CURVE_TRACK_PATTERN = /(?:curvetrack|curve.?track)[^\s"'<>;,)]{0,180}/gi;

const unique = (values: string[]) => [...new Set(values)];
const normalize = (value: string) => value.replace(/\\/g, "/");
const extensionOf = (path: string) => {
  const name = path.split("/").pop() ?? path;
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "[sem extensão]";
};
const nameOf = (path: string) => path.split("/").pop() ?? path;
const printable = (value: number) => value >= 32 && value <= 126;

function probableType(path: string, isXml: boolean, isText: boolean): string {
  const lower = path.toLowerCase();
  if (lower.endsWith("setup.fds")) return "setup.fds";
  if (nameOf(lower) === "global.ver") return "global.ver";
  if (nameOf(lower) === "host") return "host";
  if (lower.includes("spatialcatalog")) return "SpatialCatalog";
  if (/curvetrack/i.test(lower)) return "CurveTrack";
  if (/boundary/i.test(lower)) return "Boundary";
  if (/\.(rcd|eic)$/i.test(lower)) return "RCD/EIC";
  if (isXml) return "XML estruturado";
  if (isText) return "Texto";
  return "Binário não determinado";
}

function findAsciiStrings(bytes: Uint8Array): ReferenceStringOccurrence[] {
  const result: ReferenceStringOccurrence[] = [];
  let start = -1;
  for (let index = 0; index <= bytes.length; index += 1) {
    const isPrintable = index < bytes.length && (printable(bytes[index]) || bytes[index] === 9);
    if (isPrintable && start < 0) start = index;
    if (!isPrintable && start >= 0) {
      if (index - start >= 4) {
        result.push({ value: new TextDecoder().decode(bytes.slice(start, index)), offset: start });
      }
      start = -1;
    }
  }
  return result.slice(0, 300);
}

function findGuids(value: string, bytes?: Uint8Array): ReferenceGuidOccurrence[] {
  const result: ReferenceGuidOccurrence[] = [];
  for (const match of value.matchAll(GUID_PATTERN)) {
    result.push({ value: match[0].toLowerCase(), offset: match.index });
  }
  if (bytes) {
    const ascii = new TextDecoder().decode(bytes);
    for (const match of ascii.matchAll(GUID_PATTERN)) {
      const occurrence = { value: match[0].toLowerCase(), offset: match.index };
      if (!result.some((item) => item.value === occurrence.value && item.offset === occurrence.offset)) result.push(occurrence);
    }
  }
  return result;
}

function hexPreview(bytes: Uint8Array): string {
  return [...bytes.slice(0, 128)].map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function extractXmlTags(text: string): ReferenceXmlTag[] {
  const result: ReferenceXmlTag[] = [];
  const pattern = /<([A-Za-z_][\w:.-]*)(\s[^<>]*?)?\s*\/?>/g;
  for (const match of text.matchAll(pattern)) {
    const attributes: Record<string, string> = {};
    const rawAttributes = match[2] ?? "";
    const attributePattern = /([A-Za-z_][\w:.-]*)\s*=\s*["']([^"']*)["']/g;
    for (const attribute of rawAttributes.matchAll(attributePattern)) attributes[attribute[1]] = attribute[2];
    result.push({ name: match[1], attributes, offset: match.index });
  }
  return result.slice(0, 1000);
}

function likelyText(path: string, bytes: Uint8Array): boolean {
  if (TEXT_EXTENSIONS.has(extensionOf(path))) return true;
  const sample = bytes.slice(0, Math.min(bytes.length, 1024));
  if (sample.some((byte) => byte === 0)) return false;
  const controls = [...sample].filter((byte) => byte < 9 || (byte > 13 && byte < 32)).length;
  return controls < Math.max(2, sample.length * 0.02);
}

function extractReferences(path: string, text: string, strings: ReferenceStringOccurrence[]): string[] {
  const values = [...text.matchAll(FILE_REFERENCE_PATTERN)].map((match) => match[0]);
  const fromStrings = strings.flatMap((item) => [...item.value.matchAll(FILE_REFERENCE_PATTERN)].map((match) => match[0]));
  return unique([...values, ...fromStrings].map(normalize).filter((value) => value.toLowerCase() !== path.toLowerCase())).slice(0, 300);
}

function extractRelationships(text: string, tags: ReferenceXmlTag[], guids: ReferenceGuidOccurrence[]): string[] {
  const relationships: string[] = [];
  for (const tag of tags) {
    const attributes = Object.entries(tag.attributes).filter(([key]) => /id|guid|ref|parent|field|object|track/i.test(key));
    if (attributes.length) relationships.push(`<${tag.name}> ${attributes.map(([key, value]) => `${key}=${value}`).join(", ")}`);
  }
  if (guids.length > 1) relationships.push(`${guids.length} GUIDs reconhecíveis no conteúdo podem representar relações entre objetos`);
  return unique(relationships).slice(0, 300);
}

async function inspectEntry(entry: JSZip.JSZipObject): Promise<ReferenceFileInspection> {
  const path = normalize(entry.name);
  const name = nameOf(path);
  const bytes = await entry.async("uint8array");
  const isText = likelyText(path, bytes);
  const asciiStrings = findAsciiStrings(bytes);
  let text: string | undefined;
  if (isText) {
    try {
      text = await entry.async("text");
    } catch {
      text = undefined;
    }
  }
  const value = text ?? new TextDecoder().decode(bytes);
  const xmlTags = /<[^>]+>/.test(value.slice(0, 5000)) ? extractXmlTags(value) : [];
  const isXml = extensionOf(path) === ".xml" || xmlTags.length > 0;
  const guids = findGuids(value, isText ? undefined : bytes);
  const strings = isText ? asciiStrings.filter((item) => item.value.trim().length > 0) : asciiStrings;
  const references = extractReferences(path, value, strings);
  const fieldReferences = unique([...(value.match(FIELD_PATTERN) ?? []), ...references.filter((item) => /field|talh[aã]o/i.test(item))]).slice(0, 100);
  const curveTrackReferences = unique([...(value.match(CURVE_TRACK_PATTERN) ?? []), ...references.filter((item) => /curvetrack|curve.?track/i.test(item))]).slice(0, 100);
  return {
    path,
    name,
    extension: extensionOf(path),
    size: bytes.length,
    probableType: probableType(path, isXml, isText),
    isText,
    isBinary: !isText,
    isXml,
    ...(text !== undefined ? { text } : {}),
    ...(isText ? {} : { hexPreview: hexPreview(bytes) }),
    strings,
    guids,
    references,
    fieldReferences,
    curveTrackReferences,
    xmlTags,
    relationships: extractRelationships(value, xmlTags, guids),
  };
}

const formatBytes = (value: number) => `${value} bytes`;
const list = (values: string[]) => values.length ? values.join(", ") : "nenhum identificado";

function renderFile(file: ReferenceFileInspection): string[] {
  const lines = [
    file.path,
    `  nome: ${file.name}`,
    `  extensão: ${file.extension}`,
    `  tamanho: ${formatBytes(file.size)}`,
    `  tipo provável: ${file.probableType}`,
    `  binário/texto: ${file.isBinary ? "binário" : "texto"}`,
    `  GUIDs: ${list(file.guids.map((guid) => `${guid.value}${guid.offset === undefined ? "" : ` @offset ${guid.offset}`}`))}`,
    `  referências a arquivos: ${list(file.references)}`,
    `  referências ao Field: ${list(file.fieldReferences)}`,
    `  referências às CurveTracks: ${list(file.curveTrackReferences)}`,
    `  relações entre objetos: ${list(file.relationships)}`,
  ];
  if (file.isBinary) {
    lines.push(`  hexadecimal inicial: ${file.hexPreview || "vazio"}`);
    lines.push(`  strings ASCII/UTF-8: ${list(file.strings.map((item) => `${JSON.stringify(item.value)} @offset ${item.offset}`))}`);
  }
  if (file.isXml) {
    lines.push(`  tags: ${list(file.xmlTags.map((tag) => `<${tag.name}>`))}`);
    lines.push(`  atributos: ${list(file.xmlTags.flatMap((tag) => Object.entries(tag.attributes).map(([key, value]) => `${key}=${JSON.stringify(value)}`)))}`);
    lines.push("  conteúdo:");
    lines.push(...(file.text ?? "").split("\n").map((line) => `    ${line}`));
  } else if (file.isText) {
    lines.push("  conteúdo:");
    lines.push(...(file.text ?? "").split("\n").map((line) => `    ${line}`));
  }
  return lines;
}

function renderReport(fileName: string, files: ReferenceFileInspection[]): string {
  const important = files.filter((file) => /setup\.fds$|global\.ver$|(^|\/)host$|spatialcatalog|curvetrack|boundary|\.(rcd|eic)$/i.test(file.path));
  const textFiles = files.filter((file) => file.isText);
  const binaryFiles = files.filter((file) => file.isBinary);
  const confirmed = [
    `A existência e o caminho foram confirmados para ${files.length} arquivo(s) do ZIP real.`,
    `${textFiles.length} arquivo(s) foram lidos como texto e ${binaryFiles.length} como binário.`,
    important.length ? `${important.length} arquivo(s) estruturalmente relevante(s) foram encontrados pelo nome ou caminho real.` : "Nenhum arquivo com nome estrutural conhecido foi encontrado.",
  ];
  const formats = unique(files.filter((file) => file.isXml || file.isText).map((file) => file.extension));
  const partial = unique(files.filter((file) => file.isBinary || file.references.length || file.relationships.length).map((file) => file.probableType));
  const unknown = files.filter((file) => file.probableType === "Binário não determinado" || (!file.isXml && file.extension === "[sem extensão]")).map((file) => file.path);
  return [
    "GS3 REFERENCE STRUCTURE",
    "",
    `ZIP: ${fileName}`,
    `Gerado em: ${new Date().toISOString()}`,
    "",
    "ARQUIVOS ENCONTRADOS",
    `Total: ${files.length}`,
    ...files.flatMap((file) => ["", ...renderFile(file)]),
    "",
    "ARQUIVOS IMPORTANTES ENCONTRADOS",
    ...(important.length ? important.map((file) => `- ${file.path} | ${file.probableType} | ${formatBytes(file.size)}`) : ["- Nenhum encontrado pelo nome/caminho real"]),
    "",
    "TRANSFORMAÇÕES IDENTIFICADAS",
    "Este relatório inspeciona somente o ZIP GS3 de referência. Não afirma transformações Gen4 → GS3 sem um ZIP Gen4 comparável.",
    "",
    "✓ ESTRUTURA CONFIRMADA",
    ...confirmed.map((item) => `- ${item}`),
    "",
    "✓ FORMATOS CONFIRMADOS",
    `- Extensões/textos reconhecidos: ${list(formats)}`,
    "",
    "⚠ FORMATOS PARCIALMENTE COMPREENDIDOS",
    `- ${list(partial)}`,
    "",
    "❌ FORMATOS AINDA DESCONHECIDOS",
    `- ${list(unknown)}`,
    "",
    "FIM DO RELATÓRIO",
  ].join("\n");
}

export async function inspectGs3Reference(file: File): Promise<Gs3ReferenceInspectionResult> {
  if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Selecione um arquivo ZIP GS3 exportado pelo GS5.");
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const files = (await Promise.all(entries.map(inspectEntry))).sort((left, right) => left.path.localeCompare(right.path));
  return { fileName: file.name, files, report: renderReport(file.name, files) };
}
