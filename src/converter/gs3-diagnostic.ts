import JSZip from "jszip";

export interface DiagnosticFile {
  path: string;
  extension: string;
  size: number;
  text?: string;
  isText: boolean;
  isXml: boolean;
  guids: string[];
  references: string[];
  terms: string[];
}

export interface DiagnosticMatch {
  sourcePath?: string;
  targetPath: string;
  relation: "DIRETO" | "TRANSFORMADO" | "CRIADO" | "NÃO DETERMINADA";
  confidence: "ALTA" | "MÉDIA" | "BAIXA" | "NÃO DETERMINADA";
  reason: string;
  sourceSize?: number;
  targetSize: number;
  sharedGuids: string[];
  sourceTerms: string[];
  targetTerms: string[];
}

export interface DiagnosticResult {
  sourceName: string;
  targetName: string;
  sourceFiles: DiagnosticFile[];
  targetFiles: DiagnosticFile[];
  matches: DiagnosticMatch[];
  removed: DiagnosticFile[];
  report: string;
}

const GUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const TERMS = [
  "Field GUID",
  "SpatialObject",
  "TaggedEntity",
  "AdaptiveCurve",
  "ABLine",
  "ABCurve",
  "OperationalBoundary",
  "Boundary",
  "Flag",
  "SpatialCatalog",
  "setup.fds",
  "global.ver",
  "host",
];
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
]);

const normalize = (value: string) => value.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
const extensionOf = (path: string) => {
  const name = path.split("/").pop() ?? path;
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "[sem extensão]";
};
const baseName = (path: string) => {
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.[^.]+$/, "").toLowerCase();
};
const unique = (values: string[]) => [...new Set(values)];
const formatBytes = (value: number) => `${value} bytes`;
const cleanGuid = (value: string) => value.toLowerCase();

function extractGuids(value: string): string[] {
  return unique((value.match(GUID_PATTERN) ?? []).map(cleanGuid));
}

function detectReferences(text: string, ownGuids: string[]): string[] {
  const own = new Set(ownGuids);
  return extractGuids(text).filter((guid) => !own.has(guid));
}

function detectTerms(path: string, text: string): string[] {
  const haystack = `${path}\n${text}`.toLowerCase();
  return TERMS.filter((term) => haystack.includes(term.toLowerCase()));
}

function likelyText(path: string, bytes: Uint8Array): boolean {
  if (TEXT_EXTENSIONS.has(extensionOf(path))) return true;
  const sample = bytes.slice(0, Math.min(bytes.length, 512));
  return !sample.some((byte) => byte === 0);
}

async function inspectZip(zip: JSZip): Promise<DiagnosticFile[]> {
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const result: DiagnosticFile[] = [];
  for (const entry of entries) {
    const path = entry.name.replace(/\\/g, "/");
    const bytes = await entry.async("uint8array");
    const isText = likelyText(path, bytes);
    let text: string | undefined;
    if (isText) {
      try {
        text = await entry.async("text");
      } catch {
        text = undefined;
      }
    }
    const value = text ?? "";
    const guids = extractGuids(value);
    result.push({
      path,
      extension: extensionOf(path),
      size: bytes.length,
      ...(text !== undefined ? { text } : {}),
      isText,
      isXml: extensionOf(path) === ".xml" || /<[^>]+>/.test(value.slice(0, 2000)),
      guids,
      references: detectReferences(value, guids),
      terms: detectTerms(path, value),
    });
  }
  return result.sort((left, right) => normalize(left.path).localeCompare(normalize(right.path)));
}

function exactContent(source: DiagnosticFile | undefined, target: DiagnosticFile): boolean {
  return Boolean(source?.isText && target.isText && source.text === target.text);
}

function sharedGuids(source: DiagnosticFile | undefined, target: DiagnosticFile): string[] {
  if (!source) return [];
  const targetGuids = new Set(target.guids);
  return source.guids.filter((guid) => targetGuids.has(guid));
}

function scoreCandidate(source: DiagnosticFile, target: DiagnosticFile): number {
  let score = 0;
  if (normalize(source.path) === normalize(target.path)) score += 100;
  if (baseName(source.path) === baseName(target.path)) score += 35;
  if (source.extension === target.extension) score += 15;
  if (source.isXml === target.isXml) score += 5;
  score += sharedGuids(source, target).length * 25;
  score += source.terms.filter((term) => target.terms.includes(term)).length * 4;
  if (source.size === target.size) score += 5;
  return score;
}

