import { createFileRoute } from "@tanstack/react-router";
import { ConverterApp } from "@/components/converter-app";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Gen4 → GS3 Converter | Conversão local" },
    { name: "description", content: "Analise projetos John Deere Gen4 e exporte conversões GS3 validadas, localmente e offline." },
    { property: "og:title", content: "Gen4 → GS3 Converter" },
    { property: "og:description", content: "Análise e conversão local de projetos agrícolas Gen4 para GS3." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return <ConverterApp />;
}
