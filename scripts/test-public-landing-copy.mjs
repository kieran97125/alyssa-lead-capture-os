import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(filename, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(`../${filename}`, import.meta.url), "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", code)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
const copyModule = load("src/lib/landingPages/publicCopy.ts");
const base = { brandName: "GOS Beauty", treatmentName: "合成測試療程", packageName: "測試優惠", branchName: "測試分店", currency: "HKD" };
assert.equal(copyModule.getPublicOfferCopy({ ...base, promoPrice: 588 }).formTitle, "登記 HK$588 優惠");
assert.equal(copyModule.getPublicOfferCopy({ ...base, promoPrice: null, originalPrice: 880 }).priceLabel, "HK$880");
for (const promoPrice of [0, -1, "invalid", Infinity]) {
  const copy = copyModule.getPublicOfferCopy({ ...base, promoPrice, originalPrice: 880 });
  assert.equal(copy.priceLabel, "預約查詢", "Explicit invalid/zero promo must never advertise original paid amount");
  assert.ok(!JSON.stringify(copy).includes("880"));
}
for (const originalPrice of [0, -1, "invalid", Infinity, null]) {
  assert.equal(copyModule.getPublicOfferCopy({ ...base, originalPrice }).priceLabel, "預約查詢");
}
assert.ok(!JSON.stringify(copyModule.getPublicOfferCopy(base)).includes("首次"), "Generic renderer cannot assume new-customer eligibility");

let config;
let page;
const mocks = {
  "next/headers": { cookies: async () => ({ get: () => undefined }), headers: async () => new Headers({ host: "public.example.test" }) },
  "next/navigation": { notFound: () => { throw new Error("not_found"); } },
  "@/components/alyssa/MetaPixelPageView": { MetaPixelPageView: () => null },
  "@/components/alyssa/PublicLpAttributionCapture": { PublicLpAttributionCapture: () => null },
  "@/components/alyssa/MotionReveal": { MotionReveal: ({ children }) => React.createElement("div", {}, children), MotionAnchor: ({ children, ...props }) => React.createElement("a", props, children) },
  "@/components/alyssa/PublicLeadForm": { PublicLeadForm: ({ brandSlug }) => React.createElement("form", { "data-brand": brandSlug }) },
  "@/lib/brandThemes": { publicThemeStyle: () => ({}), resolvePublicBrandTheme: ({ brandSlug }) => ({ key: brandSlug }) },
  "@/lib/data/configuration": { getConfigurationData: async () => config },
  "@/lib/attribution/publicAttributionCookie": {
    PUBLIC_ATTRIBUTION_COOKIE_NAME: "synthetic", createPublicAttributionCookiePayload: () => null,
    normalizePublicAttributionFields: value => value, hasPublicAttributionTracking: () => false,
    publicAttributionParamKeys: [], decodePublicAttributionCookie: () => null,
  },
  "@/lib/data/landingPages": { getLandingPageContext: () => ({}), getResolvedLandingPageContentSections: () => [] },
  "@/lib/data/landingPageStore": { getCanonicalLandingPageSlug: value => value, getPublishedLandingPageBySlug: async () => page, isIneffableLandingPageSlug: () => false },
  "@/lib/legal/consent": { IMAGE_REFERENCE_FOOTER_NOTE: "", getBrandLegalProfile: value => value, getLegalFooterLinks: () => [], getLegalFooterText: value => value.brandName },
  "@/lib/metaPixel/configuration": { resolveBrandPixelId: () => null },
  "@/lib/landingPages/publicCopy": copyModule,
};
const route = load("src/app/lp/[slug]/page.tsx", mocks);
for (const [slug, name, promoPrice] of [["gos", "GOS Beauty", 888], ["ineffable", "Ineffable Beauty", 588], ["alyssa", "Alyssa Aesthetics", 780], ["am", "Alyssa Medical", 1280]]) {
  for (const image of ["", "/synthetic-offer.png"]) {
    config = {
      brands: [{ id: "b", name, slug }],
      treatments: [{ id: "t", name: "測試療程", description: "已核實療程介紹" }],
      packages: [{ id: "p", name: "合成優惠", promoPrice, originalPrice: 2000, currency: "HKD" }],
      branches: [{ id: "r", name: "測試分店" }],
      forms: [{ id: "f", brandId: "b", publicFormToken: "synthetic", defaultTreatmentId: "t", defaultPackageId: "p", defaultBranchId: "r" }],
    };
    page = { id: "lp", slug: "synthetic-page", formId: "f", brandId: "b", treatmentId: "t", packageId: "p", branchId: "r", heroTitle: "", heroSubtitle: "", offerImageUrl: image };
    const element = await route.default({ params: Promise.resolve({ slug: page.slug }), searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);
    const expectedPrice = new Intl.NumberFormat("en-HK", { style: "currency", currency: "HKD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(promoPrice);
    assert.ok(html.includes(`登記 ${expectedPrice} 優惠`), `${name} form heading uses actual offer in both image layouts`);
    assert.ok(html.includes(`立即登記 ${expectedPrice} 優惠`), `${name} quick CTA uses actual offer`);
    assert.ok(html.includes(`${name} 團隊會透過 WhatsApp 跟進確認。`));
    assert.ok(html.includes(`data-brand="${slug}"`), "Correct connected form keeps selected brand scope");
    assert.ok(html.includes("測試分店 · 測試療程"));
    assert.ok(!html.includes("$388") && !html.includes("銅鑼灣") && !html.includes("首次體驗"));
    if (slug !== "ineffable") assert.ok(!html.includes("Ineffable Beauty"), "No other brand name leaks into the rendered campaign");
  }
}
page = { ...page, heroTitle: "由團隊核准嘅標題", heroSubtitle: "核准介紹", offerBadge: "已核准現客優惠", ctaText: "了解更多" };
const edited = renderToStaticMarkup(await route.default({ params: Promise.resolve({ slug: page.slug }) }));
for (const text of [page.heroTitle, page.heroSubtitle, page.offerBadge, page.ctaText]) assert.ok(edited.includes(text), "Configured copy always takes precedence over neutral defaults");
page = null;
assert.equal((await route.generateMetadata({ params: Promise.resolve({ slug: "missing" }) })).description, "療程優惠及登記詳情");
console.log("PASS: actual SSR landing route derives every CTA, form heading, brand, price and location from four campaign contexts in both layouts; neutral zero/missing price and approved copy preserved.");
