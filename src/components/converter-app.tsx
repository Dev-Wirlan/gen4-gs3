import { useEffect, useState, type DragEvent } from "react";
import {
  CheckCircle2,
  Download,
  FileArchive,
  LoaderCircle,
  CloudUpload,
  Layers,
  Crosshair,
  Play,
  SlidersHorizontal,
} from "lucide-react";

import { analyzeGen4Project } from "@/converter/gen4-parser";
import { exportValidatedAdaptiveCurves } from "@/converter/zip-exporter";
import { buildGen4SetupWorkProject } from "@/converter/gen4-setup-work-builder";
import { initializePwa } from "@/lib/pwa";
import type JSZip from "jszip";
import type { ProjectAnalysis } from "@/converter/types";

type ConversionStage =
  | "idle"
  | "reading"
  | "analyzing"
  | "processing"
  | "building"
  | "validating"
  | "complete"
  | "error";

type ConversionMode = "GEN4_TO_SETUP_WORK" | "GEN4_SETUP_WORK_TO_GS3";

const stages: Array<{
  key: Exclude<ConversionStage, "idle" | "error">;
  label: string;
}> = [
  { key: "reading", label: "Lendo projeto Gen4..." },
  { key: "analyzing", label: "Analisando estrutura..." },
  { key: "processing", label: "Processando campos e curvas..." },
  { key: "building", label: "Gerando estrutura de saída..." },
  { key: "validating", label: "Validando projeto..." },
];

