import { expect, test } from "@playwright/test";

const defaultFormToken = "alyssa-main-form-dev-token";

test("embed response contains a ready form instead of a loading-only shell", async ({
  request,
}) => {
  const response = await request.get(`/embed/${defaultFormToken}`);
  expect(response.ok()).toBe(true);

  const html = await response.text();
  expect(html).toContain("提交預約資料");
  expect(html).not.toContain("表格載入中...");
});

test("server-bootstrapped embed skips the duplicate browser config request", async ({
  page,
}) => {
  let browserConfigRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes(`/api/public/forms/${defaultFormToken}`)) {
      browserConfigRequests += 1;
    }
  });

  await page.goto(`/embed/${defaultFormToken}`, {
    waitUntil: "networkidle",
  });
  await expect(
    page.getByRole("button", { name: "提交預約資料" })
  ).toBeVisible();
  expect(browserConfigRequests).toBe(0);
});
