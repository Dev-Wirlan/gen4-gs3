import { test, expect } from "@playwright/test";
import JSZip from "jszip";

const FIELD_ID = "11111111-1111-4111-8111-111111111111";
const FARM_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_ID = "33333333-3333-4333-8333-333333333333";
const CURVE_ID = "44444444-4444-4444-8444-444444444444";

async function makeMinimalGen4Zip() {
  const zip = new JSZip();
  const masterData = `<?xml version="1.0" encoding="utf-8"?>
<MasterData>
  <Client Guid="${CLIENT_ID}" Name="Cliente Teste" />
  <Farm Guid="${FARM_ID}" Name="Fazenda Teste" ParentGuid="${CLIENT_ID}" />
  <Field Guid="${FIELD_ID}" Name="Talhao Teste" ParentGuid="${FARM_ID}" />
  <AdaptiveCurve Guid="${CURVE_ID}" Name="Curva Teste" ParentGuid="${FIELD_ID}" path="Spatial/Curve.gjson" />
</MasterData>`;
  const gjson = JSON.stringify({
    type: "Feature",
    geometry: {
      type: "MultiLineString",
      coordinates: [[[ -49.1000, -22.1000 ], [ -49.0999, -22.0999 ], [ -49.0998, -22.0998 ]]],
    },
    properties: { referenceLongitude: -49.1000, referenceLatitude: -22.1000 },
  });
  zip.file("MasterData.xml", masterData);
  zip.file("Spatial/Curve.gjson", gjson);
  return zip.generateAsync({ type: "nodebuffer" });
}


test.describe("Gen4 → GS3 Converter", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (error) => console.log(`[PAGE_ERROR] ${error.stack ?? error.message}`));
    page.on("console", (message) => { if (message.type() === "error") console.log(`[CONSOLE_ERROR] ${message.text()}`); });
  });
  test("carrega a tela principal com identidade verde", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Gen4 → GS3 Converter/);
    await expect(page.getByRole("heading", { name: "Gen4 → GS3 Converter" })).toBeVisible();
    await expect(page.getByText("Selecione seu projeto Gen4/GS4")).toBeVisible();
    await expect(page.getByText("PWA · OFFLINE")).toBeVisible();
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#16A34A");
  });

  test("recusa arquivo que não seja ZIP", async ({ page }) => {
    await page.goto("/");
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({
      name: "projeto.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("arquivo inválido"),
    });
    await expect(page.getByText("Selecione um arquivo .zip de projeto Gen4/GS4.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Converter para GS3" })).toHaveCount(0);
  });

  test("aceita ZIP e exibe a etapa de conversão", async ({ page }) => {
    await page.goto("/");
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({
      name: "fixture-gen4.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("PK\\x03\\x04"),
    });
    await expect(page.getByText("fixture-gen4.zip")).toBeVisible();
    await expect(page.getByRole("button", { name: "Converter para GS3" })).toBeVisible();
    await expect(page.getByText("Lendo projeto Gen4...")).toBeVisible();
  });

  test("executa a conversão completa de um ZIP Gen4 mínimo e valida o ZIP GS3", async ({ page }) => {
    const input = page.locator('input[type="file"]');
    const sourceZip = await makeMinimalGen4Zip();

    await page.goto("/");
    await input.setInputFiles({
      name: "fixture-gen4.zip",
      mimeType: "application/zip",
      buffer: sourceZip,
    });

    await expect(page.getByRole("button", { name: "Converter para GS3" })).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Converter para GS3" }).click();

    await expect(page.getByText("Projeto GS3 pronto")).toBeVisible();
    const download = await downloadPromise;
    const output = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of output) chunks.push(Buffer.from(chunk));
    const gs3Zip = await JSZip.loadAsync(Buffer.concat(chunks));

    const names = Object.keys(gs3Zip.files);
    expect(names.some((name) => name.endsWith("/setup.fds"))).toBe(true);
    expect(names.some((name) => name.endsWith("/host"))).toBe(true);
    expect(names.some((name) => name.endsWith("/global.ver"))).toBe(true);
    expect(names.some((name) => name.endsWith("ImportExport.SpatialCatalog"))).toBe(true);
    expect(names.some((name) => name.includes("CurveTrack" + CURVE_ID) && name.endsWith(".fdShape"))).toBe(true);
    expect(names).toContain("RELATORIO_CONVERSAO.txt");

    const report = await gs3Zip.file("RELATORIO_CONVERSAO.txt")?.async("text");
    expect(report).toContain("Status da Conversão Geral: CONCLUÍDA");
    expect(report).toContain("CurveTrack");
    expect(report).toContain("setup.fds");
    expect(report).toContain("SpatialCatalog");
  });
});
