import JSZip from "jszip";

export interface ReferenceStringOccurrence {
  value: string;
  offset: number;
}

export type ReferenceContentKind = "text" | "binary" | "unknown";
export type ReferenceConfidence = "high" | "medium" | "low";

export interface ReferenceFileInspection {
  path: string;
  name: string;
  extension: string;
  size: number;
  contentKind: ReferenceContentKind;
  confidence: ReferenceConfidence;
  extensionSuggestsText: boolean;
  contentAppearsText: boolean;
  isText: boolean;
  isBinary: boolean;
  preview?: string;
  previewBytes: number;
  previewTruncated: boolean;
  hexPreview?: string;
  strings: ReferenceStringOccurrence[];
}

export interface Gs3ReferenceInspectionResult {
  fileName: string;
  paths: string[];
  folders: string[];
  extensions: string[];
  files: ReferenceFileInspection[];
  report: string;
}

const TEXT_PREVIEW_LIMIT = 256 * 1024;
const CONTENT_SAMPLE_LIMIT = 16 * 1024;
const BINARY_PREVIEW_LIMIT = 256;
const TEXT_EXTENSIONS = new Set([
  ".xml",
  ".gjson",
  ".json",
  ".txt",
  ".ver",
  ".fds",
  ".ini",
  ".cfg",
  ".csv",
]);

const unique = (values: string[]) => [...new Set(values)];
const normalize = (value: string) => value.replace(/\\/g, "/");
const extensionOf = (path: string) => {
  const name = path.split("/").pop() ?? path;
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "[sem extensão]";
};
const nameOf = (path: string) => path.split("/").pop() ?? path;
const printable = (value: number) => value >= 32 && value <= 126;

function findAsciiStrings(bytes: Uint8Array): ReferenceStringOccurrence[] {
  const result: ReferenceStringOccurrence[] = [];
  let start = -1;
  for (let index = 0; index <= bytes.length; index += 1) {
    const byte = bytes[index];
    const isPrintable = byte !== undefined && (printable(byte) || byte === 9);
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

function hexPreview(bytes: Uint8Array): string {
  return [...bytes.slice(0, BINARY_PREVIEW_LIMIT)].map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function contentAppearsText(bytes: Uint8Array): boolean {
  const sample = bytes.slice(0, Math.min(bytes.length, CONTENT_SAMPLE_LIMIT));
  if (sample.length === 0) return false;
  if (sample.some((byte) => byte === 0)) return false;
  const controls = [...sample].filter((byte) => byte < 9 || (byte > 13 && byte < 32)).length;
  return controls < Math.max(2, sample.length * 0.02);
}

function classify(extensionSuggestsText: boolean, appearsText: boolean, size: number) {
  if (size === 0) return { contentKind: "unknown" as const, confidence: "low" as const };
  if (extensionSuggestsText && appearsText) return { contentKind: "text" as const, confidence: "high" as const };
  if (!extensionSuggestsText && !appearsText) return { contentKind: "binary" as const, confidence: "high" as const };
  if (appearsText) return { contentKind: "text" as const, confidence: "medium" as const };
  return { contentKind: "binary" as const, confidence: "medium" as const };
}

async function inspectEntry(entry: JSZip.JSZipObject): Promise<ReferenceFileInspection> {
  const path = normalize(entry.name);
  const name = nameOf(path);
  const bytes = await entry.async("uint8array");
  const extensionSuggestsText = TEXT_EXTENSIONS.has(extensionOf(path));
  const appearsText = contentAppearsText(bytes);
  const classification = classify(extensionSuggestsText, appearsText, bytes.length);
  const isText = classification.contentKind === "text";
  const previewBytes = isText ? Math.min(bytes.length, TEXT_PREVIEW_LIMIT) : Math.min(bytes.length, BINARY_PREVIEW_LIMIT);
  const preview = isText ? new TextDecoder().decode(bytes.slice(0, previewBytes)) : undefined;
  return {
    path,
    name,
    extension: extensionOf(path),
    size: bytes.length,
    ...classification,
    extensionSuggestsText,
    contentAppearsText: appearsText,
    isText,
    isBinary: classification.contentKind === "binary",
    ...(preview !== undefined ? { preview } : {}),
    previewBytes,
    previewTruncated: previewBytes < bytes.length,
    ...(isText ? {} : { hexPreview: hexPreview(bytes) }),
    strings: isText ? [] : findAsciiStrings(bytes),
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
    `  classificação: ${file.contentKind}`,
    `  confiança: ${file.confidence}`,
    `  extensão sugere texto: ${file.extensionSuggestsText ? "sim" : "não"}`,
    `  conteúdo parece texto: ${file.contentAppearsText ? "sim" : "não"}`,
    `  preview: ${file.previewBytes} de ${file.size} bytes${file.previewTruncated ? " (truncado)" : ""}`,
  ];
  if (file.isBinary) {
    lines.push(`  hexadecimal inicial: ${file.hexPreview || "vazio"}`);
    lines.push(`  strings ASCII/UTF-8: ${list(file.strings.map((item) => `${JSON.stringify(item.value)} @offset ${item.offset}`))}`);
  }
  if (file.isText) {
    lines.push("  preview:");
    lines.push(...(file.preview ?? "").split("\n").map((line) => `    ${line}`));
  }
  return lines;
}

function renderReport(fileName: string, files: ReferenceFileInspection[], folders: string[], extensions: string[]): string {
  const textFiles = files.filter((file) => file.isText);
  const binaryFiles = files.filter((file) => file.isBinary);
  const unknownFiles = files.filter((file) => file.contentKind === "unknown");
  return [
    "GS3 REFERENCE STRUCTURE",
    "",
    `ZIP: ${fileName}`,
    `Gerado em: ${new Date().toISOString()}`,
    "",
    "ARQUIVOS ENCONTRADOS",
    `Total: ${files.length}`,
    `Pastas: ${list(folders)}`,
    `Extensões: ${list(extensions)}`,
    ...files.flatMap((file) => ["", ...renderFile(file)]),
    "",
    "RESUMO DE CLASSIFICAÇÃO",
    `- Texto: ${textFiles.length}`,
    `- Binário: ${binaryFiles.length}`,
    `- Desconhecido: ${unknownFiles.length}`,
    "- A classificação descreve apenas os bytes existentes; nenhuma relação ou conversão foi inferida.",
    "",
    "FIM DO RELATÓRIO",
  ].join("\n");
}

export async function inspectGs3Reference(file: File): Promise<Gs3ReferenceInspectionResult> {
  if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Selecione um arquivo ZIP GS3 exportado pelo GS5.");
  const zip = await JSZip.loadAsync(file);
  const allEntries = Object.values(zip.files);
  const entries = allEntries.filter((entry) => !entry.dir);
  const files = (await Promise.all(entries.map(inspectEntry))).sort((left, right) => left.path.localeCompare(right.path));
  const paths = allEntries.map((entry) => normalize(entry.name)).sort((left, right) => left.localeCompare(right));
  const explicitFolders = allEntries.filter((entry) => entry.dir).map((entry) => normalize(entry.name).replace(/\/$/, ""));
  const implicitFolders = paths.flatMap((path) => {
    const parts = path.replace(/\/$/, "").split("/");
    return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"));
  });
  const folders = unique([...explicitFolders, ...implicitFolders]).filter(Boolean).sort((left, right) => left.localeCompare(right));
  const extensions = unique(files.map((item) => item.extension)).sort((left, right) => left.localeCompare(right));
  return { fileName: file.name, paths, folders, extensions, files, report: renderReport(file.name, files, folders, extensions) };
}
