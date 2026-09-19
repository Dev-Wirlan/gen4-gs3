import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import JSZip from "jszip";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronRight, Download, FileArchive, LoaderCircle, Lock, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeGen4Project } from "@/converter/gen4-parser";
import type { ClientNode, ProjectAnalysis, SpatialType } from "@/converter/types";
import { exportValidatedAdaptiveCurves } from "@/converter/zip-exporter";
import { diagnoseGen4ToGs3, type DiagnosticResult } from "@/converter/gs3-diagnostic";
import { inspectGs3Reference, type Gs3ReferenceInspectionResult } from "@/converter/gs3-reference-inspector";
import { initializePwa } from "@/lib/pwa";

const TYPE_LABELS: Record<SpatialType, string> = { AdaptiveCurve: "AdaptiveCurve", ABLine: "ABLine", ABCurve: "ABCurve", Boundary: "Boundary", Flags: "Flags", Unknown: "Desconhecido" };
const formatSize = (bytes: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024) + " MB";

function StatusBadge({ type }: { type: SpatialType }) {
  const compatible = type === "AdaptiveCurve";
  const unknown = type === "Unknown";
  return <span className={`status-chip ${compatible ? "status-good" : unknown ? "status-bad" : "status-pending"}`}>{compatible ? "Compatível" : unknown ? "Não suportado" : "Aguardando implementação"}</span>;
}

function ProjectTree({ clients, unassigned, selectedFieldId, onSelectField }: Pick<ProjectAnalysis, "clients" | "unassigned"> & { selectedFieldId: string | undefined; onSelectField: (id: string) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((value) => ({ ...value, [id]: value[id] === false ? true : false }));
  const expanded = (id: string) => open[id] !== false;
  const Branch = ({ id, label, meta, depth = 0, children }: { id: string; label: string; meta?: string; depth?: number; children: React.ReactNode }) => (
    <div>
      <Button variant="tree" size="tree" onClick={() => toggle(id)} className="w-full" aria-expanded={expanded(id)} style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}>
        {expanded(id) ? <ChevronDown /> : <ChevronRight />}<span className="truncate">{label}</span>{meta && <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{meta}</span>}
      </Button>
      {expanded(id) && children}
    </div>
  );
  if (!clients.length && !unassigned.length) return <p className="py-6 text-sm text-muted-foreground">Nenhuma hierarquia pôde ser confirmada.</p>;
  return <div className="space-y-1 font-mono text-xs">
    {clients.map((client: ClientNode) => <Branch key={client.id} id={client.id} label={`Cliente · ${client.name}`} meta={`${client.farms.length} fazenda(s)`}>
      {client.farms.map((farm) => <Branch key={farm.id} id={farm.id} label={`Fazenda · ${farm.name}`} meta={`${farm.fields.length} talhão(ões)`} depth={1}>
        {farm.fields.map((field) => <div key={field.id} className={selectedFieldId === field.id ? "field-selected" : undefined}>
          <div className="flex items-center gap-1"><div className="min-w-0 flex-1"><Branch id={field.id} label={`Talhão · ${field.name}`} meta={`${field.spatial.length} elemento(s)`} depth={2}>
            {field.spatial.map((item) => <div key={item.id} className="tree-leaf" style={{ paddingLeft: "4.5rem" }}><span className="truncate">{TYPE_LABELS[item.type]} · {item.name}</span><StatusBadge type={item.type} /></div>)}
          </Branch></div><Button variant={selectedFieldId === field.id ? "default" : "outline"} size="sm" onClick={() => onSelectField(field.id)} aria-label={`Selecionar talhão ${field.name}`}>{selectedFieldId === field.id ? <CheckCircle2 /> : <Check />}<span className="hidden sm:inline">{selectedFieldId === field.id ? "Selecionado" : "Selecionar"}</span></Button></div>
        </div>)}
      </Branch>)}
    </Branch>)}
    {unassigned.length > 0 && <Branch id="unassigned" label="Sem vínculo confirmado" meta={`${unassigned.length} arquivo(s)`}>
      {unassigned.map((item) => <div key={item.id} className="tree-leaf pl-8"><span className="truncate">{item.name}</span><StatusBadge type={item.type} /></div>)}
    </Branch>}
  </div>;
}

