import { expect, test } from "@playwright/test";

test("desktop form settings actions keep their compact button height", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1490, height: 1000 });
  await page.goto("/forms/alyssa-main-form-dev-token", {
    waitUntil: "domcontentloaded",
  });

  const card = page.getByTestId("form-settings-card");
  const actions = page.getByTestId("form-settings-actions");
  const buttons = actions.getByRole("button");

  await expect(card).toBeVisible();
  await expect(actions).toBeVisible();
  await expect(buttons).toHaveCount(4);

  const layout = await actions.evaluate((element) => {
    const actionBar = element.getBoundingClientRect();
    const buttonHeights = Array.from(element.querySelectorAll("button"), (button) =>
      button.getBoundingClientRect().height
    );

    return {
      actionBarHeight: actionBar.height,
      buttonHeights,
    };
  });

  expect(layout.actionBarHeight).toBeLessThanOrEqual(64);
  for (const height of layout.buttonHeights) {
    expect(height).toBeGreaterThanOrEqual(28);
    expect(height).toBeLessThanOrEqual(52);
  }
});
