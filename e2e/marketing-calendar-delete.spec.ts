import { expect, test } from "@playwright/test";

test("calendar items require confirmation before deletion and restore on failure", async ({
  page,
}) => {
  await page.goto("/e2e/calendar-board", { waitUntil: "domcontentloaded" });

  const deleteButton = page.getByRole("button", {
    name: "刪除事項：DEP Reels 上線",
  });
  await expect(deleteButton).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("此操作無法復原");
    await dialog.accept();
  });
  await deleteButton.click();

  await expect(
    page.getByText("Supabase 尚未連接，未能儲存 Command Center 設定。")
  ).toBeVisible();
  await expect(deleteButton).toBeVisible();
});
