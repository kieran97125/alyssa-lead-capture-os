import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import {
  attributionEvidenceScore,
  mergeAttributionEnvelopes,
} from "../src/lib/attribution/bridge";
import { publicAttributionTrackingKeys } from "../src/lib/attribution/publicAttributionCookie";

const UTM_QUERY =
  "utm_source=meta&utm_medium=paid_social&utm_campaign=IB_DEP_588&utm_content=video_001&fbclid=test123";

async function fillAndSubmitForm(scope: Page | FrameLocator) {
  await scope.getByPlaceholder("你的姓名").fill("UTM TEST CUSTOMER");
  await scope.getByPlaceholder("9123 4567").fill("91234588");
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

test("every recognized public tracking key remains eligible attribution evidence", () => {
  for (const key of publicAttributionTrackingKeys) {
    expect(
      attributionEvidenceScore({ [key]: "e2e-value" }),
      `${key} must have a positive acquisition evidence score`
    ).toBeGreaterThan(0);
  }

  expect(attributionEvidenceScore({ lh_placement: "instagram_feed" })).toBeGreaterThan(
    attributionEvidenceScore({ fbp: "fb.1.browser" })
  );
});

test("placement-only parent evidence is preserved as first touch", () => {
  const merged = mergeAttributionEnvelopes(
    {
      first_touch_json: {
        parent_url: "https://brand.example/clean",
        fbp: "fb.1.browser",
      },
    },
    {
      first_touch_json: {
        lh_placement: "instagram_feed",
        source_capture_method: "wix_page_code",
      },
    }
  );

  expect(merged.first_touch_json?.placement).toBe("instagram_feed");
  expect(merged.locked_touch_json?.placement).toBe("instagram_feed");
});

test("evidence tiers and earliest-on-tie behavior remain stable", () => {
  const scores = {
    ctwa: attributionEvidenceScore({ utm_medium: "ctwa" }),
    completeUtm: attributionEvidenceScore({
      utm_source: "meta",
      utm_medium: "paid_social",
      utm_campaign: "summer",
    }),
    partialUtm: attributionEvidenceScore({ utm_source: "meta" }),
    clickId: attributionEvidenceScore({ fbclid: "click-123" }),
    placement: attributionEvidenceScore({ placement: "instagram_feed" }),
    referrer: attributionEvidenceScore({ referrer: "https://example.com" }),
    browserId: attributionEvidenceScore({ fbp: "fb.1.browser" }),
  };

  expect(scores.ctwa).toBeGreaterThan(scores.completeUtm);
  expect(scores.completeUtm).toBeGreaterThan(scores.partialUtm);
  expect(scores.partialUtm).toBeGreaterThan(scores.clickId);
  expect(scores.clickId).toBeGreaterThan(scores.placement);
  expect(scores.placement).toBeGreaterThan(scores.referrer);
  expect(scores.referrer).toBeGreaterThan(scores.browserId);

  expect(attributionEvidenceScore({ campaign_id: "123" })).toBe(
    attributionEvidenceScore({ meta_campaign_id: "123" })
  );
  expect(attributionEvidenceScore({ utm_source: "undefined" })).toBe(0);

  const merged = mergeAttributionEnvelopes(
    {
      first_touch_json: {
        utm_source: "meta",
        utm_medium: "paid_social",
        utm_campaign: "earliest_campaign",
      },
    },
    {
      first_touch_json: {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "later_campaign",
      },
    }
  );
  expect(merged.first_touch_json?.utm_campaign).toBe("earliest_campaign");
});

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

test("Wix placement-only evidence reaches first and submitted touch", async ({
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

  await page.goto("/e2e/attribution-parent?placement=instagram_story");
  const htmlComponent = page.frameLocator('iframe[title="Wix HTML Component"]');
  const formFrame = htmlComponent.frameLocator(
    'iframe[title="Campaign registration form"]'
  );
  await expect(formFrame.getByRole("button", { name: "提交預約資料" })).toBeVisible({
    timeout: 10_000,
  });
  await fillAndSubmitForm(formFrame);

  await expect.poll(() => submittedBody).not.toBeNull();
  const firstTouch = submittedBody?.first_touch_json as Record<string, unknown>;
  const submittedTouch = submittedBody?.submitted_touch_json as Record<
    string,
    unknown
  >;
  expect(firstTouch.placement).toBe("instagram_story");
  expect(submittedTouch.placement).toBe("instagram_story");
});

test("first touch survives refresh and a clean follow-up URL", async ({ page }) => {
  await page.goto(`/embed/alyssa-main-form-dev-token?${UTM_QUERY}`);
  await expect(page.getByRole("button", { name: "提交預約資料" })).toBeVisible();

  const cookieUrl = new URL(page.url()).origin;
  await page.context().addCookies([
    { name: "_fbp", value: "fb.1.browser-only", url: cookieUrl },
    { name: "_fbc", value: "fb.1.browser-only.click", url: cookieUrl },
  ]);

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

  const lockedTouch = await page.evaluate(() => {
    const raw = window.localStorage.getItem("launchhub_locked_attribution");
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  });
  expect(lockedTouch.utm_campaign).toBe("IB_DEP_588");
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
