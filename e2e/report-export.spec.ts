import { expect, test } from "@playwright/test";

test.describe("Growth report exports", () => {
  test.setTimeout(90_000);

  test("supports composable breakdowns and generates PDF plus PPTX", async ({ page }) => {
    await page.goto("/reports", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "報告生成", exact: true })).toBeVisible();
    const noBreakdown = page.getByRole("button", { name: /不拆分/ });
    const brandBreakdown = page.getByRole("button", { name: /按品牌/ });
    const treatmentBreakdown = page.getByRole("button", { name: /按療程/ });
    await expect(noBreakdown).toHaveAttribute("aria-pressed", "true");

    await brandBreakdown.click();
    await treatmentBreakdown.click();
    await expect(brandBreakdown).toHaveAttribute("aria-pressed", "true");
    await expect(treatmentBreakdown).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/不會做品牌 × 療程交叉表/)).toBeVisible();

    await noBreakdown.click();
    await expect(noBreakdown).toHaveAttribute("aria-pressed", "true");
    await expect(brandBreakdown).toHaveAttribute("aria-pressed", "false");
    await expect(treatmentBreakdown).toHaveAttribute("aria-pressed", "false");

    const startDate = await page.getByLabel("開始日期").inputValue();
    const endDate = await page.getByLabel("結束日期").inputValue();
    const baseRequest = {
      startDate,
      endDate,
      brandScope: "",
      comparison: true,
      breakdowns: ["brand", "treatment"],
    };

    const pdf = await page.request.post("/api/internal/reports/export", {
      data: { ...baseRequest, format: "pdf" },
    });
    expect(pdf.ok()).toBe(true);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect(pdf.headers()["content-disposition"]).toContain(".pdf");
    expect(pdf.headers()["x-report-snapshot-id"]).toBeTruthy();
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

    const pptx = await page.request.post("/api/internal/reports/export", {
      data: { ...baseRequest, format: "pptx" },
    });
    expect(pptx.ok()).toBe(true);
    expect(pptx.headers()["content-type"]).toContain("presentationml.presentation");
    expect(pptx.headers()["content-disposition"]).toContain(".pptx");
    expect((await pptx.body()).subarray(0, 2).toString()).toBe("PK");
  });
});
