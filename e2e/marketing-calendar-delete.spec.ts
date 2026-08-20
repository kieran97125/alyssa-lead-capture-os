import { expect, test } from "@playwright/test";

test("calendar keeps task rows compact and reveals full details on hover", async ({
  page,
}) => {
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });

  const task = page.locator('[data-calendar-task-title="DEP Reels 上線"]').first();
  await expect(task).toBeVisible();

  const taskHeight = await task.evaluate((element) =>
    element.getBoundingClientRect().height
  );
  expect(taskHeight).toBeLessThanOrEqual(30);

  const preview = task.locator(".calendar-task-preview");
  await expect(preview).toBeHidden();
  await task.hover();
  await expect(preview).toBeVisible();
  await expect(preview.getByText("DEP Reels 上線", { exact: true })).toBeVisible();
});

test("calendar items require confirmation and remain when deletion is cancelled", async ({
  page,
}) => {
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });

  const task = page.locator('[data-calendar-task-title="DEP Reels 上線"]').first();
  await expect(task).toBeVisible();
  await task.hover();

  const deleteButton = task.getByRole("button", {
    name: "刪除事項：DEP Reels 上線",
    exact: true,
  });
  await expect(deleteButton).toBeVisible();

  let confirmationMessage = "";
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    confirmationMessage = dialog.message();
    await dialog.dismiss();
  });
  await deleteButton.click();

  expect(confirmationMessage).toContain("此操作無法復原");
  await expect(page.getByText("DEP Reels 上線").first()).toBeVisible();
  await task.hover();
  await expect(deleteButton).toBeVisible();
});
