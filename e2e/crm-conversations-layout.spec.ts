import { expect, test } from "@playwright/test";

test("desktop CRM conversations stay in the approved horizontal row layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/crm?tab=leads&range=all", { waitUntil: "domcontentloaded" });

  const screen = page.getByTestId("crm-conversations-screen");
  const table = page.getByTestId("crm-inbox-table");
  await expect(screen).toBeVisible();
  await expect(table).toBeVisible();
  await expect(page.getByTestId("login-screen")).toHaveCount(0);

  for (const heading of [
    "Last contact",
    "Assigned to",
    "Customer",
    "WhatsApp",
    "Status",
    "Phone",
    "Treatment / offer",
    "Preferred appointment",
    "Actions",
  ]) {
    await expect(page.getByRole("columnheader", { name: heading, exact: true })).toBeVisible();
  }

  const tableLayout = await table.evaluate((element) => {
    const tableElement = element as HTMLTableElement;
    return {
      display: getComputedStyle(tableElement).display,
      width: tableElement.getBoundingClientRect().width,
    };
  });
  expect(tableLayout.display).toBe("table");
  expect(tableLayout.width).toBeGreaterThanOrEqual(1380);

  const rows = page.getByTestId("crm-inbox-row");
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);
  for (let index = 0; index < rowCount; index += 1) {
    const row = rows.nth(index);
    await expect(row).toHaveCSS("display", "table-row");
    expect(await row.locator("td").count()).toBeGreaterThanOrEqual(13);
    await expect(row.getByTitle("Open lead")).toBeVisible();
  }

  await expect(screen).toHaveScreenshot("alyssa-crm-desktop-reference.png", {
    animations: "disabled",
    mask: [table.locator("tbody")],
  });
});
