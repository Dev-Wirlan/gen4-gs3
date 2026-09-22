import { test, expect } from "@playwright/test";

test.describe("Gen4 → GS3 Converter", () => {
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
      name: "600057.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("PK\\x03\\x04"),
    });
    await expect(page.getByText("600057.zip")).toBeVisible();
    await expect(page.getByRole("button", { name: "Converter para GS3" })).toBeVisible();
    await expect(page.getByText("Lendo projeto Gen4...")).toBeVisible();
  });
});
