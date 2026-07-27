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

function customerChoiceConfig() {
  const packages = [
    ["two-year-s", "兩年激脫計劃", "SMALL", 980],
    ["two-year-m", "兩年激脫計劃", "MEDIUM", 1390],
    ["two-year-l", "兩年激脫計劃", "LARGE", 1880],
    ["two-year-xl", "兩年激脫計劃", "X-LARGE", 2380],
    ["permanent-s", "永久脫毛", "SMALL", 1980],
    ["permanent-m", "永久脫毛", "MEDIUM", 2780],
    ["permanent-l", "永久脫毛", "LARGE", 3680],
    ["permanent-xl", "永久脫毛", "X-LARGE", 4680],
  ].map(([id, groupName, name, price], index) => ({
    id,
    treatment_id: treatmentId,
    group_name: groupName,
    name,
    promo_price: price,
    payment_required: false,
    display_order: index,
  }));

  return {
    ...publicFormConfig(),
    form: {
      ...publicFormConfig().form,
      default_package_id: "two-year-m",
      package_selection_mode: "customer_choice",
    },
    packages,
  };
}

function pixelConfiguredForm() {
  return {
    ...publicFormConfig(),
    brand: {
      ...publicFormConfig().brand,
      meta_pixel_id: "123456789012345",
    },
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

test("GOS compact form lets customers choose one of eight configured pricing items", async ({
  page,
}) => {
  let submittedPayload: Record<string, unknown> | null = null;

  await page.route(`**/api/public/forms/${formToken}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(customerChoiceConfig()),
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
        lead_id: "gos-choice-lead",
        event_id: "gos-choice-event",
        event_payload: { value: 4680, currency: "HKD" },
      }),
    });
  });

  await page.goto(
    `/embed/${formToken}?brand=gos-beauty&form_id=${formId}`,
    { waitUntil: "domcontentloaded" }
  );

  const itemSelect = page.getByLabel("選擇預約項目");
  const itemSummary = page.getByRole("region", { name: "預約項目" });
  await expect(itemSelect).toBeVisible();
  await expect(itemSelect.locator("option")).toHaveCount(8);
  await expect(itemSelect.locator("optgroup")).toHaveCount(2);
  await expect(itemSummary).toContainText("MEDIUM");
  await expect(itemSummary).toContainText("HK$1390");

  await itemSelect.selectOption("permanent-xl");
  await expect(itemSummary).toContainText("X-LARGE");
  await expect(itemSummary).toContainText("HK$4680");

  await page.getByLabel("姓名").fill("GOS Choice");
  await page.getByLabel("聯絡電話").fill("98765432");
  await page.getByLabel("預約日期").fill("2026-08-08");
  await page.getByLabel("預約時間").selectOption("18:00");
  await page
    .getByRole("checkbox", { name: "我已閱讀並同意相關條款。" })
    .check();
  await page.getByRole("button", { name: "提交預約 →" }).click();

  await expect(
    page.getByRole("heading", { name: "已收到你的預約" })
  ).toBeVisible();
  expect(submittedPayload).toMatchObject({
    treatment_id: treatmentId,
    package_id: "permanent-xl",
  });
});

test("GOS form uses the brand Pixel from LaunchHub after a successful lead", async ({
  page,
}) => {
  await page.route(`**/api/public/forms/${formToken}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(pixelConfiguredForm()),
    });
  });
  await page.route("**/api/public/events", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/public/leads", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        lead_id: "gos-pixel-lead",
        event_id: "gos-pixel-event",
        event_payload: { value: 688, currency: "HKD" },
      }),
    });
  });

  await page.goto(
    `/embed/${formToken}?brand=gos-beauty&form_id=${formId}`,
    { waitUntil: "domcontentloaded" }
  );
  await page.getByLabel("姓名").fill("GOS Pixel");
  await page.getByLabel("聯絡電話").fill("92345678");
  await page.getByLabel("預約日期").fill("2026-08-09");
  await page.getByLabel("預約時間").selectOption("16:00");
  await page
    .getByRole("checkbox", { name: "我已閱讀並同意相關條款。" })
    .check();
  await page.getByRole("button", { name: "提交預約 →" }).click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __launchhubMetaPixelLastBeaconUrl?: string | null;
            }
          ).__launchhubMetaPixelLastBeaconUrl || ""
      )
    )
    .toContain("id=123456789012345");
  const pixelRequestUrl = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __launchhubMetaPixelLastBeaconUrl?: string | null;
        }
      ).__launchhubMetaPixelLastBeaconUrl || ""
  );
  const pixelUrl = new URL(pixelRequestUrl);
  expect(pixelUrl.searchParams.get("ev")).toBe("CompleteRegistration");
  expect(pixelUrl.searchParams.get("cd[value]")).toBe("688");
  expect(pixelUrl.searchParams.get("cd[currency]")).toBe("HKD");
});
