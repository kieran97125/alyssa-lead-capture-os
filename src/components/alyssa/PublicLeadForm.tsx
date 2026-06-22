"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  publicThemeStyle,
  resolvePublicBrandTheme,
} from "@/lib/brandThemes";
import {
  alyssaBranches,
  alyssaDefaultForm,
  alyssaPackages,
  alyssaTreatments,
} from "@/lib/data/alyssaConfig";
import {
  IMAGE_REFERENCE_FOOTER_NOTE,
  getBrandLegalProfile,
  getLegalLinks,
  getLegalFooterText,
  LEGAL_CONSENT_HELPER_TEXT,
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  LEGAL_CONSENT_TEXT,
} from "@/lib/legal/consent";
import {
  getConfiguredMetaPixelIdForBrand,
  isMetaPixelDebugEnabled,
  sendMetaPixelBeacon,
} from "@/lib/metaPixel/client";

type AttributionEnvelope = {
  first_touch_json?: Record<string, unknown>;
  latest_touch_json?: Record<string, unknown>;
  submitted_touch_json?: Record<string, unknown>;
};

type SubmitState = "idle" | "loading" | "success" | "error";

type FormOption = {
  id: string;
  name: string;
};

type TreatmentOption = FormOption & {
  description: string;
};

type PackageOption = FormOption & {
  treatmentId: string;
  promoPrice: number;
  paymentRequired: boolean;
};

type BranchOption = FormOption;

type BrandOption = FormOption & {
  slug: string;
};

type PublicFormConfig = {
  id: string;
  defaultTreatmentId: string;
  defaultPackageId: string;
  defaultBranchId: string;
  allowedDomains: string[];
};

type PublicLeadFormProps = {
  formToken: string;
  formId?: string;
  brandSlug?: string;
  initialQueryString?: string;
  expectedParentOrigin?: string;
  mode?: "inline" | "embed";
  className?: string;
};

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_id",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "ttclid",
  "msclkid",
  "wbraid",
  "gbraid",
  "campaign_id",
  "adset_id",
  "ad_id",
  "ctwa_id",
  "ctwa_clid",
  "meta_ad_id",
  "meta_adset_id",
  "meta_campaign_id",
  "placement",
  "whatsapp_referral_source_id",
];

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value.trim();

  if (!cleaned) return null;

  try {
    return new URL(cleaned).origin.toLowerCase();
  } catch {
    try {
      return new URL(`https://${cleaned}`).origin.toLowerCase();
    } catch {
      return null;
    }
  }
}

function isAllowedParentOrigin(
  candidateOrigin: string | null | undefined,
  allowedDomains: string[]
) {
  const candidate = normalizeOrigin(candidateOrigin);
  if (!candidate) return false;

  const allowedOrigins = allowedDomains
    .map(normalizeOrigin)
    .filter((item): item is string => Boolean(item));

  if (allowedOrigins.includes(candidate)) return true;

  try {
    const candidateUrl = new URL(candidate);
    return allowedDomains.some((domain) => {
      const cleaned = domain.trim().toLowerCase();
      return (
        (cleaned === "localhost" || cleaned === "127.0.0.1") &&
        candidateUrl.hostname === cleaned
      );
    });
  } catch {
    return false;
  }
}

function safeJsonParse(value: string | null) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

