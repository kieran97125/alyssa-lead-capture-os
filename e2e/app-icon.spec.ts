import { expect, test } from "@playwright/test";

test("browser and install surfaces expose the Growth OS icon", async ({ page, request }) => {
  await page.goto("/login");

  const iconHrefs = await page
    .locator('link[rel="icon"], link[rel="shortcut icon"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
  expect(iconHrefs.some((href) => /icon\.svg|favicon\.ico/.test(href))).toBe(true);

  const appleIcon = page.locator('link[rel="apple-touch-icon"]');
  await expect(appleIcon).toHaveCount(1);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();

  const manifestResponse = await request.get(manifestHref!);
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: "Alyssa Growth OS",
    short_name: "Growth OS",
    start_url: "/dashboard",
    display: "standalone",
    theme_color: "#5a2348",
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "/icons/growth-os-192.png", sizes: "192x192" }),
      expect.objectContaining({ src: "/icons/growth-os-512.png", sizes: "512x512" }),
      expect.objectContaining({ purpose: "maskable" }),
    ])
  );
});
