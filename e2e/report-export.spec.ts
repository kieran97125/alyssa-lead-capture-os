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

    const exportReport = async (format: "pdf" | "pptx") =>
      page.evaluate(
        async (request) => {
          const response = await fetch("/api/internal/reports/export", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(request),
          });
          const bytes = new Uint8Array(await response.arrayBuffer());

          return {
            ok: response.ok,
            status: response.status,
            contentType: response.headers.get("content-type") ?? "",
            contentDisposition:
              response.headers.get("content-disposition") ?? "",
            snapshotId: response.headers.get("x-report-snapshot-id") ?? "",
            prefix: Array.from(bytes.slice(0, 4)),
          };
        },
        { ...baseRequest, format }
      );

    const pdf = await exportReport("pdf");
    expect(pdf.ok, `PDF export returned ${pdf.status}`).toBe(true);
    expect(pdf.contentType).toContain("application/pdf");
    expect(pdf.contentDisposition).toContain(".pdf");
    expect(pdf.snapshotId).toBeTruthy();
    expect(pdf.prefix).toEqual([37, 80, 68, 70]);

    const pptx = await exportReport("pptx");
    expect(pptx.ok, `PPTX export returned ${pptx.status}`).toBe(true);
    expect(pptx.contentType).toContain("presentationml.presentation");
    expect(pptx.contentDisposition).toContain(".pptx");
    expect(pptx.prefix.slice(0, 2)).toEqual([80, 75]);
  });
});