function readStorage(key: string, storage: Storage) {
  try {
    return safeJsonParse(storage.getItem(key));
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown, storage: Storage) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function pickParams(searchParams: URLSearchParams) {
  const output: Record<string, string> = {};
  ATTRIBUTION_KEYS.forEach((key) => {
    const value = searchParams.get(key);
    if (value) output[key] = value;
  });
  return output;
}

function normalizeQueryString(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "";
  return cleaned.startsWith("?") ? cleaned : `?${cleaned}`;
}

function createUrlFromSearch(search: string) {
  return `${window.location.origin}${window.location.pathname}${search}${window.location.hash}`;
}

function getEffectiveAttributionUrl(initialQueryString = "") {
  const liveParams = new URLSearchParams(window.location.search);
  const livePayload = pickParams(liveParams);

  if (Object.keys(livePayload).length > 0) {
    return {
      href: window.location.href,
      search: window.location.search,
      sourceUsed: "live",
    };
  }

  const initialSearch = normalizeQueryString(initialQueryString);
  const initialPayload = pickParams(new URLSearchParams(initialSearch));

  if (Object.keys(initialPayload).length > 0) {
    return {
      href: createUrlFromSearch(initialSearch),
      search: initialSearch,
      sourceUsed: "initialSearch",
    };
  }

  return {
    href: window.location.href,
    search: window.location.search,
    sourceUsed: "storage",
  };
}

function classifyTracking(payload: Record<string, unknown>) {
  const utmCount = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_id",
    "utm_content",
    "utm_term",
  ].filter((key) => payload[key]).length;
  const hasClickId = Boolean(
    payload.fbclid ||
      payload.gclid ||
      payload.ttclid ||
      payload.msclkid ||
      payload.wbraid ||
      payload.gbraid
  );

  if (utmCount >= 3) {
    return {
      tracking_status: "complete_utm",
      audit_reason: "utm_found_on_parent_url",
    };
  }

  if (utmCount > 0) {
    return {
      tracking_status: "partial_utm",
      audit_reason: "iframe_received_parent_payload",
    };
  }

  if (hasClickId) {
    return {
      tracking_status: "click_id_only",
      audit_reason: "fbclid_found_without_utm",
    };
  }

  return {
    tracking_status: "organic_unknown",
    audit_reason: "no_url_params_no_storage",
  };
}

function captureCurrentPageAttribution({
  formToken,
  formId,
  brandSlug,
  initialQueryString = "",
}: {
  formToken: string;
  formId: string;
  brandSlug: string;
  initialQueryString?: string;
}): AttributionEnvelope {
  const localKey = "alyssa_first_touch";
  const sessionKey = "alyssa_latest_touch";
  const effectiveUrl = getEffectiveAttributionUrl(initialQueryString);
  const searchParams = new URLSearchParams(effectiveUrl.search);
  const parentOriginParam = normalizeOrigin(searchParams.get("parent_origin"));
  const parentUrlParam = searchParams.get("parent_url") || "";
  let parentPath = window.location.pathname;

  if (parentUrlParam) {
    try {
      parentPath = new URL(parentUrlParam).pathname;
    } catch {
      parentPath = window.location.pathname;
    }
  }

  const visitorId =
    readStorage("alyssa_visitor_id", window.localStorage) || createId("vis");
  const sessionId =
    readStorage("alyssa_session_id", window.sessionStorage) || createId("ses");
  const paramPayload = pickParams(searchParams);
  const firstStored = readStorage(localKey, window.localStorage);
  const latestStored = readStorage(sessionKey, window.sessionStorage);
  const hasCurrentParams = Object.keys(paramPayload).length > 0;
  const sourceCaptureMethod = hasCurrentParams
    ? "public_landing_page"
    : latestStored
      ? "public_landing_page_session_storage_recovered"
      : firstStored
        ? "public_landing_page_local_storage_recovered"
        : "public_landing_page_no_tracking_signal";
  const recoveredCurrentPageUrl =
    getString(latestStored?.current_page_url) ||
    getString(firstStored?.current_page_url);
  const recoveredLandingPageUrl =
    getString(firstStored?.landing_page_url) ||
    getString(latestStored?.landing_page_url);
  const livePageUrl = parentUrlParam || effectiveUrl.href;
  const currentPageUrl = hasCurrentParams
    ? livePageUrl
    : recoveredCurrentPageUrl || livePageUrl;
  const landingPageUrl = hasCurrentParams
    ? livePageUrl
    : recoveredLandingPageUrl || livePageUrl;
  const basePayload = {
    source_capture_method: sourceCaptureMethod,
    visitor_id: visitorId,
    session_id: sessionId,
    brand: brandSlug,
    form_id: formId,
    form_token: formToken,
    parent_origin: parentOriginParam || window.location.origin,
    referrer: document.referrer || "",
    landing_page_url: landingPageUrl,
    current_page_url: currentPageUrl,
    page_path: parentPath,
    page_title: document.title || "",
    preserved_initial_full_url: effectiveUrl.href,
    preserved_initial_search: initialQueryString,
    attribution_source_used: effectiveUrl.sourceUsed,
    captured_at: new Date().toISOString(),
  };
  const latestTouch = {
    ...(latestStored || {}),
    ...basePayload,
    ...paramPayload,
    source_capture_method: sourceCaptureMethod,
  };
  const firstTouch = hasCurrentParams
    ? { ...basePayload, ...paramPayload }
    : firstStored || { ...basePayload, ...paramPayload };
  const localSaved = writeStorage(localKey, firstTouch, window.localStorage);
  const sessionSaved = writeStorage(sessionKey, latestTouch, window.sessionStorage);
  writeStorage("alyssa_visitor_id", visitorId, window.localStorage);
  writeStorage("alyssa_session_id", sessionId, window.sessionStorage);
  const tracking = classifyTracking(latestTouch);
  const submittedTouch = {
    ...latestTouch,
    storage_status:
      localSaved && sessionSaved
        ? "storage_available"
        : localSaved
          ? "session_storage_blocked"
          : sessionSaved
            ? "local_storage_blocked"
            : "storage_blocked",
    ...tracking,
  };

  return {
    first_touch_json: firstTouch,
    latest_touch_json: latestTouch,
    submitted_touch_json: submittedTouch,
  };
}

