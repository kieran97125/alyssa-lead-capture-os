import { expect, test } from "@playwright/test";

test("Master can inspect Lead Sheet versions, alerts and before-after evidence", async ({
  page,
}) => {
  await page.goto("/lead-audit", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Lead 變更監察" })).toBeVisible();
  await expect(page.getByText("只限獲授權審核人員")).toBeVisible();
  await expect(page.getByText("同步紀錄")).toBeVisible();
  await expect(page.getByRole("heading", { name: "本次更新有咩改動" })).toBeVisible();
  await expect(page.getByText("上一版本存在嘅 Lead 紀錄已消失。")).toBeVisible();
  const appointmentDateChange = page
    .getByText("預約日期", { exact: true })
    .locator("..");
  await expect(
    appointmentDateChange.getByText("2026-08-10", { exact: true })
  ).toBeVisible();
  await expect(
    appointmentDateChange.getByText("2026-08-12", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Lead 變更監察 2/ })).toBeVisible();
  await expect(page.getByText("Version diff")).toHaveCount(0);
  await expect(page.getByText(/LEAD_AUDIT_ENCRYPTION_KEY/)).toHaveCount(0);
});

test("Lead Audit remains usable on mobile with version history above the diff", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lead-audit", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("同步紀錄")).toBeVisible();
  await expect(page.getByRole("button", { name: "套用篩選" })).toBeVisible();
  await expect(page.getByText("Lead · ****1234")).toBeVisible();
});