export function ConverterApp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [analysis, setAnalysis] = useState<ProjectAnalysis>();
  const [zip, setZip] = useState<JSZip>();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<string>();
  const [selectedFieldId, setSelectedFieldId] = useState<string>();
  const [diagnosticSource, setDiagnosticSource] = useState<File>();
  const [diagnosticTarget, setDiagnosticTarget] = useState<File>();
  const [diagnosticBusy, setDiagnosticBusy] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult>();
  const [diagnosticMessage, setDiagnosticMessage] = useState<string>();
  const [referenceFile, setReferenceFile] = useState<File>();
  const [referenceBusy, setReferenceBusy] = useState(false);
  const [referenceResult, setReferenceResult] = useState<Gs3ReferenceInspectionResult>();
  const [referenceMessage, setReferenceMessage] = useState<string>();
  useEffect(() => { void initializePwa(); }, []);

  const counts = useMemo(() => Object.fromEntries((["AdaptiveCurve", "ABLine", "ABCurve", "Boundary", "Flags", "Unknown"] as SpatialType[]).map((type) => [type, analysis?.spatial.filter((item) => item.type === type).length ?? 0])) as Record<SpatialType, number>, [analysis]);
  const fields = analysis?.clients.flatMap((client) => client.farms.flatMap((farm) => farm.fields)).length ?? 0;
  const associatedCurves = analysis?.spatial.filter((item) => item.type === "AdaptiveCurve" && item.fieldId && !analysis.unassigned.includes(item)).length ?? 0;
  const selectedField = analysis?.clients.flatMap((client) => client.farms.flatMap((farm) => farm.fields)).find((field) => field.id === selectedFieldId);

  const inspect = async (file?: File) => {
    if (!file) return;
    setBusy(true); setMessage(undefined);
    try { const result = await analyzeGen4Project(file); const firstField = result.analysis.clients.flatMap((client) => client.farms.flatMap((farm) => farm.fields))[0]; setAnalysis(result.analysis); setZip(result.zip); setSelectedFieldId(firstField?.id); }
    catch (error) { setAnalysis(undefined); setZip(undefined); setSelectedFieldId(undefined); setMessage(error instanceof Error ? error.message : "Não foi possível analisar o ZIP."); }
    finally { setBusy(false); }
  };
  const drop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); void inspect(event.dataTransfer.files[0]); };
  const exportZip = async () => {
    if (!analysis || !zip || !selectedFieldId) return;
    setBusy(true); setMessage(undefined);
    try {
      const result = await exportValidatedAdaptiveCurves(zip, analysis, selectedFieldId);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = analysis.fileName.replace(/\.zip$/i, "") + "_Projeto_GS3_Construido.zip"; anchor.click(); URL.revokeObjectURL(url);
      setMessage(`Construção concluída: ${result.converted} curva(s). A estrutura não tem todos os componentes obrigatórios resolvidos. Veja o relatório interno no ZIP gerado.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao constuir projeto GS3."); }
    finally { setBusy(false); }
  };

  const runDiagnostic = async () => {
    if (!diagnosticSource || !diagnosticTarget) return;
    setDiagnosticBusy(true);
    setDiagnosticMessage(undefined);
    try {
      const result = await diagnoseGen4ToGs3(diagnosticSource, diagnosticTarget);
      setDiagnosticResult(result);
    } catch (error) {
      setDiagnosticResult(undefined);
      setDiagnosticMessage(error instanceof Error ? error.message : "Não foi possível gerar o diagnóstico.");
    } finally {
      setDiagnosticBusy(false);
    }
  };

  const downloadDiagnostic = () => {
    if (!diagnosticResult) return;
    const blob = new Blob([diagnosticResult.report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${diagnosticResult.sourceName.replace(/\\.zip$/i, "")}_GEN4-GS3_diagnostico.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const runReferenceInspection = async () => {
    if (!referenceFile) return;
    setReferenceBusy(true);
    setReferenceMessage(undefined);
    try {
      setReferenceResult(await inspectGs3Reference(referenceFile));
    } catch (error) {
      setReferenceResult(undefined);
      setReferenceMessage(error instanceof Error ? error.message : "Não foi possível inspecionar o ZIP GS3 de referência.");
    } finally {
      setReferenceBusy(false);
    }
  };

  const downloadReferenceReport = () => {
    if (!referenceResult) return;
    const blob = new Blob([referenceResult.report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${referenceResult.fileName.replace(/\\.zip$/i, "")}_GS3_reference_structure.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <div className="min-h-screen bg-mesh text-foreground">
    <header className="glass slash-r sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 px-5 py-3 md:px-8">
      <div className="flex items-center gap-3"><div className="brand-mark">G3</div><div><p className="text-sm font-semibold">Gen4 → GS3 Converter</p><p className="font-mono text-[10px] text-muted-foreground">análise e conversão local</p></div></div>
      <div className="hidden items-center gap-2 sm:flex"><span className="status-chip status-good"><Lock /> ARQUIVOS LOCAIS</span><span className="status-chip status-primary">PWA · OFFLINE</span></div>
    </header>
    <main className="mx-auto max-w-6xl space-y-7 px-5 py-7 md:px-8">
      <section className="grid items-stretch gap-5 lg:grid-cols-12">
        <div className="glass slash flex flex-col justify-center p-7 lg:col-span-7 md:p-9">
          <p className="section-kicker">Conversor de projetos agrícolas</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.04] md:text-5xl">Analise projetos <span className="text-primary">Gen4</span> e prepare a conversão para <span className="text-highlight">GS3</span>.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">O ZIP é lido no seu dispositivo. A ferramenta identifica MasterData.xml, relacionamentos e dados espaciais sem enviar seus arquivos.</p>
          <div className="mt-6 flex flex-wrap gap-2"><span className="trust-note"><Check /> Nenhum upload</span><span className="trust-note"><Check /> Windows e Android</span><span className="trust-note"><Check /> Funciona offline</span></div>
        </div>
        <div className="glass flex flex-col p-5 lg:col-span-5">
          <p className="section-kicker text-muted-foreground">Etapa 01 · Selecionar projeto</p>
          <div role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} className={`drop-zone ${dragging ? "drop-active" : ""}`}>
            <input ref={inputRef} type="file" accept=".zip,application/zip" className="sr-only" onChange={(event) => void inspect(event.target.files?.[0])} />
            {busy ? <LoaderCircle className="size-11 animate-spin text-primary" /> : <Upload className="size-11 text-primary" />}
            <p className="mt-3 text-sm font-semibold">{busy ? "Analisando o conteúdo…" : "Arraste o ZIP aqui"}</p><p className="mt-1 text-xs text-muted-foreground">ou clique para selecionar · somente .zip</p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 font-mono text-[10px] text-muted-foreground"><span className="truncate">{analysis?.fileName ?? "Nenhum projeto selecionado"}</span><span className="shrink-0 text-good">processamento local</span></div>
        </div>
      </section>

      <section className="glass slash p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker">Diagnóstico estrutural · Gen4 → GS3</p>
            <h2 className="mt-2 text-xl font-semibold">Compare o projeto original com a saída real do GS5</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Selecione os dois ZIPs para identificar arquivos diretos, transformados, criados, removidos e relações por GUID. Esta etapa apenas observa o conteúdo; não altera a conversão nem cria dados.</p>
          </div>
          <Button variant="terminal" onClick={() => void runDiagnostic()} disabled={diagnosticBusy || !diagnosticSource || !diagnosticTarget}>
            {diagnosticBusy ? <LoaderCircle className="animate-spin" /> : <FileArchive />}
            {diagnosticBusy ? "Comparando…" : "Gerar diagnóstico"}
          </Button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="drop-zone min-h-32 cursor-pointer p-5">
            <input type="file" accept=".zip,application/zip" className="sr-only" onChange={(event) => { setDiagnosticSource(event.target.files?.[0]); setDiagnosticResult(undefined); }} />
            <Upload className="size-7 text-primary" />
            <span className="mt-2 text-sm font-semibold">ZIP Gen4 original</span>
            <span className="mt-1 max-w-full truncate text-xs text-muted-foreground">{diagnosticSource?.name ?? "Selecionar projeto de origem"}</span>
          </label>
          <label className="drop-zone min-h-32 cursor-pointer p-5">
            <input type="file" accept=".zip,application/zip" className="sr-only" onChange={(event) => { setDiagnosticTarget(event.target.files?.[0]); setDiagnosticResult(undefined); }} />
            <Upload className="size-7 text-highlight" />
            <span className="mt-2 text-sm font-semibold">ZIP GS3 exportado pelo GS5</span>
            <span className="mt-1 max-w-full truncate text-xs text-muted-foreground">{diagnosticTarget?.name ?? "Selecionar saída de referência"}</span>
          </label>
        </div>
        {diagnosticMessage && <div className="notice danger mt-4"><AlertTriangle /><span>{diagnosticMessage}</span></div>}
        {diagnosticResult && <div className="mt-5 rounded-lg border border-border bg-background/50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-xs text-muted-foreground">RELATÓRIO GERADO</p>
              <p className="mt-1 text-sm">{diagnosticResult.matches.length} arquivos GS3 comparados · {diagnosticResult.removed.length} arquivos Gen4 sem destino associado</p>
            </div>
            <Button variant="outline" onClick={downloadDiagnostic}><Download /> Baixar relatório</Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div><span className="text-muted-foreground">Diretos</span><strong className="mt-1 block text-good">{diagnosticResult.matches.filter((item) => item.relation === "DIRETO").length}</strong></div>
            <div><span className="text-muted-foreground">Transformados</span><strong className="mt-1 block text-primary">{diagnosticResult.matches.filter((item) => item.relation === "TRANSFORMADO").length}</strong></div>
            <div><span className="text-muted-foreground">Criados</span><strong className="mt-1 block text-highlight">{diagnosticResult.matches.filter((item) => item.relation === "CRIADO").length}</strong></div>
            <div><span className="text-muted-foreground">Não determinados</span><strong className="mt-1 block text-pending">{diagnosticResult.matches.filter((item) => item.confidence === "NÃO DETERMINADA" || item.confidence === "BAIXA").length}</strong></div>
          </div>
        </div>}
      </section>

      <section className="glass slash p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker">Inspeção do ZIP GS3 de referência</p>
            <h2 className="mt-2 text-xl font-semibold">Descubra a estrutura real exportada pelo GS5</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Esta etapa somente lê o ZIP selecionado. Nenhum setup.fds, host, SpatialCatalog, pasta ou caminho é criado ou presumido.</p>
          </div>
          <Button variant="terminal" onClick={() => void runReferenceInspection()} disabled={referenceBusy || !referenceFile}>
            {referenceBusy ? <LoaderCircle className="animate-spin" /> : <FileArchive />}
            {referenceBusy ? "Inspecionando…" : "Inspecionar referência"}
          </Button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <label className="drop-zone min-h-28 cursor-pointer p-5">
            <input type="file" accept=".zip,application/zip" className="sr-only" onChange={(event) => { setReferenceFile(event.target.files?.[0]); setReferenceResult(undefined); setReferenceMessage(undefined); }} />
            <Upload className="size-7 text-highlight" />
            <span className="mt-2 text-sm font-semibold">ZIP GS3 exportado pelo GS5</span>
            <span className="mt-1 max-w-full truncate text-xs text-muted-foreground">{referenceFile?.name ?? "Selecionar projeto GS3 de referência"}</span>
          </label>
          {referenceResult && <Button variant="outline" onClick={downloadReferenceReport}><Download /> Baixar relatório</Button>}
        </div>
        {referenceMessage && <div className="notice danger mt-4"><AlertTriangle /><span>{referenceMessage}</span></div>}
        {referenceResult && <div className="mt-5 rounded-lg border border-border bg-background/50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-xs text-muted-foreground">INSPEÇÃO CONCLUÍDA</p>
              <p className="mt-1 text-sm">{referenceResult.files.length} arquivo(s) encontrados no ZIP real, sem caminhos inventados.</p>
            </div>
            <span className="status-chip status-good">estrutura observada</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div><span className="text-muted-foreground">Texto</span><strong className="mt-1 block text-good">{referenceResult.files.filter((file) => file.isText).length}</strong></div>
            <div><span className="text-muted-foreground">Binário</span><strong className="mt-1 block text-primary">{referenceResult.files.filter((file) => file.isBinary).length}</strong></div>
            <div><span className="text-muted-foreground">Com GUID</span><strong className="mt-1 block text-highlight">{referenceResult.files.filter((file) => file.guids.length > 0).length}</strong></div>
            <div><span className="text-muted-foreground">XML</span><strong className="mt-1 block text-pending">{referenceResult.files.filter((file) => file.isXml).length}</strong></div>
          </div>
        </div>}
      </section>

      {message && <div className="notice"><AlertTriangle /><span>{message}</span></div>}
      {!analysis ? <section className="glass empty-state"><FileArchive /><div><h2>Selecione um projeto Gen4 para começar</h2><p>A conversão não começa automaticamente. Primeiro você verá a análise e os itens compatíveis.</p></div></section> : <>
        <section className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <div className="flex items-center justify-between"><p className="section-kicker text-muted-foreground">Etapa 02 · Analisar</p><span className="font-mono text-[10px] text-muted-foreground">{formatSize(analysis.fileSize)}</span></div>
            <div className="glass p-5"><div className="facts-grid"><div><span>ZIP</span><strong>Válido</strong></div><div><span>MasterData.xml</span><strong className={analysis.masterDataFound ? "text-good" : "text-danger"}>{analysis.masterDataFound ? "Encontrado" : "Ausente"}</strong></div><div><span>Arquivos .gjson</span><strong>{analysis.gjsonCount}</strong></div><div><span>Talhões encontrados</span><strong>{fields}</strong></div><div><span>AdaptiveCurve associadas</span><strong>{associatedCurves} / {counts.AdaptiveCurve}</strong></div><div><span>Elementos órfãos</span><strong className={analysis.unassigned.length ? "text-pending" : "text-good"}>{analysis.unassigned.length}</strong></div></div></div>
            <div className="grid grid-cols-2 gap-3">{(["AdaptiveCurve", "ABLine", "Boundary", "Flags"] as SpatialType[]).map((type) => <div key={type} className="glass p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-2xl font-semibold text-primary">{counts[type]}</p><p className="mt-1 text-xs">{TYPE_LABELS[type]}</p></div><StatusBadge type={type} /></div></div>)}</div>
            {counts.Unknown > 0 && <div className="notice danger"><AlertTriangle /><span>{counts.Unknown} elemento(s) Gen4 ainda não suportado(s) pelo conversor.</span></div>}
          </div>
          <div className="glass p-5 lg:col-span-7"><div className="mb-4 flex items-center justify-between"><p className="section-kicker text-muted-foreground">Etapa 03 · Resumo e seleção</p><span className="font-mono text-[10px] text-muted-foreground">Cliente → Fazenda → Talhão</span></div><ProjectTree clients={analysis.clients} unassigned={analysis.unassigned} selectedFieldId={selectedFieldId} onSelectField={setSelectedFieldId} />
            {analysis.warnings.length > 0 && <div className="mt-4 border-t border-border pt-4">{analysis.warnings.map((warning) => <p key={warning} className="mb-1 flex gap-2 text-xs text-pending"><AlertTriangle className="size-4 shrink-0" />{warning}</p>)}</div>}
          </div>
        </section>
        <section className="glass slash flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
          <div><p className="section-kicker">Etapa 04 · Extração Experimental</p><h2 className="mt-2 text-lg font-semibold">Baixar binários da curva</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{selectedField ? `${selectedField.name}: ${selectedField.adaptiveCurves.length} AdaptiveCurve(s) computadas.` : "Selecione um talhão na árvore."} O ZIP gerado acomoda apenas os binários .fdShape extraídos, aguardando que a inspeção da estrutura real de referência defina pastas e arquivos satélites a serem adotados futuramente.</p></div>
          <Button variant="terminal" size="lg" onClick={() => void exportZip()} disabled={busy || !selectedField || selectedField.adaptiveCurves.length === 0}><Download /> Extrair fdShape provisório</Button>
        </section>
      </>}
      <footer className="pb-6 text-center font-mono text-[10px] text-muted-foreground">Todo o processamento acontece neste navegador. Nenhum projeto agrícola é enviado.</footer>
    </main>
  </div>;
}