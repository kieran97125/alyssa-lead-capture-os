import { LandingPageView } from "@/components/acquisition/LandingPageView";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { getConfigurationData } from "@/lib/data/configuration";
import {
  PUBLIC_ATTRIBUTION_COOKIE_NAME,
  createPublicAttributionCookiePayload,
  decodePublicAttributionCookie,
  encodePublicAttributionCookie,
  hasPublicAttributionTracking,
  normalizePublicAttributionFields,
  publicAttributionParamKeys,
} from "@/lib/attribution/publicAttributionCookie";
import {
  getCanonicalLandingPageSlug,
  getPublishedLandingPageBySlug,
} from "@/lib/data/landingPageStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function serializeSearchParams(
  params: Record<string, string | string[] | undefined> | undefined
) {
  if (!params) return "";

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
      return;
    }

    if (value) searchParams.set(key, value);
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function getPublicLandingPageUrl(
  slug: string,
  search: string,
  requestOrigin: string | null
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
    requestOrigin ||
    "";

  return baseUrl ? `${baseUrl}/lp/${slug}${search}` : undefined;
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "";
  if (!host) return null;

  const proto =
    headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  return `${proto}://${host.split(",")[0]?.trim()}`;
}

function getInitialAttributionCookieValue(pageUrl: string | undefined) {
  if (!pageUrl) return null;

  try {
    const payload = createPublicAttributionCookiePayload(new URL(pageUrl));
    return payload ? encodePublicAttributionCookie(payload) : null;
  } catch {
    return null;
  }
}

function getServerInitialAttribution(pageUrl: string | undefined) {
  if (!pageUrl) return null;

  try {
    const url = new URL(pageUrl);
    const tracking = normalizePublicAttributionFields(
      Object.fromEntries(
        publicAttributionParamKeys
          .map((key) => [key, url.searchParams.get(key)] as const)
          .filter(([, value]) => Boolean(value))
      )
    );

    if (!hasPublicAttributionTracking(tracking)) return null;

    return {
      source_capture_method: "server_public_lp_initial_search",
      attribution_source_used: "server_initial",
      captured_at: new Date().toISOString(),
      current_page_url: pageUrl,
      landing_page_url: pageUrl,
      page_path: url.pathname,
      ...tracking,
    };
  } catch {
    return null;
  }
}

function getInlineBootstrapAttribution(pageUrl: string | undefined) {
  if (!pageUrl) return null;

  try {
    const url = new URL(pageUrl);
    const tracking = normalizePublicAttributionFields(
      Object.fromEntries(
        publicAttributionParamKeys
        .map((key) => [key, url.searchParams.get(key)] as const)
        .filter(([, value]) => Boolean(value))
      )
    );

    if (!hasPublicAttributionTracking(tracking)) return null;

    return {
      source_capture_method: "server_inline_bootstrap_first_touch",
      attribution_source_used: "inline_bootstrap",
      captured_at: new Date().toISOString(),
      current_page_url: pageUrl,
      landing_page_url: pageUrl,
      page_path: url.pathname,
      ...tracking,
    };
  } catch {
    return null;
  }
}

async function getProxyAttributionPageUrl(initialQueryString: string) {
  if (
    hasPublicAttributionTracking(
      normalizePublicAttributionFields(
        Object.fromEntries(new URLSearchParams(initialQueryString))
      )
    )
  ) {
    return undefined;
  }

  const cookieStore = await cookies();
  const proxyAttribution = decodePublicAttributionCookie(
    cookieStore.get(PUBLIC_ATTRIBUTION_COOKIE_NAME)?.value
  );

  return proxyAttribution?.current_page_url;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedLandingPageBySlug(
    getCanonicalLandingPageSlug(slug)
  );

  if (!page) {
    return {
      title: "Campaign Landing Page",
      description: "療程優惠及登記詳情",
    };
  }

  return {
    title: page.title,
    description:
      page.heroSubtitle ||
      page.offerBody ||
      `${page.title} - 預約體驗及了解療程詳情`,
  };
}

export default async function PublicLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const canonicalSlug = getCanonicalLandingPageSlug(slug);
  const initialQueryString = serializeSearchParams(query);
  const [proxyAttributionPageUrl, requestOrigin] = await Promise.all([
    getProxyAttributionPageUrl(initialQueryString),
    getRequestOrigin(),
  ]);
  const requestPageUrl = getPublicLandingPageUrl(
    canonicalSlug,
    initialQueryString,
    requestOrigin
  );
  const preservedPageUrl =
    proxyAttributionPageUrl ??
    requestPageUrl;
  const inlineBootstrapAttribution =
    getInlineBootstrapAttribution(requestPageUrl);
  const serverInitialAttribution =
    inlineBootstrapAttribution ?? getServerInitialAttribution(preservedPageUrl);
  const initialAttributionCookieValue =
    getInitialAttributionCookieValue(preservedPageUrl);

  const [page, config] = await Promise.all([
    getPublishedLandingPageBySlug(canonicalSlug),
    getConfigurationData({ unscoped: true, strict: true }),
  ]);

  if (!page) notFound();

  return <LandingPageView page={page} config={config} initialQueryString={initialQueryString}
    preservedPageUrl={preservedPageUrl} inlineBootstrapAttribution={inlineBootstrapAttribution}
    serverInitialAttribution={serverInitialAttribution} initialAttributionCookieValue={initialAttributionCookieValue} />;
}
