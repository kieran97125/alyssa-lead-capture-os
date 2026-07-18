import { expect, test, type FrameLocator, type Page } from "@playwright/test";

const UTM_QUERY =
  "utm_source=meta&utm_medium=paid_social&utm_campaign=IB_DEP_588&utm_content=video_001&fbclid=test123";

async function fillAndSubmitForm(scope: Page | FrameLocator) {
  await scope.getByPlaceholder("你的姓名").fill("UTM TEST CUSTOMER");
  await scope.getByPlaceholder("9123 4567").fill("91234588");
  await scope.getByLabel("分店", { exact: true }).selectOption("central");
  await scope.getByLabel("預約日期").fill("2026-08-15");
  await scope.getByRole("checkbox").check();
  await scope.getByRole("button", { name: "提交預約資料" }).click();
}

function mockSuccessfulLeadResponse() {
  return {
    ok: true,
    lead_id: "e2e-lead-id",
    event_id: "e2e-event-id",
    form_id: "alyssa-main-form",
    conversion_mode: "form_submit_pixel",
    success_redirect_url: null,
    final_redirect_url: null,
    contact_id: "e2e-contact-id",
    source_snapshot_id: "e2e-snapshot-id",
    source_type: "reg_form_utm",
    tracking_status: "complete_utm",
    audit_reason: "utm_captured_from_parent_embed_page",
  };
}

test("direct LaunchHub form submits UTM and click ID in attribution payload", async ({
  page,
}) => {
  let submittedBody: Record<string, unknown> | null = null;
  await page.route("**/api/public/leads", async (route) => {
    submittedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(mockSuccessfulLeadResponse()),
    });
  });

  await page.goto(`/embed/alyssa-main-form-dev-token?${UTM_QUERY}`);
  await expect(page.getByRole("button", { name: "提交預約資料" })).toBeVisible();
  await fillAndSubmitForm(page);

  await expect.poll(() => submittedBody).not.toBeNull();
  const submittedTouch = submittedBody?.submitted_touch_json as Record<
    string,
    unknown
  >;
  expect(submittedTouch.utm_source).toBe("meta");
  expect(submittedTouch.utm_medium).toBe("paid_social");
  expect(submittedTouch.utm_campaign).toBe("IB_DEP_588");
  expect(submittedTouch.utm_content).toBe("video_001");
  expect(submittedTouch.fbclid).toBe("test123");
});

test("Wix parent UTM reaches nested LaunchHub iframe even when iframe URL has no UTM", async ({
  page,
}) => {
  let submittedBody: Record<string, unknown> | null = null;
  await page.route("**/api/public/leads", async (route) => {
    submittedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(mockSuccessfulLeadResponse()),
    });
  });

  await page.goto(`/e2e/attribution-parent?${UTM_QUERY}`);
  const htmlComponent = page.frameLocator('iframe[title="Wix HTML Component"]');
  const formFrame = htmlComponent.frameLocator(
    'iframe[title="Campaign registration form"]'
  );
  await expect(formFrame.getByRole("button", { name: "提交預約資料" })).toBeVisible({
    timeout: 10_000,
  });
  await fillAndSubmitForm(formFrame);

  await expect.poll(() => submittedBody).not.toBeNull();
  const submittedTouch = submittedBody?.submitted_touch_json as Record<
    string,
    unknown
  >;
  expect(submittedTouch.utm_source).toBe("meta");
  expect(submittedTouch.utm_medium).toBe("paid_social");
  expect(submittedTouch.utm_campaign).toBe("IB_DEP_588");
  expect(submittedTouch.utm_content).toBe("video_001");
  expect(submittedTouch.fbclid).toBe("test123");
  expect(submittedTouch.source_capture_method).toBe("wix_page_code");
});

test("first touch survives refresh and a clean follow-up URL", async ({ page }) => {
  await page.goto(`/embed/alyssa-main-form-dev-token?${UTM_QUERY}`);
  await expect(page.getByRole("button", { name: "提交預約資料" })).toBeVisible();

  let submittedBody: Record<string, unknown> | null = null;
  await page.route("**/api/public/leads", async (route) => {
    submittedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(mockSuccessfulLeadResponse()),
    });
  });

  await page.goto("/embed/alyssa-main-form-dev-token");
  await fillAndSubmitForm(page);

  await expect.poll(() => submittedBody).not.toBeNull();
  const firstTouch = submittedBody?.first_touch_json as Record<string, unknown>;
  const submittedTouch = submittedBody?.submitted_touch_json as Record<
    string,
    unknown
  >;
  expect(firstTouch.utm_campaign).toBe("IB_DEP_588");
  expect(submittedTouch.utm_campaign).toBe("IB_DEP_588");
});

test("server classifies submitted attribution using evidence precedence", async ({
  request,
}) => {
  const cases = [
    {
      name: "complete UTM",
      touch: {
        utm_source: "meta",
        utm_medium: "paid_social",
        utm_campaign: "IB_DEP_588",
        utm_content: "video_001",
        fbclid: "test123",
      },
      expected: "complete_utm",
    },
    {
      name: "partial UTM",
      touch: { utm_source: "meta", utm_campaign: "IB_DEP_588" },
      expected: "partial_utm",
    },
    {
      name: "click ID only",
      touch: { fbclid: "test123" },
      expected: "click_id_only",
    },
    {
      name: "CTWA takes precedence over UTM",
      touch: {
        ctwa_id: "ctwa-test-id",
        utm_source: "meta",
        utm_medium: "paid_social",
        utm_campaign: "IB_DEP_588",
      },
      expected: "ctwa_detected",
    },
    {
      name: "no tracking evidence",
      touch: {},
      expected: "organic_unknown",
    },
  ];

  for (const [index, item] of cases.entries()) {
    const response = await request.post("/api/public/leads?attribution_debug=1", {
      headers: { "x-forwarded-for": `198.51.100.${index + 10}` },
      data: {
        form_token: "alyssa-main-form-dev-token",
        form_id: "alyssa-main-form",
        treatment_id: "medical-beauty-trial",
        package_id: "trial-package-388",
        branch_id: "central",
        customer_name: `ATTRIBUTION API TEST ${index}`,
        phone: `91234${String(index + 100).slice(-3)}`,
        email: "attribution-test@example.com",
        appointment_date: "2026-08-15",
        appointment_time: "16:00",
        legalConsentAccepted: true,
        first_touch_json: item.touch,
        latest_touch_json: item.touch,
        submitted_touch_json: item.touch,
      },
    });

    expect(response.status(), item.name).toBe(201);
    const result = (await response.json()) as Record<string, unknown>;
    expect(result.tracking_status, item.name).toBe(item.expected);
    expect(result.source_snapshot_id, item.name).toBeTruthy();
    expect(result.attribution_trace_id, item.name).toBeTruthy();
  }
});
