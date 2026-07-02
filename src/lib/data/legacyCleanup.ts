export type ArchiveView = "active" | "archived" | "all";

export const legacyLandingPageSlugs = [
  "alyssa-uxv2-new-lp-50969-20260615135105-8af3bf",
  "alyssa-uxv2-existing-form-lp-50969-20260615135105-2d0173",
  "alyssa-alyssa-test-lp-campaign-38463d",
  "alyssa-main-trial-offer",
] as const;

export const legacyFormTokens = [
  "alyssa-alyssa-hifu-trial-form-form-27a9bf",
  "alyssa-main-form-dev-token",
  "alyssa-alyssa-test-lp-campaign-form-097743",
  "alyssa-alyssa-test-lp-campaign-form-form-599a6b",
  "alyssa-alyssa-test-wix-form-form-78930d",
  "alyssa-uxv2-new-lp-50969-20260615135105-for-form-36b78f",
  "alyssa-uxv2-wix-form-50969-20260615135105-form-2736b4",
] as const;

const legacyLandingPageSlugSet = new Set<string>(legacyLandingPageSlugs);
const legacyFormTokenSet = new Set<string>(legacyFormTokens);

const legacyTextMatchers = [
  "uxv2",
  "50969",
  "alyssa test",
  "test lp campaign",
  "first-visit trial offer",
];

export function parseArchiveView(value: string | undefined): ArchiveView {
  if (value === "archived" || value === "all") return value;
  return "active";
}

export function isArchivedStatus(status: string | null | undefined) {
  return String(status ?? "").toLowerCase() === "archived";
}

export function isLegacyLandingPageCandidate(page: {
  slug?: string | null;
  title?: string | null;
}) {
  const slug = String(page.slug ?? "").toLowerCase();
  const title = String(page.title ?? "").toLowerCase();
  return (
    legacyLandingPageSlugSet.has(slug) ||
    legacyTextMatchers.some((matcher) => slug.includes(matcher) || title.includes(matcher))
  );
}

export function isLegacyFormCandidate(form: {
  publicFormToken?: string | null;
  formName?: string | null;
}) {
  const token = String(form.publicFormToken ?? "").toLowerCase();
  const name = String(form.formName ?? "").toLowerCase();
  return (
    legacyFormTokenSet.has(token) ||
    legacyTextMatchers.some((matcher) => token.includes(matcher) || name.includes(matcher))
  );
}

export function isHiddenFromActiveView(input: {
  status?: string | null;
  isLegacy: boolean;
}) {
  return isArchivedStatus(input.status) || input.isLegacy;
}

export function matchesArchiveView(
  view: ArchiveView,
  input: { status?: string | null; isLegacy: boolean }
) {
  const hiddenFromActive = isHiddenFromActiveView(input);
  if (view === "active") return !hiddenFromActive;
  if (view === "archived") return hiddenFromActive;
  return true;
}

export function legacyReasonLabel(isLegacy: boolean) {
  return isLegacy ? "Legacy/test cleanup candidate" : "";
}
