import { expect, test } from "@playwright/test";

test("calendar items require confirmation and remain when deletion is cancelled", async ({
  page,
}) => {
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });

  const deleteButton = page.getByRole("button", {
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
  await expect(page.getByText("DEP Reels 上線")).toBeVisible();
  await expect(deleteButton).toBeVisible();
});
