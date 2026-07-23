import { expect, test } from "@playwright/test";

const formToken = "gos-compact-form-test";
const formId = "gos-form-id";
const treatmentId = "gos-treatment-id";
const packageId = "gos-package-id";
const branchId = "gos-branch-id";

function publicFormConfig() {
  return {
    ok: true,
    form: {
      id: formId,
      public_form_token: formToken,
      default_treatment_id: treatmentId,
      default_package_id: packageId,
      default_branch_id: branchId,
      allowed_domains: ["http://127.0.0.1:3000"],
      conversion_mode: "form_submit_pixel",
    },
    brand: {
      id: "gos-brand-id",
      name: "GOS Beauty",
      slug: "gos-beauty",
    },
    treatments: [
      {
        id: treatmentId,
        name: "女士全身柔滑脫毛護理",
        description: "GOS Beauty 新客限定護理",
      },
    ],
    packages: [
      {
        id: packageId,
        treatment_id: treatmentId,
        name: "新客體驗優惠",
        promo_price: 688,
        payment_required: false,
      },
    ],
    branches: [
      {
        id: branchId,
        name: "荔枝角店",
        is_default: true,
      },
    ],
  };
}

test("GOS compact form shows the configured item and submits the short booking flow", async ({
  page,
}) => {
  let submittedPayload: Record<string, unknown> | null = null;

  await page.route(`**/api/public/forms/${formToken}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(publicFormConfig()),
    });
  });
  await page.route("**/api/public/events", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/public/leads", async (route) => {
    submittedPayload = route.request().postDataJSON() as Record<
      string,
      unknown
    >;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        lead_id: "gos-test-lead",
        event_id: "gos-test-event",
        event_payload: { value: 688, currency: "HKD" },
      }),
    });
  });

  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto(
    `/embed/${formToken}?brand=gos-beauty&form_id=${formId}`,
    { waitUntil: "domcontentloaded" }
  );

  const formRoot = page.locator("[data-launchhub-form-root]");
  await expect(formRoot).toHaveAttribute("data-public-form-layout", "compact");
  await expect(
    page.getByRole("heading", { name: "輕鬆預約你的護理" })
  ).toBeVisible();
  await expect(page.getByLabel("預約項目")).toContainText(
    "女士全身柔滑脫毛護理"
  );
  await expect(page.getByLabel("預約項目")).toContainText("新客體驗優惠");
  await expect(page.getByLabel("預約項目")).toContainText("HK$688");
  await expect(page.getByLabel("姓名")).toBeVisible();
  await expect(page.getByLabel("聯絡電話")).toBeVisible();
  await expect(page.getByLabel("預約日期")).toBeVisible();
  await expect(page.getByLabel("預約時間")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByLabel("療程")).toHaveCount(0);
  await expect(page.getByLabel("套餐")).toHaveCount(0);
  await expect(page.getByLabel("分店")).toHaveCount(0);

  const nameBox = await page.getByLabel("姓名").boundingBox();
  const phoneBox = await page.getByLabel("聯絡電話").boundingBox();
  expect(nameBox).not.toBeNull();
  expect(phoneBox).not.toBeNull();
  expect(Math.abs((nameBox?.y ?? 0) - (phoneBox?.y ?? 0))).toBeLessThan(4);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    )
  ).toBe(true);

  await page.getByLabel("姓名").fill("GOS Test");
  await page.getByLabel("聯絡電話").fill("91234567");
  await page.getByLabel("預約日期").fill("2026-08-01");
  await page.getByLabel("預約時間").selectOption("16:00");
  await page
    .getByRole("checkbox", { name: "我已閱讀並同意相關條款。" })
    .check();
  await page.getByRole("button", { name: "提交預約 →" }).click();

  await expect(
    page.getByRole("heading", { name: "已收到你的預約" })
  ).toBeVisible();
  expect(submittedPayload).toMatchObject({
    form_token: formToken,
    form_id: formId,
    customer_name: "GOS Test",
    phone: "91234567",
    appointment_date: "2026-08-01",
    appointment_time: "16:00",
    treatment_id: treatmentId,
    package_id: packageId,
    branch_id: branchId,
    legalConsentAccepted: true,
  });
});

test("GOS compact form stacks the four fields on mobile without overflow", async ({
  page,
}) => {
  await page.route(`**/api/public/forms/${formToken}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(publicFormConfig()),
    });
  });
  await page.route("**/api/public/events", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/embed/${formToken}?brand=gos-beauty&form_id=${formId}`,
    { waitUntil: "domcontentloaded" }
  );

  await expect(page.getByLabel("姓名")).toBeVisible();
  const mobileLayout = await page.evaluate(() => {
    const name = document.querySelector<HTMLInputElement>(
      'input[autocomplete="name"]'
    );
    const phone = document.querySelector<HTMLInputElement>(
      'input[autocomplete="tel"]'
    );

    return {
      stacked:
        Boolean(name && phone) &&
        Math.abs(
          (name?.getBoundingClientRect().left ?? 0) -
            (phone?.getBoundingClientRect().left ?? 0)
        ) < 4 &&
        (phone?.getBoundingClientRect().top ?? 0) >
          (name?.getBoundingClientRect().bottom ?? 0),
      noOverflow:
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    };
  });

  expect(mobileLayout.stacked).toBe(true);
  expect(mobileLayout.noOverflow).toBe(true);
});
