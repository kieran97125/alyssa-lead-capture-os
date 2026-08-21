import { expect, test } from "@playwright/test";

test("Master can inspect full Lead Sheet versions, phone numbers and before-after evidence", async ({
  page,
}) => {
  await page.goto("/lead-audit", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Lead 變更監察" })).toBeVisible();
  await expect(page.getByText("只限獲授權審核人員")).toBeVisible();
  await expect(page.getByText("同步紀錄")).toBeVisible();
  await expect(page.getByRole("heading", { name: "本次更新有咩改動" })).toBeVisible();
  await expect(page.getByText("上一版本存在嘅 Lead 紀錄已消失。")).toBeVisible();

  await expect(page.getByText("Lead · 85291231234", { exact: true })).toBeVisible();
  await expect(page.getByText("Lead · 85298767788", { exact: true })).toBeVisible();
  await expect(page.getByText(/Lead · \*\*\*\*/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "複製電話" })).toHaveCount(2);

  const modifiedCard = page.getByTestId("lead-audit-change-audit-change-warning");
  const appointmentDateChange = modifiedCard
    .getByText("預約日期", { exact: true })
    .first()
    .locator("..");
  await expect(
    appointmentDateChange.getByText("2026-08-10", { exact: true })
  ).toBeVisible();
  await expect(
    appointmentDateChange.getByText("2026-08-12", { exact: true })
  ).toBeVisible();

  const beforeRow = modifiedCard.getByTestId("lead-audit-before-row");
  const afterRow = modifiedCard.getByTestId("lead-audit-after-row");
  await expect(beforeRow.getByText("更改前完整列", { exact: true })).toBeVisible();
  await expect(afterRow.getByText("更改後完整列", { exact: true })).toBeVisible();
  await expect(beforeRow.locator("[data-field]")).toHaveCount(22);
  await expect(afterRow.locator("[data-field]")).toHaveCount(22);
  await expect(beforeRow.locator('[data-field="phone"]')).toContainText("85298767788");
  await expect(afterRow.locator('[data-field="phone"]')).toContainText("85298767788");
  await expect(beforeRow.locator('[data-field="appointmentDate"]')).toContainText("2026-08-10");
  await expect(afterRow.locator('[data-field="appointmentDate"]')).toContainText("2026-08-12");
  await expect(beforeRow.getByRole("button", { name: "複製更改前完整列" })).toBeVisible();
  await expect(afterRow.getByRole("button", { name: "複製更改後完整列" })).toBeVisible();

  await expect(page.getByRole("link", { name: /Lead 變更監察 2/ })).toBeVisible();
  await expect(page.getByText("Version diff")).toHaveCount(0);
  await expect(page.getByText(/LEAD_AUDIT_ENCRYPTION_KEY/)).toHaveCount(0);
});

test("Lead Audit remains usable on mobile with full phone and row snapshots", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lead-audit", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("同步紀錄")).toBeVisible();
  await expect(page.getByRole("button", { name: "套用篩選" })).toBeVisible();
  await expect(page.getByText("Lead · 85291231234", { exact: true })).toBeVisible();
  await expect(page.getByText("更改前完整列", { exact: true }).first()).toBeVisible();
});