function createMatch(target: DiagnosticFile, source: DiagnosticFile | undefined): DiagnosticMatch {
  if (!source) {
    return {
      targetPath: target.path,
      relation: "CRIADO",
      confidence: "NÃO DETERMINADA",
      reason: "Nenhum arquivo de origem foi associado com evidência suficiente.",
      targetSize: target.size,
      sharedGuids: [],
      sourceTerms: [],
      targetTerms: target.terms,
    };
  }
  const same = exactContent(source, target);
  const guids = sharedGuids(source, target);
  const samePath = normalize(source.path) === normalize(target.path);
  const score = scoreCandidate(source, target);
  const relation = same ? "DIRETO" : "TRANSFORMADO";
  const confidence = same ? "ALTA" : score >= 100 || guids.length > 0 ? "ALTA" : score >= 35 ? "MÉDIA" : "BAIXA";
  const reasons = [
    same ? "conteúdo textual idêntico" : undefined,
    samePath ? "mesmo caminho relativo" : undefined,
    guids.length ? `${guids.length} GUID(s) compartilhado(s)` : undefined,
    source.terms.filter((term) => target.terms.includes(term)).length ? "termos estruturais compartilhados" : undefined,
    !same && !samePath && !guids.length ? "associação por nome/extensão e similaridade estrutural" : undefined,
  ].filter(Boolean);
  return {
    sourcePath: source.path,
    targetPath: target.path,
    relation,
    confidence,
    reason: reasons.join("; ") || "relação não determinada com segurança",
    sourceSize: source.size,
    targetSize: target.size,
    sharedGuids: guids,
    sourceTerms: source.terms,
    targetTerms: target.terms,
  };
}

function describeFile(file: DiagnosticFile): string {
  return `${file.path} | ${file.extension} | ${formatBytes(file.size)} | XML=${file.isXml ? "sim" : "não"} | GUIDs=${file.guids.length} | referências=${file.references.length} | termos=${file.terms.join(", ") || "nenhum"}`;
}

