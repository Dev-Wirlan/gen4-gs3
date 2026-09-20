import { useEffect, useRef, useState, type DragEvent } from "react";
import { CheckCircle2, Download, FileArchive, LoaderCircle, Lock, Upload } from "lucide-react";
import { analyzeGen4Project } from "@/converter/gen4-parser";
import { initializePwa } from "@/lib/pwa";

type ConversionStage = "idle" | "reading" | "analyzing" | "processing" | "building" | "validating" | "complete" | "error";

const stages: Array<{ key: ConversionStage; label: string }> = [
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
  const [analysisSummary, setAnalysisSummary] = useState<{ gjson: number; curves: number }>();
  const [downloadUrl, setDownloadUrl] = useState<string>();

  useEffect(() => {
    void initializePwa();
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const selectFile = async (selected?: File) => {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".zip")) {
      setError("Selecione um arquivo .zip de projeto Gen4/GS4.");
      setStage("error");
      return;
    }

    setFile(selected);
    setError(undefined);
    setDownloadUrl(undefined);
    setStage("reading");

    try {
      setStage("analyzing");
      const result = await analyzeGen4Project(selected);
      const curves = result.analysis.spatial.filter((item) => item.type === "AdaptiveCurve").length;
      setAnalysisSummary({ gjson: result.analysis.gjsonCount, curves });
      setStage("processing");
      await new Promise((resolve) => setTimeout(resolve, 350));
      setStage("building");
      await new Promise((resolve) => setTimeout(resolve, 350));
      setStage("validating");
      await new Promise((resolve) => setTimeout(resolve, 350));

      // The complete GS3 builder is intentionally not invoked here yet.
      // No fabricated or incomplete ZIP is presented as a finished GS3 project.
      setError("O motor de conversão GS3 completo ainda está em implementação. O projeto foi analisado, mas nenhum ZIP de saída foi gerado para evitar uma conversão falsa.");
      setStage("error");
    } catch (cause) {
      setAnalysisSummary(undefined);
      setError(cause instanceof Error ? cause.message : "Não foi possível analisar o projeto.");
      setStage("error");
    }
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void selectFile(event.dataTransfer.files[0]);
  };

  const isBusy = ["reading", "analyzing", "processing", "building", "validating"].includes(stage);
  const currentStage = stages.findIndex((item) => item.key === stage);

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
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
            }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={`drop-zone mt-8 min-h-56 ${dragging ? "drop-active" : ""}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              onChange={(event) => void selectFile(event.target.files?.[0])}
            />
            {isBusy ? <LoaderCircle className="size-12 animate-spin text-primary" /> : <Upload className="size-12 text-primary" />}
            <p className="mt-4 text-base font-semibold">Selecione seu projeto Gen4/GS4</p>
            <p className="mt-1 text-xs text-muted-foreground">Arraste o arquivo aqui ou clique para selecionar · somente .zip</p>
            {file && <p className="mt-4 max-w-full truncate rounded-md border border-border bg-background/40 px-3 py-2 font-mono text-xs text-primary">{file.name}</p>}
          </div>
        </section>

        {file && (
          <section className="glass p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="section-kicker">Projeto selecionado</p>
                <h2 className="mt-2 text-lg font-semibold truncate">{file.name}</h2>
              </div>
              {analysisSummary && (
                <span className="status-chip status-good"><CheckCircle2 /> análise automática</span>
              )}
            </div>

            {analysisSummary && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border bg-background/40 p-4">
                  <span className="text-xs text-muted-foreground">Arquivos GJSON</span>
                  <strong className="mt-1 block font-mono text-xl text-primary">{analysisSummary.gjson}</strong>
                </div>
                <div className="rounded-md border border-border bg-background/40 p-4">
                  <span className="text-xs text-muted-foreground">Curvas identificadas</span>
                  <strong className="mt-1 block font-mono text-xl text-primary">{analysisSummary.curves}</strong>
                </div>
              </div>
            )}

            <div className="mt-6 space-y-2">
              {stages.map((item, index) => {
                const done = currentStage > index || stage === "complete";
                const active = stage === item.key;
                return (
                  <div key={item.key} className={`flex items-center gap-3 rounded-md border px-4 py-3 text-sm ${active ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-background/20 text-muted-foreground"}`}>
                    {done ? <CheckCircle2 className="size-4 text-good" /> : active ? <LoaderCircle className="size-4 animate-spin text-primary" /> : <span className="size-4 rounded-full border border-border" />}
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <button
                type="button"
                disabled
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground opacity-60"
                title="Disponível quando o builder GS3 completo estiver implementado"
              >
                <Download className="size-4" /> Converter para GS3
              </button>
              <p className="mt-2 text-center text-xs text-muted-foreground">A conversão completa será habilitada quando o builder GS3 real estiver concluído e validado.</p>
            </div>
          </section>
        )}

        {!file && (
          <section className="glass empty-state">
            <FileArchive />
            <div>
              <h2>Pronto para converter</h2>
              <p>Selecione um projeto Gen4/GS4 para iniciar a análise automática.</p>
            </div>
          </section>
        )}

        {error && (
          <div className="notice danger">
            <span>{error}</span>
          </div>
        )}

        <footer className="pb-4 text-center font-mono text-[10px] text-muted-foreground">
          A análise acontece neste navegador. Nenhum projeto agrícola é enviado.
        </footer>
      </main>
    </div>
  );
}
