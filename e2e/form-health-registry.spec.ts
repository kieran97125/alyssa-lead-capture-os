import { expect, test } from "@playwright/test";

const activeFormTokens = [
  "alyssa-facelift-wix-form-290844",
  "alyssa-facelift-wix-form-b69fba",
  "alyssa-facelift-wix-form-1e0378",
  "alyssa-facelift-wix-form-dca655",
  "alyssa-wix-form-8d644a",
  "gos-beauty-wix-form-8544f5",
  "gos-beauty-campaign-form-1ec94c",
  "gos-beauty-campaign-form-e15c54",
  "ineffable-588-dep-combo-form-f50cfb",
  "ineffable-btl-exion-website-form-17eb92",
  "ineffable-beauty-388-3-form-4f4a18",
  "ineffable-beauty-588-form-18d212",
] as const;

test("every audited active form token resolves through the public config contract", async ({
  request,
}) => {
  for (const token of activeFormTokens) {
    const response = await request.get(`/api/public/forms/${token}`);
    expect(response.status(), token).toBe(200);
    const body = await response.json();
    expect(body.ok, token).toBe(true);
    expect(body.form?.public_form_token, token).toBe(token);
    expect(body.treatments?.length, token).toBeGreaterThan(0);
    expect(body.packages?.length, token).toBeGreaterThan(0);
    expect(body.branches?.length, token).toBeGreaterThan(0);
  }
});
