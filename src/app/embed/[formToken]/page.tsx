"use client";

import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
  getBrandLegalProfile,
  getLegalLinks,
  getLegalFooterText,
  LEGAL_CONSENT_HELPER_TEXT,
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  LEGAL_CONSENT_TEXT,
} from "@/lib/legal/consent";

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
};

function normalizeOrigin(value: string | null) {
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

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

function normalizeForm(raw: Record<string, unknown>): PublicFormConfig {
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

  if (defaultPackage && isDisplayPackage(defaultPackage)) {
    return defaultPackage;
  }

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
      page_url:
        typeof window !== "undefined" ? window.location.href : undefined,
      referrer:
        typeof document !== "undefined" ? document.referrer : undefined,
    }),
  }).catch(() => undefined);
}

export default function EmbedFormPage() {
  const params = useParams<{ formToken: string }>();
  const searchParams = useSearchParams();
  const expectedParentOrigin = normalizeOrigin(searchParams.get("parent_origin"));
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
    const brandSlug = brand.slug || searchParams.get("brand") || "alyssa";

    return getBrandLegalProfile({
      brandSlug,
      brandName: brand.name || brandSlug,
    });
  }, [brand.name, brand.slug, searchParams]);
  const legalLinks = useMemo(
    () => getLegalLinks(legalProfile.brandSlug),
    [legalProfile.brandSlug]
  );
  const publicTheme = useMemo(
    () =>
      resolvePublicBrandTheme({
        brandSlug: brand.slug,
        brandName: brand.name,
      }),
    [brand.name, brand.slug]
  );
  const themeStyle = useMemo(
    () => publicThemeStyle(publicTheme) as CSSProperties,
    [publicTheme]
  );

  useEffect(() => {
    async function loadConfig() {
      try {
      const response = await fetch(`/api/public/forms/${params.formToken}`);
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setConfigMessage("這張表格暫時未能使用，請稍後再試。");
        return;
      }

      setConfigMessage("");

      const nextForm = normalizeForm(result.form ?? {});
      const nextBrand = normalizeBrand(result.brand ?? {});
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
        nextPackages.length > 0 ? nextPackages : alyssaPackages.map(normalizePackage);
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
  }, [params.formToken]);

  useEffect(() => {
    const targetOrigin = expectedParentOrigin || window.location.origin;

    function onMessage(event: MessageEvent) {
      if (event.origin !== targetOrigin) return;
      if (event.data?.type !== "alyssa_attribution_payload") return;

      const nextAttribution = event.data.payload || {};
      setAttribution(nextAttribution);
      void logPublicEvent("parent_attribution_captured", nextAttribution, nextAttribution);
      void logPublicEvent(
        "attribution_payload_received",
        nextAttribution,
        nextAttribution
      );
    }

    window.addEventListener("message", onMessage);

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "alyssa_iframe_ready" }, targetOrigin);
    }

    void logPublicEvent("form_iframe_loaded", {
      form_token: params.formToken,
      parent_origin: targetOrigin,
    });
    void logPublicEvent("form_view", { form_token: params.formToken });

    return () => window.removeEventListener("message", onMessage);
  }, [params.formToken, expectedParentOrigin]);

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

    if (!formData.legalConsentAccepted) {
      setState("error");
      setMessage(LEGAL_CONSENT_REQUIRED_MESSAGE);
      await logPublicEvent(
        "form_submit_failed",
        { error: "legal_consent_missing" },
        attribution
      );
      return;
    }

    setState("loading");
    setMessage("甇???雿???...");
    await logPublicEvent("form_submit_attempt", { form_token: params.formToken }, attribution);

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
          form_token: params.formToken,
          form_id: searchParams.get("form_id") || publicForm.id,
          first_touch_json: attribution.first_touch_json || {},
          latest_touch_json: attribution.latest_touch_json || {},
          submitted_touch_json: attribution.submitted_touch_json || {},
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setState("error");
        setMessage(result.message || "未能提交表格，請稍後再試。");
        await logPublicEvent(
          "form_submit_failed",
          { error: result.error || "submission_failed" },
          attribution
        );
        return;
      }

      setState("success");
      setMessage("已收到你的登記，我們會盡快透過 WhatsApp 跟進。");
    } catch (error) {
      setState("error");
      setMessage("網絡暫時未能連線，請稍後再試。");
      await logPublicEvent(
        "form_submit_failed",
        { error: error instanceof Error ? error.message : "network_error" },
        attribution
      );
    }
  }

  return (
    <main
      className="min-h-screen bg-[var(--public-bg)] px-4 py-5 text-[var(--public-text)]"
      style={themeStyle}
    >
      <section className="mx-auto max-w-xl overflow-hidden rounded-[30px] border border-[var(--public-border)] bg-[var(--public-card)] shadow-[0_24px_70px_rgba(58,36,28,0.14)]">
        <div className="bg-[var(--public-dark)] px-6 py-6 text-white">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--public-accent-soft)]">
              {brand.name}
            </p>
            <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold text-[var(--public-accent-soft)]">
              WhatsApp 跟進
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-bold">預約療程體驗</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--public-dark-muted)]">
            &#x8ACB;&#x586B;&#x5BEB;&#x9810;&#x7D04;&#x8CC7;&#x6599;&#xFF0C;{brand.name} &#x5718;&#x968A;&#x6703;&#x900F;&#x904E; WhatsApp &#x8DDF;&#x9032;&#x78BA;&#x8A8D;&#x3002;
          </p>
        </div>

        <div className="p-6">
          {configMessage ? (
            <section className="rounded-[26px] border border-amber-200 bg-amber-50 p-6 text-center">
              <p className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-600 text-lg font-bold text-white">
                !
              </p>
              <h2 className="mt-4 text-2xl font-bold text-amber-950">
                銵冽?急?銝雿輻
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-amber-800">
                {configMessage}
              </p>
              <p className="mt-4 break-all rounded-2xl bg-white/80 px-4 py-3 font-mono text-xs font-semibold text-amber-900">
                {params.formToken}
              </p>
            </section>
          ) : state === "success" ? (
            <section className="rounded-[26px] border border-emerald-200 bg-emerald-50 p-6 text-center">
              <p className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-600 text-lg font-bold text-white">
                摰?
              </p>
              <h2 className="mt-4 text-2xl font-bold text-emerald-950">
                撌脫?圈?蝝???
              </h2>
              <p className="mt-3 text-sm leading-6 text-emerald-800">{message}</p>
              <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-emerald-900">
                {brand.name} &#x5718;&#x968A;&#x6703;&#x900F;&#x904E; WhatsApp &#x806F;&#x7D61;&#x4F60;&#xFF0C;&#x78BA;&#x8A8D;&#x7642;&#x7A0B;&#x540C;&#x9810;&#x7D04;&#x7D30;&#x7BC0;&#x3002;
              </p>
            </section>
          ) : (
            <>
              <section className="rounded-3xl border border-[var(--public-border)] bg-[var(--public-soft-bg)] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--public-accent)]">
                  撌脤??
                </p>
                <div className="mt-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold">{selectedTreatment?.name}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">
                      {selectedTreatment?.description}
                    </p>
                  </div>
                  <p className="shrink-0 rounded-full bg-[var(--public-card)] px-4 py-2 text-sm font-bold text-[var(--public-cta)]">
                    {selectedPackage?.promoPrice > 0
                      ? `$${selectedPackage.promoPrice}`
                      : "?祥"}
                  </p>
                </div>
              </section>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {["WhatsApp 專人跟進", "清楚預約安排", "資料只作跟進"].map(
                  (item) => (
                    <p
                      key={item}
                      className="rounded-2xl border border-[var(--public-border)] bg-[var(--public-card)] px-3 py-2 text-center text-xs font-bold text-[var(--public-accent)]"
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

                <FormSection title="???賊?">
                  <Field label="??">
                    <select
                      className="focus-ring mt-2 w-full rounded-2xl border border-[var(--public-border)] bg-[var(--public-card)] px-4 py-3 text-sm"
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

                  <Field label="憟?">
                    <select
                      className="focus-ring mt-2 w-full rounded-2xl border border-[var(--public-border)] bg-[var(--public-card)] px-4 py-3 text-sm"
                      value={selectedPackage?.id || ""}
                      onChange={(event) =>
                        updateField("package_id", event.target.value)
                      }
                    >
                      {availablePackages.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} - {item.promoPrice > 0 ? `$${item.promoPrice}` : "?祥"}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {selectedPackage?.paymentRequired && (
                    <Field label="付款方式">
                      <select
                        className="focus-ring mt-2 w-full rounded-2xl border border-[var(--public-border)] bg-[var(--public-card)] px-4 py-3 text-sm"
                        value={formData.payment_option}
                        onChange={(event) =>
                          updateField("payment_option", event.target.value)
                        }
                      >
                        <option value="pay_now">即時付款</option>
                        <option value="booking_only">只預約，稍後確認</option>
                      </select>
                    </Field>
                  )}
                </FormSection>

                <FormSection title="雿?鞈?">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="憪?">
                      <input
                        required
                        className="focus-ring mt-2 w-full rounded-2xl border border-[var(--public-border)] px-4 py-3 text-sm"
                        value={formData.customer_name}
                        onChange={(event) =>
                          updateField("customer_name", event.target.value)
                        }
                        placeholder="雿?蝔勗"
                      />
                    </Field>
                    <Field label="WhatsApp ?餉店">
                      <input
                        required
                        inputMode="tel"
                        className="focus-ring mt-2 w-full rounded-2xl border border-[var(--public-border)] px-4 py-3 text-sm"
                        value={formData.phone}
                        onChange={(event) => updateField("phone", event.target.value)}
                        placeholder="9123 4567"
                      />
                    </Field>
                  </div>

                  <Field label="?駁嚗憛恬?">
                    <input
                      type="email"
                      className="focus-ring mt-2 w-full rounded-2xl border border-[var(--public-border)] px-4 py-3 text-sm"
                      value={formData.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      placeholder="name@example.com"
                    />
                  </Field>
                </FormSection>

                <FormSection title="???末">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="??">
                      <select
                        className="focus-ring mt-2 w-full rounded-2xl border border-[var(--public-border)] bg-[var(--public-card)] px-4 py-3 text-sm"
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
                    <Field label="?交?">
                      <input
                        type="date"
                        className="focus-ring mt-2 w-full rounded-2xl border border-[var(--public-border)] px-4 py-3 text-sm"
                        value={formData.appointment_date}
                        onChange={(event) =>
                          updateField("appointment_date", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="??">
                      <select
                        className="focus-ring mt-2 w-full rounded-2xl border border-[var(--public-border)] bg-[var(--public-card)] px-4 py-3 text-sm"
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
                    璇狡蝣箄?
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[var(--public-muted)]">
                    {LEGAL_CONSENT_HELPER_TEXT}
                  </p>
                  <label className="mt-3 flex items-start gap-3 text-sm font-semibold leading-6 text-[var(--public-cta)]">
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
                      ?歇?梯?銝血???
                      <a
                        href={legalLinks.privacyPolicyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-[var(--public-accent)] underline underline-offset-4"
                      >
                        ???望蝑?
                      </a>
                      ??
                      <a
                        href={legalLinks.termsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-[var(--public-accent)] underline underline-offset-4"
                      >
                        ??甈曉?蝝啣???
                      </a>
                      ??
                      <a
                        href={legalLinks.disclaimerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-[var(--public-accent)] underline underline-offset-4"
                      >
                        ??鞎祈??
                      </a>
                      嚗蒂??雿蝙?冽??漱???????恥?嗆????賊?頝脩??
                    </span>
                  </label>
                </section>

                <button
                  disabled={state === "loading"}
                  className="w-full rounded-full bg-[var(--public-cta)] px-5 py-3.5 text-sm font-bold text-[var(--public-cta-text)] shadow-[0_14px_30px_rgba(200,104,60,0.28)] transition hover:bg-[var(--public-cta-hover)] disabled:opacity-60"
                >
                  {state === "loading" ? "?漱銝?.." : "蝣箄???"}
                </button>
              </form>

              {message && state === "error" && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {message}
                </div>
              )}

              <p className="mt-4 text-center text-xs leading-5 text-[var(--public-muted)]">
                雿?鞈??芣??其???頝脣???隢株岷摰???
              </p>
              <PublicLegalFooter
                footerText={getLegalFooterText(legalProfile)}
                privacyPolicyUrl={legalProfile.privacyPolicyUrl}
                termsUrl={legalProfile.termsUrl}
                disclaimerUrl={legalProfile.disclaimerUrl}
              />
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[var(--public-border)] bg-[var(--public-card)] p-4">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[var(--public-accent)]">
        {title}
      </p>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold text-[var(--public-cta)]">
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
      <nav className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
        <a
          className="underline underline-offset-4"
          href={privacyPolicyUrl}
          target="_blank"
          rel="noreferrer"
        >
          蝘?輻?
        </a>
        <a
          className="underline underline-offset-4"
          href={termsUrl}
          target="_blank"
          rel="noreferrer"
        >
          璇狡?敦??
        </a>
        <a
          className="underline underline-offset-4"
          href={disclaimerUrl}
          target="_blank"
          rel="noreferrer"
        >
          ?痊?脫?
        </a>
        <a className="underline underline-offset-4" href="#top">
          ?舐窗 / ??
        </a>
      </nav>
    </footer>
  );
}