function renderReport(result: Omit<DiagnosticResult, "report">): string {
  const sourceByPath = new Map(result.sourceFiles.map((file) => [normalize(file.path), file]));
  const targetByPath = new Map(result.targetFiles.map((file) => [normalize(file.path), file]));
  const sourceExtensions = new Map<string, number>();
  const targetExtensions = new Map<string, number>();
  for (const file of result.sourceFiles) sourceExtensions.set(file.extension, (sourceExtensions.get(file.extension) ?? 0) + 1);
  for (const file of result.targetFiles) targetExtensions.set(file.extension, (targetExtensions.get(file.extension) ?? 0) + 1);
  const lines: string[] = [
    "RELATÓRIO DE DIAGNÓSTICO ESTRUTURAL",
    "GEN4 → GS3",
    "",
    `Origem: ${result.sourceName}`,
    `Destino: ${result.targetName}`,
    `Gerado em: ${new Date().toISOString()}`,
    "",
    "AVISO METODOLÓGICO",
    "Este relatório compara somente o conteúdo real dos dois ZIPs. Uma associação sem conteúdo idêntico, GUID compartilhado ou correspondência estrutural suficiente permanece marcada como NÃO DETERMINADA. Nenhuma regra de conversão é aplicada por este diagnóstico.",
    "",
    "RESUMO",
    `Arquivos Gen4: ${result.sourceFiles.length}`,
    `Arquivos GS3: ${result.targetFiles.length}`,
    `Arquivos removidos ou sem destino associado: ${result.removed.length}`,
    `Arquivos GS3 classificados como diretos: ${result.matches.filter((item) => item.relation === "DIRETO").length}`,
    `Arquivos GS3 classificados como transformados: ${result.matches.filter((item) => item.relation === "TRANSFORMADO").length}`,
    `Arquivos GS3 classificados como criados: ${result.matches.filter((item) => item.relation === "CRIADO").length}`,
    `Arquivos GS3 não determinados: ${result.matches.filter((item) => item.confidence === "NÃO DETERMINADA" || item.confidence === "BAIXA").length}`,
    "",
    "EXTENSÕES",
    `Gen4: ${[...sourceExtensions.entries()].map(([key, value]) => `${key}=${value}`).join(", ") || "nenhuma"}`,
    `GS3: ${[...targetExtensions.entries()].map(([key, value]) => `${key}=${value}`).join(", ") || "nenhuma"}`,
    "",
    "ARQUIVOS GS3: GEN4 → GS3 → TRANSFORMAÇÃO → DEPENDÊNCIAS",
  ];
  for (const match of result.matches) {
    lines.push(`- ${match.sourcePath ?? "NÃO DETERMINADA"} → ${match.targetPath} → ${match.relation} (${match.confidence}) → ${match.reason}`);
    lines.push(`  Tamanho: ${match.sourceSize === undefined ? "NÃO DETERMINADO" : formatBytes(match.sourceSize)} → ${formatBytes(match.targetSize)}`);
    lines.push(`  GUIDs compartilhados: ${match.sharedGuids.join(", ") || "nenhum identificado"}`);
    lines.push(`  Termos Gen4: ${match.sourceTerms.join(", ") || "nenhum"}`);
    lines.push(`  Termos GS3: ${match.targetTerms.join(", ") || "nenhum"}`);
  }
  lines.push("", "ARQUIVOS GEN4 SEM DESTINO ASSOCIADO");
  for (const file of result.removed) lines.push(`- ${describeFile(file)}`);
  if (!result.removed.length) lines.push("- Nenhum arquivo sem destino associado pelo critério atual.");
  lines.push("", "ARQUIVOS GS3 DETALHADOS");
  for (const file of result.targetFiles) lines.push(`- ${describeFile(file)}`);
  lines.push("", "GUIDS E REFERÊNCIAS");
  const allGuids = new Set(result.sourceFiles.flatMap((file) => file.guids));
  for (const file of result.targetFiles) {
    const source = file.path ? sourceByPath.get(normalize(file.path)) : undefined;
    const originGuids = source?.guids ?? [];
    const targetOnly = file.guids.filter((guid) => !allGuids.has(guid));
    lines.push(`- ${file.path}: próprios=${file.guids.join(", ") || "nenhum"}; referências=${file.references.join(", ") || "nenhuma"}; GUIDs não encontrados no Gen4=${targetOnly.join(", ") || "nenhum"}; origem pelo mesmo caminho=${originGuids.join(", ") || "não determinada"}`);
  }
  lines.push("", "ARQUIVOS ESTRUTURAIS RELEVANTES");
  for (const term of TERMS) {
    const source = result.sourceFiles.filter((file) => file.terms.includes(term)).map((file) => file.path);
    const target = result.targetFiles.filter((file) => file.terms.includes(term)).map((file) => file.path);
    lines.push(`- ${term}: Gen4=[${source.join(", ") || "nenhum"}] → GS3=[${target.join(", ") || "nenhum"}]`);
  }
  lines.push("", "NÃO DETERMINADO / AINDA NÃO REPRODUZÍVEL");
  for (const match of result.matches.filter((item) => item.confidence === "NÃO DETERMINADA" || item.confidence === "BAIXA")) {
    lines.push(`- ${match.targetPath}: ${match.reason}`);
  }
  if (!result.matches.some((item) => item.confidence === "NÃO DETERMINADA" || item.confidence === "BAIXA")) lines.push("- Nenhuma associação foi marcada como não determinada pelos critérios atuais.");
  lines.push("", "FIM DO RELATÓRIO");
  return lines.join("\n");
}

export async function diagnoseGen4ToGs3(sourceFile: File, targetFile: File): Promise<DiagnosticResult> {
  if (!sourceFile.name.toLowerCase().endsWith(".zip") || !targetFile.name.toLowerCase().endsWith(".zip")) {
    throw new Error("Selecione dois arquivos ZIP: o Gen4 original e o GS3 exportado pelo GS5.");
  }
  const sourceZip = await JSZip.loadAsync(sourceFile);
  const targetZip = await JSZip.loadAsync(targetFile);
  const sourceFiles = await inspectZip(sourceZip);
  const targetFiles = await inspectZip(targetZip);
  const usedSources = new Set<string>();
  const matches = targetFiles.map((target) => {
    const candidates = sourceFiles
      .filter((source) => !usedSources.has(normalize(source.path)))
      .map((source) => ({ source, score: scoreCandidate(source, target) }))
      .sort((left, right) => right.score - left.score);
    const best = candidates[0];
    if (!best || best.score < 20) return createMatch(target, undefined);
    usedSources.add(normalize(best.source.path));
    return createMatch(target, best.source);
  });
  const removed = sourceFiles.filter((file) => !usedSources.has(normalize(file.path)));
  const partial = { sourceName: sourceFile.name, targetName: targetFile.name, sourceFiles, targetFiles, matches, removed };
  return { ...partial, report: renderReport(partial) };
}