function normalizeForm(raw: Record<string, unknown>): PublicFormConfig {
  const allowedDomains = raw.allowedDomains ?? raw.allowed_domains;

  return {
    id: getString(raw.id) || alyssaDefaultForm.id,
    defaultTreatmentId:
      getString(raw.defaultTreatmentId) ||
      getString(raw.default_treatment_id) ||
      alyssaDefaultForm.defaultTreatmentId,
    defaultPackageId:
      getString(raw.defaultPackageId) ||
      getString(raw.default_package_id) ||
      alyssaDefaultForm.defaultPackageId,
    defaultBranchId:
      getString(raw.defaultBranchId) ||
      getString(raw.default_branch_id) ||
      alyssaDefaultForm.defaultBranchId,
    allowedDomains: Array.isArray(allowedDomains)
      ? allowedDomains.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function normalizeTreatment(raw: Record<string, unknown>): TreatmentOption {
  return {
    id: getString(raw.id),
    name: getString(raw.name),
    description: getString(raw.description),
  };
}

function normalizePackage(raw: Record<string, unknown>): PackageOption {
  return {
    id: getString(raw.id),
    name: getString(raw.name),
    treatmentId: getString(raw.treatmentId) || getString(raw.treatment_id),
    promoPrice: getNumber(raw.promoPrice ?? raw.promo_price),
    paymentRequired: Boolean(raw.paymentRequired ?? raw.payment_required),
  };
}

function normalizeBranch(raw: Record<string, unknown>): BranchOption {
  return {
    id: getString(raw.id),
    name: getString(raw.name),
  };
}

function normalizeBrand(raw: Record<string, unknown>): BrandOption {
  return {
    id: getString(raw.id),
    name: getString(raw.name) || "Alyssa",
    slug: getString(raw.slug) || "alyssa",
  };
}

function getBrandDisplayOverride(brandSlug?: string | null): BrandOption | null {
  if (brandSlug === "ineffable" || brandSlug === "ineffable-beauty") {
    return {
      id: "ineffable-brand-display",
      name: "Ineffable Beauty",
      slug: "ineffable",
    };
  }

  return null;
}

function isDisplayPackage(item: PackageOption) {
  return item.paymentRequired || item.promoPrice > 0;
}

function getPrimaryPackage(
  form: PublicFormConfig,
  packageOptions: PackageOption[]
) {
  const defaultPackage = packageOptions.find(
    (item) => item.id === form.defaultPackageId
  );

  if (defaultPackage && isDisplayPackage(defaultPackage)) return defaultPackage;

  return packageOptions.find(isDisplayPackage) || defaultPackage || packageOptions[0];
}

async function logPublicEvent(
  eventType: string,
  payload: Record<string, unknown>,
  attribution?: AttributionEnvelope
) {
  const submittedTouch = attribution?.submitted_touch_json ?? {};

  await fetch("/api/public/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: eventType,
      visitor_id: getString(submittedTouch.visitor_id),
      session_id: getString(submittedTouch.session_id),
      event_payload_json: payload,
      page_url: typeof window !== "undefined" ? window.location.href : undefined,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
    }),
  }).catch(() => undefined);
}

function priceLabel(item: PackageOption | undefined) {
  if (!item) return "";
  return item.promoPrice > 0 ? `HK$${item.promoPrice}` : "預約查詢";
}