export function ConverterApp() {
  const [file, setFile] = useState<File>();
  const [conversionMode, setConversionMode] = useState<ConversionMode>();
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
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const selectFile = (selected?: File) => {
    if (!selected) return;

    if (!conversionMode) {
      setError("Selecione o tipo de conversão antes de escolher o projeto.");
      return;
    }

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
    if (
      !file ||
      !conversionMode ||
      stage === "analyzing" ||
      stage === "processing" ||
      stage === "building" ||
      stage === "validating"
    ) {
      return;
    }

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
      }

      /*
       * ============================================================
       * GEN4 NORMAL → GEN4 SETUP WORK
       * ============================================================
       */
      if (conversionMode === "GEN4_TO_SETUP_WORK") {
        setStage("building");

        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        const result = await buildGen4SetupWorkProject(currentZip, currentAnalysis);

        setStage("validating");

        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        const blob = await result.zip.generateAsync({
          type: "blob",
        });

        const name = file.name.replace(/\.zip$/i, "") + "_SetupWork.zip";

        setDownloadUrl(URL.createObjectURL(blob));
        setOutputName(name);
        setStage("complete");

        return;
      }

      /*
       * ============================================================
       * GEN4 SETUP WORK → GS3
       * ============================================================
       */

      const candidates = currentAnalysis.clients.flatMap((client) =>
        client.farms.flatMap((farm) =>
          farm.fields
            .filter((field) => field.adaptiveCurves.length > 0)
            .map((field) => ({
              field,
              clientName: client.name,
              farmName: farm.name,
            })),
        ),
      );

      const soleCandidate = candidates.length === 1 ? candidates[0] : undefined;

      const fieldId = selectedFieldId ?? soleCandidate?.field.id;

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

  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files[0]);
  };

  const candidateFields = analysis
    ? analysis.clients.flatMap((client) =>
        client.farms.flatMap((farm) =>
          farm.fields
            .filter((field) => field.adaptiveCurves.length > 0)
            .map((field) => ({
              field,
              clientName: client.name,
              farmName: farm.name,
            })),
        ),
      )
    : [];

  const needsFieldSelection =
    conversionMode === "GEN4_SETUP_WORK_TO_GS3" && candidateFields.length > 1 && !selectedFieldId;

  const isBusy = ["analyzing", "processing", "building", "validating"].includes(stage);

  const currentStage =
    stage === "complete" ? stages.length : stages.findIndex((item) => item.key === stage);

  const resetForMode = (mode: ConversionMode) => {
    if (isBusy) return;

    setConversionMode(mode);
    setFile(undefined);
    setAnalysis(undefined);
    setSourceZip(undefined);
    setSelectedFieldId(undefined);
    setDownloadUrl(undefined);
    setOutputName(undefined);
    setError(undefined);
    setDragging(false);
    setStage("idle");
  };

  return (
    <div className="jd-bg min-h-screen text-foreground">
      <header className="jd-header sticky top-0 z-20">
        <div className="mx-auto grid min-h-20 w-full max-w-[1500px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-mark shrink-0" aria-label="John Deere" role="img">
              <img src="/john-deere-logo.png" alt="" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-wide">JOHN DEERE</p>
              <p className="font-mono text-[10px] text-muted-foreground">Gen4 → GS3 Converter</p>
            </div>
          </div>



          <div className="flex shrink-0 items-center justify-end gap-2">
            <span className="jd-online-status">
              <span className="jd-online-dot" /> Online
            </span>

          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-5 pb-10 pt-8 md:px-8 md:pt-10">
        <div className="flex w-full min-w-0 flex-col gap-6">
          <section className="jd-hero text-center">
            <h1 className="text-5xl font-bold leading-none tracking-tight md:text-6xl">
              Gen4 <span className="text-primary">→</span> <span className="text-primary">GS3</span> Converter
            </h1>
            <p className="mx-auto mt-3 max-w-3xl text-base leading-7 text-white/90 md:text-lg">
              Converta projetos do Gen4 (Normal ou Setup Work) para o formato GS3
            </p>
            <div className="jd-format-pills" aria-label="Selecione o tipo de conversão">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => resetForMode("GEN4_TO_SETUP_WORK")}
                aria-pressed={conversionMode === "GEN4_TO_SETUP_WORK"}
                className={`jd-mode-pill ${conversionMode === "GEN4_TO_SETUP_WORK" ? "is-selected" : ""}`}
              >
                <SlidersHorizontal /> Gen4 Normal
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => resetForMode("GEN4_SETUP_WORK_TO_GS3")}
                aria-pressed={conversionMode === "GEN4_SETUP_WORK_TO_GS3"}
                className={`jd-mode-pill ${conversionMode === "GEN4_SETUP_WORK_TO_GS3" ? "is-selected" : ""}`}
              >
                <Layers /> Gen4 Setup Work
              </button>
              <span><Crosshair /> GS3</span>
            </div>
          </section>

          <section className="jd-converter">
            <div className="jd-upload-card">
              <label
                htmlFor="gen4-project-file"
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!isBusy) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={drop}
                className={`drop-zone ${dragging ? "drop-active" : ""} ${isBusy ? "cursor-wait opacity-80" : ""}`}
              >
                <input
                  id="gen4-project-file"
                  type="file"
                  accept=".zip"
                  className="sr-only"
                  onChange={(event) => selectFile(event.target.files?.[0])}
                  disabled={isBusy || !conversionMode}
                />
                {isBusy ? (
                  <LoaderCircle className="size-14 animate-spin text-primary" />
                ) : (
                  <CloudUpload className="size-14" />
                )}
                <p className="mt-3 max-w-full break-all text-lg font-semibold">
                  {file ? file.name : "Arraste e solte o arquivo do projeto Gen4 aqui"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">ou clique para selecionar</p>
                <span className="jd-select-file"> <FileArchive /> Selecionar Projeto Gen4 </span>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  Formatos aceitos: .zip (projeto Gen4)
                </p>
              </label>
            </div>

            <div className="jd-conversion-flow">
              <span><FileArchive /> <b>Gen4 Normal</b></span>
              <span className="jd-flow-or">ou</span>
              <span><FileArchive /> <b>Gen4 Setup Work</b></span>
              <span className="jd-flow-arrow">→</span>
              <span className="jd-flow-target"><FileArchive /> <b>GS3</b></span>
              <button
                type="button"
                onClick={() => void convert()}
                disabled={isBusy || !conversionMode || needsFieldSelection || !file || stage === "complete"}
                className="jd-convert-button"
              >
                {isBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
                {needsFieldSelection ? "Selecione um Field" : "Iniciar Conversão"}
              </button>
            </div>
          </section>
        </div>
        <div className="w-full min-w-0 text-center">
          {file && (
            <section className="glass mt-6 p-6">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="min-w-0">
                  <p className="section-kicker">Projeto selecionado</p>

                  <h2 className="mt-2 truncate text-lg font-semibold">{file.name}</h2>
                </div>

                {stage === "complete" && (
                  <span className="status-chip status-good">
                    <CheckCircle2 /> conversão concluída
                  </span>
                )}
              </div>

              {file && (
                <p className="mt-4 max-w-full truncate rounded-md border border-border bg-background/40 px-3 py-2 font-mono text-xs text-primary">
                  {file.name}
                </p>
              )}

              {conversionMode === "GEN4_SETUP_WORK_TO_GS3" && candidateFields.length > 1 && (
                <div className="mt-6 rounded-lg border border-border bg-background/20 p-4">
                  <p className="text-sm font-semibold">Selecione o Field para converter</p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    O projeto possui mais de um Field com AdaptiveCurves. A conversão usa o GUID
                    real do Field selecionado.
                  </p>

                  <div className="mx-auto mt-4 max-w-xl space-y-2">
                    {candidateFields.map(({ field, clientName, farmName }) => (
                      <label
                        key={field.id}
                        className="flex cursor-pointer items-start justify-center gap-3 rounded-md border border-border p-3 hover:border-primary/50"
                      >
                        <input
                          type="radio"
                          name="field-selection"
                          value={field.id}
                          checked={selectedFieldId === field.id}
                          onChange={() => setSelectedFieldId(field.id)}
                          className="mt-1 shrink-0"
                        />

                        <span className="min-w-0 text-sm">
                          <span className="block font-semibold">Field: {field.name}</span>

                          <span className="mt-1 block text-xs text-muted-foreground">
                            Client: {clientName} · Farm: {farmName} · AdaptiveCurves:{" "}
                            {field.adaptiveCurves.length}
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

                  let label = item.label;

                  if (item.key === "processing" && conversionMode === "GEN4_TO_SETUP_WORK") {
                    label = "Processando projeto...";
                  }

                  if (item.key === "building" && conversionMode === "GEN4_TO_SETUP_WORK") {
                    label = "Gerando projeto Setup Work...";
                  }

                  return (
                    <div
                      key={item.key}
                      className={`flex items-center justify-center gap-3 rounded-md border px-4 py-3 text-sm ${
                        active
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : done
                            ? "border-primary/30 bg-primary/5 text-foreground"
                            : "border-border bg-background/20 text-muted-foreground"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="size-4 text-primary" />
                      ) : active ? (
                        <LoaderCircle className="size-4 animate-spin text-primary" />
                      ) : (
                        <span className="size-4 rounded-full border border-border" />
                      )}

                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>

              {stage === "complete" && outputName && downloadUrl ? (
                <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
                  <CheckCircle2 className="mx-auto size-10 text-primary" />

                  <h3 className="mt-3 text-lg font-semibold">
                    {conversionMode === "GEN4_TO_SETUP_WORK"
                      ? "Projeto Setup Work pronto"
                      : "Projeto GS3 pronto"}
                  </h3>

                   <p className="mt-1 break-all text-xs text-muted-foreground">{outputName}</p>

                  <a
                    href={downloadUrl}
                    download={outputName}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Download className="size-4" />

                    {conversionMode === "GEN4_TO_SETUP_WORK"
                      ? "Baixar projeto Setup Work"
                      : "Baixar projeto GS3"}
                  </a>
                </div>
              ) : null}
            </section>
          )}

          {!file && (
            <section className="glass empty-state mt-6 flex-col sm:flex-row">
              <FileArchive />

              <div>
                <h2>Pronto para converter</h2>

                <p>Selecione o tipo de conversão e depois um projeto Gen4/GS4.</p>
              </div>
            </section>
          )}

          {error && (
            <div className="notice danger mt-6 justify-center">
              <span>{error}</span>
            </div>
          )}

          <footer className="pb-4 pt-8 text-center font-mono text-[10px] text-muted-foreground">
            <p>
              A análise e a conversão acontecem neste navegador. Nenhum projeto agrícola é enviado.
            </p>

            <p className="mt-1">Desenvolvido por Dev-Wirlan</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
