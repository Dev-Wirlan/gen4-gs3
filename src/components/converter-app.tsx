import { useEffect, useRef, useState, type DragEvent } from "react";
import { CheckCircle2, Download, FileArchive, LoaderCircle, Lock, Upload } from "lucide-react";
import { analyzeGen4Project } from "@/converter/gen4-parser";
import { exportValidatedAdaptiveCurves } from "@/converter/zip-exporter";
import { initializePwa } from "@/lib/pwa";
import type JSZip from "jszip";
import type { ProjectAnalysis } from "@/converter/types";

type ConversionStage = "idle" | "reading" | "analyzing" | "processing" | "building" | "validating" | "complete" | "error";

const stages: Array<{ key: Exclude<ConversionStage, "idle" | "error">; label: string }> = [
  { key: "reading", label: "Lendo projeto Gen4..." },
  { key: "analyzing", label: "Analisando estrutura..." },
  { key: "processing", label: "Processando campos e curvas..." },
  { key: "building", label: "Gerando estrutura GS3..." },
  { key: "validating", label: "Validando projeto..." },
];

export function ConverterApp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [stage, setStage] = useState<ConversionStage>("idle");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const [downloadUrl, setDownloadUrl] = useState<string>();
  const [outputName, setOutputName] = useState<string>();
  const [analysis, setAnalysis] = useState<ProjectAnalysis>();
  const [sourceZip, setSourceZip] = useState<JSZip>();
  const [selectedFieldId, setSelectedFieldId] = useState<string>();

  useEffect(() => {
    void initializePwa();
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const selectFile = (selected?: File) => {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".zip")) {
      setError("Selecione um arquivo .zip de projeto Gen4/GS4.");
      setStage("error");
      return;
    }
    setFile(selected);
    setError(undefined);
    setDownloadUrl(undefined);
    setOutputName(undefined);
    setAnalysis(undefined);
    setSourceZip(undefined);
    setSelectedFieldId(undefined);
    setStage("reading");
  };

  const convert = async () => {
    if (!file || stage === "analyzing" || stage === "processing" || stage === "building" || stage === "validating") return;

    setError(undefined);
    setDownloadUrl(undefined);
    setOutputName(undefined);

    try {
      let currentAnalysis = analysis;
      let currentZip = sourceZip;

      if (!currentAnalysis || !currentZip) {
        setStage("analyzing");
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const analyzed = await analyzeGen4Project(file);
        currentAnalysis = analyzed.analysis;
        currentZip = analyzed.zip;
        setAnalysis(currentAnalysis);
        setSourceZip(currentZip);

        if (currentAnalysis.zipStatus !== "valid") {
          throw new Error("O projeto Gen4/GS4 não pôde ser validado como ZIP.");
        }

        const candidates = currentAnalysis.clients.flatMap((client) =>
          client.farms.flatMap((farm) =>
            farm.fields
              .filter((field) => field.adaptiveCurves.length > 0)
              .map((field) => ({ field, clientName: client.name, farmName: farm.name })),
          ),
        );

        if (candidates.length === 0) {
          throw new Error("Nenhum talhão com AdaptiveCurve foi encontrado.");
        }

        if (candidates.length > 1 && !selectedFieldId) {
          setSelectedFieldId(undefined);
          setStage("idle");
          return;
        }
      }

      const candidates = currentAnalysis.clients.flatMap((client) =>
        client.farms.flatMap((farm) =>
          farm.fields
            .filter((field) => field.adaptiveCurves.length > 0)
            .map((field) => ({ field, clientName: client.name, farmName: farm.name })),
        ),
      );
      const fieldId = selectedFieldId ?? (candidates.length === 1 ? candidates[0].field.id : undefined);

      if (!fieldId || !candidates.some(({ field }) => field.id === fieldId)) {
        throw new Error("Selecione o talhão que deseja converter antes de continuar.");
      }

      setSelectedFieldId(fieldId);
      setStage("processing");
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      setStage("building");
      const result = await exportValidatedAdaptiveCurves(currentZip, currentAnalysis, fieldId);
      if (!result.validation.valid) {
        throw new Error(
          result.failures.length
            ? result.failures.join(" ")
            : "O projeto GS3 ainda não passou na validação estrutural necessária para download.",
        );
      }

      setStage("validating");
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const name = file.name.replace(/\.zip$/i, "") + "_GS3.zip";
      setDownloadUrl(URL.createObjectURL(result.blob));
      setOutputName(name);
      setStage("complete");
    } catch (cause) {
      setStage("error");
      setError(cause instanceof Error ? cause.message : "A conversão não pôde ser concluída.");
    }
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files[0]);
  };

  const candidateFields = analysis
    ? analysis.clients.flatMap((client) =>
        client.farms.flatMap((farm) =>
          farm.fields
            .filter((field) => field.adaptiveCurves.length > 0)
            .map((field) => ({ field, clientName: client.name, farmName: farm.name })),
        ),
      )
    : [];
  const needsFieldSelection = candidateFields.length > 1 && !selectedFieldId;
  const isBusy = ["analyzing", "processing", "building", "validating"].includes(stage);
  const currentStage = stage === "complete" ? stages.length : stages.findIndex((item) => item.key === stage);

  return (
    <div className="min-h-screen bg-mesh text-foreground">
      <header className="glass slash-r sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 px-5 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <div className="brand-mark">G3</div>
          <div>
            <p className="text-sm font-semibold">Gen4 → GS3 Converter</p>
            <p className="font-mono text-[10px] text-muted-foreground">conversão local de projetos John Deere</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="status-chip status-good"><Lock /> ARQUIVOS LOCAIS</span>
          <span className="status-chip status-primary">PWA · OFFLINE</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-5 py-8 md:px-8 md:py-12">
        <section className="glass slash p-7 md:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-kicker">Conversor John Deere</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">Gen4 → GS3 Converter</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              Converta projetos John Deere Gen4/GS4 para GS3.
            </p>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => !isBusy && inputRef.current?.click()}
            onKeyDown={(event) => {
              if (!isBusy && (event.key === "Enter" || event.key === " ")) inputRef.current?.click();
            }}
            onDragOver={(event) => { event.preventDefault(); if (!isBusy) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={`drop-zone mt-8 min-h-56 ${dragging ? "drop-active" : ""} ${isBusy ? "cursor-wait opacity-80" : ""}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
            {isBusy ? <LoaderCircle className="size-12 animate-spin text-primary" /> : <Upload className="size-12 text-primary" />}
            <p className="mt-4 text-base font-semibold">Selecione seu projeto Gen4/GS4</p>
            <p className="mt-1 text-xs text-muted-foreground">Arraste o arquivo aqui ou clique para selecionar · somente .zip</p>
            {file && <p className="mt-4 max-w-full truncate rounded-md border border-border bg-background/40 px-3 py-2 font-mono text-xs text-primary">{file.name}</p>}
          </div>
        </section>

        {file && (
          <section className="glass p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="section-kicker">Projeto selecionado</p>
                <h2 className="mt-2 truncate text-lg font-semibold">{file.name}</h2>
              </div>
              {stage === "complete" && (
                <span className="status-chip status-good"><CheckCircle2 /> conversão concluída</span>
              )}
            </div>

            {candidateFields.length > 1 && (
              <div className="mt-6 rounded-lg border border-border bg-background/20 p-4">
                <p className="text-sm font-semibold">Selecione o Field para converter</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  O projeto possui mais de um Field com AdaptiveCurves. A conversão usa o GUID real do Field selecionado.
                </p>
                <div className="mt-4 space-y-2">
                  {candidateFields.map(({ field, clientName, farmName }) => (
                    <label key={field.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:border-primary/50">
                      <input
                        type="radio"
                        name="field-selection"
                        value={field.id}
                        checked={selectedFieldId === field.id}
                        onChange={() => setSelectedFieldId(field.id)}
                        className="mt-1"
                      />
                      <span className="min-w-0 text-sm">
                        <span className="block font-semibold">Field: {field.name}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Client: {clientName} · Farm: {farmName} · AdaptiveCurves: {field.adaptiveCurves.length}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 space-y-2">
              {stages.map((item, index) => {
                const done = currentStage > index || stage === "complete";
                const active = stage === item.key;
                return (
                  <div key={item.key} className={`flex items-center gap-3 rounded-md border px-4 py-3 text-sm ${active ? "border-primary/50 bg-primary/10 text-primary" : done ? "border-primary/30 bg-primary/5 text-foreground" : "border-border bg-background/20 text-muted-foreground"}`}>
                    {done ? <CheckCircle2 className="size-4 text-primary" /> : active ? <LoaderCircle className="size-4 animate-spin text-primary" /> : <span className="size-4 rounded-full border border-border" />}
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>

            {stage === "complete" && outputName && downloadUrl ? (
              <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
                <CheckCircle2 className="mx-auto size-10 text-primary" />
                <h3 className="mt-3 text-lg font-semibold">Projeto GS3 pronto</h3>
                <p className="mt-1 text-xs text-muted-foreground">{outputName}</p>
                <a
                  href={downloadUrl}
                  download={outputName}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Download className="size-4" /> Baixar projeto GS3
                </a>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void convert()}
                disabled={isBusy || needsFieldSelection}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
              >
                {isBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                {needsFieldSelection ? "Selecione um Field" : "Converter para GS3"}
              </button>
            )}
          </section>
        )}

        {!file && (
          <section className="glass empty-state">
            <FileArchive />
            <div>
              <h2>Pronto para converter</h2>
              <p>Selecione um projeto Gen4/GS4 para iniciar.</p>
            </div>
          </section>
        )}

        {error && (
          <div className="notice danger">
            <span>{error}</span>
          </div>
        )}

        <footer className="pb-4 text-center font-mono text-[10px] text-muted-foreground">
          <p>A análise e a conversão acontecem neste navegador. Nenhum projeto agrícola é enviado.</p>
          <p className="mt-1">Desenvolvido por Dev-Wirlan</p>
        </footer>
      </main>
    </div>
  );
}