export function PublicLeadForm({
  formToken,
  formId,
  brandSlug,
  initialQueryString = "",
  expectedParentOrigin,
  mode = "inline",
  className = "",
}: PublicLeadFormProps) {
  const conversionEventSentRef = useRef(false);
  const [attribution, setAttribution] = useState<AttributionEnvelope>({});
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [configMessage, setConfigMessage] = useState("");
  const [formStarted, setFormStarted] = useState(false);
  const [publicForm, setPublicForm] = useState<PublicFormConfig>(() =>
    normalizeForm(alyssaDefaultForm)
  );
  const [treatments, setTreatments] = useState<TreatmentOption[]>(() =>
    alyssaTreatments.map(normalizeTreatment)
  );
  const [packages, setPackages] = useState<PackageOption[]>(() =>
    alyssaPackages.map(normalizePackage)
  );
  const [branches, setBranches] = useState<BranchOption[]>(() =>
    alyssaBranches.map(normalizeBranch)
  );
  const [brand, setBrand] = useState<BrandOption>(() =>
    getBrandDisplayOverride(brandSlug) ??
    normalizeBrand({ id: "alyssa-brand-seed", name: "Alyssa", slug: "alyssa" })
  );
  const [formData, setFormData] = useState({
    honeypot: "",
    customer_name: "",
    phone: "",
    email: "",
    treatment_id: alyssaDefaultForm.defaultTreatmentId,
    package_id: alyssaDefaultForm.defaultPackageId,
    branch_id: alyssaDefaultForm.defaultBranchId,
    appointment_date: "",
    appointment_time: "12:00",
    payment_option: "booking_only",
    legalConsentAccepted: false,
  });

  const selectedTreatment = useMemo(
    () =>
      treatments.find((item) => item.id === formData.treatment_id) ||
      treatments[0],
    [formData.treatment_id, treatments]
  );
  const availablePackages = useMemo(() => {
    const filtered = packages.filter(
      (item) => item.treatmentId === selectedTreatment?.id
    );
    return filtered.length > 0 ? filtered : packages;
  }, [packages, selectedTreatment?.id]);
  const selectedPackage = useMemo(
    () =>
      availablePackages.find((item) => item.id === formData.package_id) ||
      availablePackages[0],
    [availablePackages, formData.package_id]
  );
  const legalProfile = useMemo(() => {
    const resolvedSlug = brand.slug || brandSlug || "alyssa";

    return getBrandLegalProfile({
      brandSlug: resolvedSlug,
      brandName: brand.name || resolvedSlug,
    });
  }, [brand.name, brand.slug, brandSlug]);
  const legalLinks = useMemo(
    () => getLegalLinks(legalProfile.brandSlug),
    [legalProfile.brandSlug]
  );
  const publicTheme = useMemo(
    () =>
      resolvePublicBrandTheme({
        brandSlug: brand.slug || brandSlug,
        brandName: brand.name,
      }),
    [brand.name, brand.slug, brandSlug]
  );
  const themeStyle = useMemo(
    () => publicThemeStyle(publicTheme) as CSSProperties,
    [publicTheme]
  );
  const isEmbed = mode === "embed";

  function buildCompleteRegistrationPayload() {
    return {
      value: selectedPackage?.promoPrice ?? 0,
      currency: "HKD",
      content_name: `${brand.name || "LaunchHub"} registration`,
      content_category: "registration",
    };
  }

  function isFormPixelDebugEnabled() {
    if (isMetaPixelDebugEnabled()) return true;

    try {
      return new URLSearchParams(initialQueryString).get("pixel_debug") === "1";
    } catch {
      return false;
    }
  }

  function logSkippedConversion(reason: string) {
    if (process.env.NODE_ENV === "development" || isFormPixelDebugEnabled()) {
      console.info("[LaunchHub] CompleteRegistration skipped", { reason });
    }
  }

  function logConversionDebug(message: string, data: Record<string, unknown>) {
    if (isFormPixelDebugEnabled()) {
      console.info("[LaunchHub] CompleteRegistration", message, data);
    }
  }

  function handleSuccessfulRegistrationEvent(eventAttribution: AttributionEnvelope) {
    if (conversionEventSentRef.current) return;
    conversionEventSentRef.current = true;

    const payload = buildCompleteRegistrationPayload();

    if (isEmbed) {
      const targetOrigin = normalizeOrigin(expectedParentOrigin);

      if (
        !window.parent ||
        window.parent === window ||
        !targetOrigin ||
        !isAllowedParentOrigin(targetOrigin, publicForm.allowedDomains)
      ) {
        logSkippedConversion("parent_origin_missing_or_not_allowed");
        return;
      }

      logConversionDebug("iframe mode uses parent postMessage", {
        formToken,
        brandSlug: brand.slug || brandSlug || "",
      });
      window.parent.postMessage(
        {
          type: "launchhub:form-submitted",
          event: "CompleteRegistration",
          formToken,
          brandSlug: brand.slug || brandSlug || "",
          value: payload.value,
          currency: payload.currency,
        },
        targetOrigin
      );
      return;
    }

    const fbq = (window as typeof window & {
      fbq?: (...args: unknown[]) => void;
    }).fbq;

    if (typeof fbq !== "function") {
      logSkippedConversion("fbq_not_found");
    } else {
      fbq("track", "CompleteRegistration", payload);
      logConversionDebug("fbq CompleteRegistration attempted", {
        value: payload.value,
        currency: payload.currency,
        content_category: payload.content_category,
      });
    }

    const conversionPixelId = getConfiguredMetaPixelIdForBrand(
      brand.slug || brandSlug
    );

    const beaconResult = sendMetaPixelBeacon({
      pixelId: conversionPixelId,
      eventName: "CompleteRegistration",
      value: payload.value,
      currency: payload.currency,
      contentCategory: payload.content_category,
      eventKey: `complete-registration:${formToken}:${Date.now()}`,
      pageUrl: getString(
        eventAttribution.submitted_touch_json?.current_page_url
      ),
    });

    logConversionDebug("fallback CompleteRegistration beacon handled", {
      sent: beaconResult.sent,
      reason: beaconResult.reason,
      urlCreated: Boolean(beaconResult.url),
      pixelConfigured: Boolean(conversionPixelId),
    });
  }

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch(`/api/public/forms/${formToken}`);
        const result = await response.json();

        if (!response.ok || !result.ok) {
          setConfigMessage("這張表格暫時未能使用，請稍後再試。");
          return;
        }

        setConfigMessage("");

        const nextForm = normalizeForm(result.form ?? {});
        const nextBrand =
          getBrandDisplayOverride(brandSlug) ?? normalizeBrand(result.brand ?? {});
        const nextTreatments = (result.treatments ?? [])
          .map(normalizeTreatment)
          .filter((item: TreatmentOption) => item.id && item.name);
        const nextPackages = (result.packages ?? [])
          .map(normalizePackage)
          .filter((item: PackageOption) => item.id && item.name);
        const nextBranches = (result.branches ?? [])
          .map(normalizeBranch)
          .filter((item: BranchOption) => item.id && item.name);

        setPublicForm(nextForm);
        setBrand(nextBrand);
        if (nextTreatments.length > 0) setTreatments(nextTreatments);
        if (nextPackages.length > 0) setPackages(nextPackages);
        if (nextBranches.length > 0) setBranches(nextBranches);

        const activePackages =
          nextPackages.length > 0
            ? nextPackages
            : alyssaPackages.map(normalizePackage);
        const primaryPackage = getPrimaryPackage(nextForm, activePackages);

        setFormData((current) => ({
          ...current,
          treatment_id: primaryPackage?.treatmentId || nextForm.defaultTreatmentId,
          package_id: primaryPackage?.id || nextForm.defaultPackageId,
          branch_id: nextForm.defaultBranchId,
        }));
      } catch {
        setConfigMessage("這張表格暫時未能讀取，請稍後再試。");
      }
    }

    void loadConfig();
  }, [brandSlug, formToken]);

  useEffect(() => {
    const initialAttribution = captureCurrentPageAttribution({
      formToken,
      formId: formId || publicForm.id,
      brandSlug: brand.slug || brandSlug || "alyssa",
      initialQueryString,
    });
    queueMicrotask(() => setAttribution(initialAttribution));
    void logPublicEvent("form_view", { form_token: formToken }, initialAttribution);

    function onMessage(event: MessageEvent) {
      if (
        expectedParentOrigin &&
        normalizeOrigin(event.origin) !== normalizeOrigin(expectedParentOrigin)
      ) {
        return;
      }
      if (event.data?.type !== "alyssa_attribution_payload") return;
      const nextAttribution = event.data.payload || {};
      setAttribution(nextAttribution);
      void logPublicEvent(
        "parent_attribution_captured",
        nextAttribution,
        nextAttribution
      );
    }

    window.addEventListener("message", onMessage);

    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: "alyssa_iframe_ready" },
        expectedParentOrigin || window.location.origin
      );
    }

    return () => window.removeEventListener("message", onMessage);
  }, [
    brand.slug,
    brandSlug,
    expectedParentOrigin,
    formId,
    formToken,
    initialQueryString,
    publicForm.id,
  ]);

  function updateField(key: keyof typeof formData, value: string) {
    setFormData((current) => {
      if (key === "treatment_id") {
        const nextPackage =
          packages.find(
            (item) => item.treatmentId === value && isDisplayPackage(item)
          ) || packages.find((item) => item.treatmentId === value);

        return {
          ...current,
          treatment_id: value,
          package_id: nextPackage?.id || current.package_id,
        };
      }

      return { ...current, [key]: value };
    });

    if (!formStarted && key !== "honeypot") {
      setFormStarted(true);
      void logPublicEvent("form_start", { field: key }, attribution);
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const liveAttribution = captureCurrentPageAttribution({
      formToken,
      formId: formId || publicForm.id,
      brandSlug: brand.slug || brandSlug || "alyssa",
      initialQueryString,
    });
    queueMicrotask(() => setAttribution(liveAttribution));

    if (!formData.legalConsentAccepted) {
      setState("error");
      setMessage(LEGAL_CONSENT_REQUIRED_MESSAGE);
      await logPublicEvent(
        "form_submit_failed",
        { error: "legal_consent_missing" },
        liveAttribution
      );
      return;
    }

    setState("loading");
    setMessage("正在提交預約資料...");
    await logPublicEvent(
      "form_submit_attempt",
      { form_token: formToken },
      liveAttribution
    );

    try {
      const resolvedFormData = {
        ...formData,
        treatment_id: selectedTreatment?.id || formData.treatment_id,
        package_id: selectedPackage?.id || formData.package_id,
      };
      const response = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...resolvedFormData,
          form_token: formToken,
          form_id: formId || publicForm.id,
          first_touch_json: liveAttribution.first_touch_json || {},
          latest_touch_json: liveAttribution.latest_touch_json || {},
          submitted_touch_json: liveAttribution.submitted_touch_json || {},
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setState("error");
        setMessage(result.message || "未能提交表格，請稍後再試。");
        await logPublicEvent(
          "form_submit_failed",
          { error: result.error || "submission_failed" },
          liveAttribution
        );
        return;
      }

      setState("success");
      handleSuccessfulRegistrationEvent(liveAttribution);
      setMessage("已收到你的登記，我們會盡快透過 WhatsApp 跟進。");
    } catch (error) {
      setState("error");
      setMessage("網絡暫時未能連線，請稍後再試。");
      await logPublicEvent(
        "form_submit_failed",
        { error: error instanceof Error ? error.message : "network_error" },
        liveAttribution
      );
    }
  }

  return (
    <section
      className={`${className} ${isEmbed ? "mx-auto max-w-xl px-4 py-5" : ""}`}
      style={themeStyle}
    >
      <div className="overflow-hidden rounded-[30px] border border-[var(--public-border)] bg-[var(--public-card)] shadow-[0_24px_70px_rgba(216,91,163,0.14)]">
        <div className="bg-gradient-to-br from-[#FFF1F7] via-white to-[#F6F2FF] px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--public-accent)]">
              {brand.name}
            </p>
            <span className="rounded-full border border-[var(--public-border)] bg-white px-3 py-1 text-xs font-bold text-[var(--public-accent)]">
              WhatsApp 跟進
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-[var(--public-heading)]">
            預約療程體驗
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">
            請填寫預約資料，{brand.name} 團隊會透過 WhatsApp 跟進確認。
          </p>
        </div>

        <div className="p-6">
          {configMessage ? (
            <Notice tone="warning" title="表格暫時未能使用">
              <p>{configMessage}</p>
              <p className="mt-3 break-all rounded-2xl bg-white/80 px-4 py-3 font-mono text-xs font-semibold">
                {formToken}
              </p>
            </Notice>
          ) : state === "success" ? (
            <Notice tone="success" title="已收到你的登記">
              <p>{message}</p>
              <p className="mt-3">
                {brand.name} 團隊會透過 WhatsApp 聯絡你，確認療程及預約細節。
              </p>
            </Notice>
          ) : (
            <>
              <section className="rounded-3xl border border-[var(--public-border)] bg-[var(--public-soft-bg)] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--public-accent)]">
                  已選療程
                </p>
                <div className="mt-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-[var(--public-heading)]">
                      {selectedTreatment?.name}
                    </p>
                    {selectedTreatment?.description && (
                      <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">
                        {selectedTreatment.description}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--public-cta)]">
                    {priceLabel(selectedPackage)}
                  </p>
                </div>
              </section>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {["WhatsApp 專人跟進", "清楚預約安排", "資料只作跟進"].map(
                  (item) => (
                    <p
                      key={item}
                      className="rounded-2xl border border-[var(--public-border)] bg-white px-3 py-2 text-center text-xs font-bold text-[var(--public-accent)]"
                    >
                      {item}
                    </p>
                  )
                )}
              </div>

              <form onSubmit={submitForm} className="mt-5 space-y-5">
                <input
                  name="website"
                  aria-hidden="true"
                  autoComplete="off"
                  className="hidden"
                  tabIndex={-1}
                  value={formData.honeypot}
                  onChange={(event) => updateField("honeypot", event.target.value)}
                />

                <FormSection title="療程資料">
                  <Field label="療程">
                    <select
                      className="mt-2 w-full rounded-2xl border border-[var(--public-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                      value={formData.treatment_id}
                      onChange={(event) =>
                        updateField("treatment_id", event.target.value)
                      }
                    >
                      {treatments.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="套餐">
                    <select
                      className="mt-2 w-full rounded-2xl border border-[var(--public-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                      value={selectedPackage?.id || ""}
                      onChange={(event) =>
                        updateField("package_id", event.target.value)
                      }
                    >
                      {availablePackages.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} - {priceLabel(item)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {selectedPackage?.paymentRequired && (
                    <Field label="付款方式">
                      <select
                        className="mt-2 w-full rounded-2xl border border-[var(--public-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                        value={formData.payment_option}
                        onChange={(event) =>
                          updateField("payment_option", event.target.value)
                        }
                      >
                        <option value="booking_only">只預約，稍後確認</option>
                        <option value="pay_now">即時付款</option>
                      </select>
                    </Field>
                  )}
                </FormSection>

                <FormSection title="客人資料">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="姓名">
                      <input
                        required
                        className="mt-2 w-full rounded-2xl border border-[var(--public-border)] px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                        value={formData.customer_name}
                        onChange={(event) =>
                          updateField("customer_name", event.target.value)
                        }
                        placeholder="你的姓名"
                      />
                    </Field>
                    <Field label="電話 / WhatsApp">
                      <input
                        required
                        inputMode="tel"
                        className="mt-2 w-full rounded-2xl border border-[var(--public-border)] px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                        value={formData.phone}
                        onChange={(event) => updateField("phone", event.target.value)}
                        placeholder="9123 4567"
                      />
                    </Field>
                  </div>

                  <Field label="Email">
                    <input
                      type="email"
                      className="mt-2 w-full rounded-2xl border border-[var(--public-border)] px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                      value={formData.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      placeholder="name@example.com"
                    />
                  </Field>
                </FormSection>

                <FormSection title="預約安排">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="分店">
                      <select
                        className="mt-2 w-full rounded-2xl border border-[var(--public-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                        value={formData.branch_id}
                        onChange={(event) =>
                          updateField("branch_id", event.target.value)
                        }
                      >
                        {branches.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="預約日期">
                      <input
                        required
                        type="date"
                        className="mt-2 w-full rounded-2xl border border-[var(--public-border)] px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                        value={formData.appointment_date}
                        onChange={(event) =>
                          updateField("appointment_date", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="預約時間">
                      <select
                        className="mt-2 w-full rounded-2xl border border-[var(--public-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                        value={formData.appointment_time}
                        onChange={(event) =>
                          updateField("appointment_time", event.target.value)
                        }
                      >
                        {["11:00", "12:00", "14:00", "16:00", "18:00", "19:30"].map(
                          (time) => (
                            <option key={time}>{time}</option>
                          )
                        )}
                      </select>
                    </Field>
                  </div>
                </FormSection>

                <section className="rounded-3xl border border-[var(--public-border)] bg-[var(--public-soft-bg)] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--public-accent)]">
                    條款確認
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[var(--public-muted)]">
                    {LEGAL_CONSENT_HELPER_TEXT}
                  </p>
                  <label className="mt-3 flex items-start gap-3 text-sm font-semibold leading-6 text-[var(--public-heading)]">
                    <input
                      required
                      type="checkbox"
                      aria-label={LEGAL_CONSENT_TEXT}
                      checked={formData.legalConsentAccepted}
                      onChange={(event) => {
                        event.currentTarget.setCustomValidity("");
                        setFormData((current) => ({
                          ...current,
                          legalConsentAccepted: event.target.checked,
                        }));
                        if (event.target.checked && state === "error") {
                          setMessage("");
                          setState("idle");
                        }
                      }}
                      onInvalid={(event) => {
                        event.currentTarget.setCustomValidity(
                          LEGAL_CONSENT_REQUIRED_MESSAGE
                        );
                        setState("error");
                        setMessage(LEGAL_CONSENT_REQUIRED_MESSAGE);
                      }}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--public-border)] text-[var(--public-cta)]"
                    />
                    <span>
                      我已閱讀並同意
                      <a
                        href={legalLinks.privacyPolicyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-[var(--public-accent)] underline underline-offset-4"
                      >
                        《私隱政策》
                      </a>
                      、
                      <a
                        href={legalLinks.termsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-[var(--public-accent)] underline underline-offset-4"
                      >
                        《條款及細則》
                      </a>
                      及
                      <a
                        href={legalLinks.disclaimerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-[var(--public-accent)] underline underline-offset-4"
                      >
                        《免責聲明》
                      </a>
                      ，並同意你們使用我提交的資料作預約、客戶服務及相關跟進用途。
                    </span>
                  </label>
                </section>

                <button
                  disabled={state === "loading"}
                  className="w-full rounded-full bg-[var(--public-cta)] px-5 py-3.5 text-sm font-bold text-[var(--public-cta-text)] shadow-[0_14px_30px_rgba(216,91,163,0.28)] transition hover:bg-[var(--public-cta-hover)] disabled:opacity-60"
                >
                  {state === "loading" ? "正在提交..." : "提交預約資料"}
                </button>
              </form>

              {message && state === "error" && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {message}
                </div>
              )}

              <p className="mt-4 text-center text-xs leading-5 text-[var(--public-muted)]">
                資料只會用作預約、客戶服務及相關跟進用途。
              </p>
              {isEmbed && (
                <PublicLegalFooter
                  footerText={getLegalFooterText(legalProfile)}
                  privacyPolicyUrl={legalProfile.privacyPolicyUrl}
                  termsUrl={legalProfile.termsUrl}
                  disclaimerUrl={legalProfile.disclaimerUrl}
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: "warning" | "success";
  title: string;
  children: ReactNode;
}) {
  const classes =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <section className={`rounded-[26px] border p-6 text-center ${classes}`}>
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="mt-3 text-sm font-semibold leading-6">{children}</div>
    </section>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-[var(--public-border)] bg-white p-4">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[var(--public-accent)]">
        {title}
      </p>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-bold text-[var(--public-heading)]">
      {label}
      {children}
    </label>
  );
}

function PublicLegalFooter({
  footerText,
  privacyPolicyUrl,
  termsUrl,
  disclaimerUrl,
}: {
  footerText: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  disclaimerUrl: string;
}) {
  return (
    <footer className="mt-5 border-t border-[var(--public-border)] pt-4 text-center text-xs font-semibold leading-5 text-[var(--public-muted)]">
      <p>{footerText}</p>
      <p className="mt-1">{IMAGE_REFERENCE_FOOTER_NOTE}</p>
      <nav className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
        <a className="underline underline-offset-4" href={privacyPolicyUrl}>
          私隱政策
        </a>
        <a className="underline underline-offset-4" href={termsUrl}>
          條款及細則
        </a>
        <a className="underline underline-offset-4" href={disclaimerUrl}>
          免責聲明
        </a>
      </nav>
    </footer>
  );
}
