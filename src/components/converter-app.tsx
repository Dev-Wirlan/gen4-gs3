import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  CheckCircle2,
  Download,
  FileArchive,
  LoaderCircle,
  Lock,
  Upload,
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

type ConversionMode =
  | "GEN4_TO_SETUP_WORK"
  | "GEN4_SETUP_WORK_TO_GS3";

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
  const inputRef = useRef<HTMLInputElement>(null);

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

        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );

        const analyzed = await analyzeGen4Project(file);

        currentAnalysis = analyzed.analysis;
        currentZip = analyzed.zip;

        setAnalysis(currentAnalysis);
        setSourceZip(currentZip);

        if (currentAnalysis.zipStatus !== "valid") {
          throw new Error(
            "O projeto Gen4/GS4 não pôde ser validado como ZIP.",
          );
        }
      }

      /*
       * ============================================================
       * GEN4 NORMAL → GEN4 SETUP WORK
       * ============================================================
       */
      if (conversionMode === "GEN4_TO_SETUP_WORK") {
        setStage("building");

        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );

        const result = await buildGen4SetupWorkProject(
          currentZip,
          currentAnalysis,
        );

        setStage("validating");

        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );

        const blob = await result.zip.generateAsync({
          type: "blob",
        });

        const name =
          file.name.replace(/\.zip$/i, "") + "_SetupWork.zip";

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

      const soleCandidate =
        candidates.length === 1 ? candidates[0] : undefined;

      const fieldId =
        selectedFieldId ?? soleCandidate?.field.id;

      if (
        !fieldId ||
        !candidates.some(({ field }) => field.id === fieldId)
      ) {
        throw new Error(
          "Selecione o talhão que deseja converter antes de continuar.",
        );
      }

      setSelectedFieldId(fieldId);

      setStage("processing");

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );

      setStage("building");

      const result = await exportValidatedAdaptiveCurves(
        currentZip,
        currentAnalysis,
        fieldId,
      );

      if (!result.validation.valid) {
        throw new Error(
          result.failures.length
            ? result.failures.join(" ")
            : "O projeto GS3 ainda não passou na validação estrutural necessária para download.",
        );
      }

      setStage("validating");

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );

      const name =
        file.name.replace(/\.zip$/i, "") + "_GS3.zip";

      setDownloadUrl(URL.createObjectURL(result.blob));
      setOutputName(name);
      setStage("complete");
    } catch (cause) {
      setStage("error");

      setError(
        cause instanceof Error
          ? cause.message
          : "A conversão não pôde ser concluída.",
      );
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
            .map((field) => ({
              field,
              clientName: client.name,
              farmName: farm.name,
            })),
        ),
      )
    : [];

  const needsFieldSelection =
    conversionMode === "GEN4_SETUP_WORK_TO_GS3" &&
    candidateFields.length > 1 &&
    !selectedFieldId;

  const isBusy = [
    "analyzing",
    "processing",
    "building",
    "validating",
  ].includes(stage);

  const currentStage =
    stage === "complete"
      ? stages.length
      : stages.findIndex((item) => item.key === stage);

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
    <div className="min-h-screen bg-mesh text-foreground">
      <header className="glass slash-r sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 px-5 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <div
            className="brand-mark"
            aria-label="John Deere"
            role="img"
          >
            <img
              src="/john-deere-logo.png"
              alt=""
              aria-hidden="true"
            />
          </div>

          <div>
            <p className="text-sm font-semibold">
              John Deere Gen4 Converter
            </p>

            <p className="font-mono text-[10px] text-muted-foreground">
              conversão local de projetos John Deere
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <span className="status-chip status-good">
            <Lock /> ARQUIVOS LOCAIS
          </span>

          <span className="status-chip status-primary">
            PWA · OFFLINE
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-10 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-kicker">
            Conversor John Deere
          </p>

          <h1 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
            John Deere Gen4 Converter
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Escolha o tipo de conversão que deseja realizar.
          </p>
        </div>

        <section className="glass mt-8 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                resetForMode("GEN4_TO_SETUP_WORK")
              }
              className={`rounded-lg border p-5 text-left transition-colors ${
                conversionMode === "GEN4_TO_SETUP_WORK"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/20 hover:border-primary/50"
              }`}
            >
              <p className="text-sm font-semibold">
                Gen4 Normal → Gen4 Setup Work
              </p>

              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Converte um projeto Gen4/GS4 normal para o
                formato Gen4 Setup Work.
              </p>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                resetForMode("GEN4_SETUP_WORK_TO_GS3")
              }
              className={`rounded-lg border p-5 text-left transition-colors ${
                conversionMode === "GEN4_SETUP_WORK_TO_GS3"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/20 hover:border-primary/50"
              }`}
            >
              <p className="text-sm font-semibold">
                Gen4 Setup Work → GS3
              </p>

              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Converte um projeto Gen4 Setup Work para GS3.
              </p>
            </button>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() =>
              !isBusy &&
              conversionMode &&
              inputRef.current?.click()
            }
            onKeyDown={(event) => {
              if (
                !isBusy &&
                conversionMode &&
                (event.key === "Enter" ||
                  event.key === " ")
              ) {
                inputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();

              if (!isBusy) {
                setDragging(true);
              }
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={`drop-zone mt-8 min-h-56 ${
              dragging ? "drop-active" : ""
            } ${isBusy ? "cursor-wait opacity-80" : ""}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              onChange={(event) =>
                selectFile(event.target.files?.[0])
              }
            />

            {isBusy ? (
              <LoaderCircle className="size-12 animate-spin text-primary" />
            ) : (
              <Upload className="size-12 text-primary" />
            )}

            <p className="mt-4 text-base font-semibold">
              {conversionMode
                ? "Selecione seu projeto Gen4/GS4"
                : "Selecione primeiro o tipo de conversão"}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Arraste o arquivo aqui ou clique para selecionar ·
              somente .zip
            </p>
          </div>
        </section>

        {file && (
          <section className="glass mt-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="section-kicker">
                  Projeto selecionado
                </p>

                <h2 className="mt-2 truncate text-lg font-semibold">
                  {file.name}
                </h2>
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

            {conversionMode === "GEN4_SETUP_WORK_TO_GS3" &&
              candidateFields.length > 1 && (
                <div className="mt-6 rounded-lg border border-border bg-background/20 p-4">
                  <p className="text-sm font-semibold">
                    Selecione o Field para converter
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    O projeto possui mais de um Field com
                    AdaptiveCurves. A conversão usa o GUID real
                    do Field selecionado.
                  </p>

                  <div className="mt-4 space-y-2">
                    {candidateFields.map(
                      ({ field, clientName, farmName }) => (
                        <label
                          key={field.id}
                          className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:border-primary/50"
                        >
                          <input
                            type="radio"
                            name="field-selection"
                            value={field.id}
                            checked={
                              selectedFieldId === field.id
                            }
                            onChange={() =>
                              setSelectedFieldId(field.id)
                            }
                            className="mt-1"
                          />

                          <span className="min-w-0 text-sm">
                            <span className="block font-semibold">
                              Field: {field.name}
                            </span>

                            <span className="mt-1 block text-xs text-muted-foreground">
                              Client: {clientName} · Farm:{" "}
                              {farmName} · AdaptiveCurves:{" "}
                              {field.adaptiveCurves.length}
                            </span>
                          </span>
                        </label>
                      ),
                    )}
                  </div>
                </div>
              )}

            <div className="mt-6 space-y-2">
              {stages.map((item, index) => {
                const done =
                  currentStage > index ||
                  stage === "complete";

                const active = stage === item.key;

                let label = item.label;

                if (
                  item.key === "processing" &&
                  conversionMode === "GEN4_TO_SETUP_WORK"
                ) {
                  label = "Processando projeto...";
                }

                if (
                  item.key === "building" &&
                  conversionMode === "GEN4_TO_SETUP_WORK"
                ) {
                  label = "Gerando projeto Setup Work...";
                }

                return (
                  <div
                    key={item.key}
                    className={`flex items-center gap-3 rounded-md border px-4 py-3 text-sm ${
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

            {stage === "complete" &&
            outputName &&
            downloadUrl ? (
              <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
                <CheckCircle2 className="mx-auto size-10 text-primary" />

                <h3 className="mt-3 text-lg font-semibold">
                  {conversionMode === "GEN4_TO_SETUP_WORK"
                    ? "Projeto Setup Work pronto"
                    : "Projeto GS3 pronto"}
                </h3>

                <p className="mt-1 text-xs text-muted-foreground">
                  {outputName}
                </p>

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
            ) : (
              <button
                type="button"
                onClick={() => void convert()}
                disabled={
                  isBusy ||
                  !conversionMode ||
                  needsFieldSelection ||
                  !file
                }
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
              >
                {isBusy ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}

                {needsFieldSelection
                  ? "Selecione um Field"
                  : conversionMode === "GEN4_TO_SETUP_WORK"
                    ? "Converter para Setup Work"
                    : conversionMode ===
                        "GEN4_SETUP_WORK_TO_GS3"
                      ? "Converter para GS3"
                      : "Selecione o tipo de conversão"}
              </button>
            )}
          </section>
        )}

        {!file && (
          <section className="glass empty-state mt-6">
            <FileArchive />

            <div>
              <h2>Pronto para converter</h2>

              <p>
                Selecione o tipo de conversão e depois um
                projeto Gen4/GS4.
              </p>
            </div>
          </section>
        )}

        {error && (
          <div className="notice danger mt-6">
            <span>{error}</span>
          </div>
        )}

        <footer className="pb-4 pt-8 text-center font-mono text-[10px] text-muted-foreground">
          <p>
            A análise e a conversão acontecem neste navegador.
            Nenhum projeto agrícola é enviado.
          </p>

          <p className="mt-1">
            Desenvolvido por Dev-Wirlan
          </p>
        </footer>
      </main>
    </div>
  );
}