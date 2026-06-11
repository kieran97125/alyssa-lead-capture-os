"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  alyssaBranches,
  alyssaDefaultForm,
  alyssaPackages,
  alyssaTreatments,
} from "@/lib/data/alyssaConfig";

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
  const [formStarted, setFormStarted] = useState(false);
  const [leadMeta, setLeadMeta] = useState<{
    leadId?: string;
    snapshotId?: string;
    trackingStatus?: string;
  }>({});
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

  useEffect(() => {
    async function loadConfig() {
      const response = await fetch(`/api/public/forms/${params.formToken}`);
      const result = await response.json();

      if (!response.ok || !result.ok) return;

      const nextForm = normalizeForm(result.form ?? {});
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
      if (nextTreatments.length > 0) setTreatments(nextTreatments);
      if (nextPackages.length > 0) setPackages(nextPackages);
      if (nextBranches.length > 0) setBranches(nextBranches);
      setFormData((current) => ({
        ...current,
        treatment_id: nextForm.defaultTreatmentId,
        package_id: nextForm.defaultPackageId,
        branch_id: nextForm.defaultBranchId,
      }));
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
          packages.find((item) => item.treatmentId === value)?.id ||
          current.package_id;

        return { ...current, treatment_id: value, package_id: nextPackage };
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
    setState("loading");
    setMessage("Submitting...");
    await logPublicEvent("form_submit_attempt", { form_token: params.formToken }, attribution);

    try {
      const response = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
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
        setMessage(result.message || "Submission failed. Please try again.");
        await logPublicEvent(
          "form_submit_failed",
          { error: result.error || "submission_failed" },
          attribution
        );
        return;
      }

      setState("success");
      setMessage(
        "Your appointment request has been received. Alyssa will follow up on WhatsApp."
      );
      setLeadMeta({
        leadId: result.lead_id,
        snapshotId: result.source_snapshot_id,
        trackingStatus: result.tracking_status,
      });
    } catch (error) {
      setState("error");
      setMessage("Network error. Please try again.");
      await logPublicEvent(
        "form_submit_failed",
        { error: error instanceof Error ? error.message : "network_error" },
        attribution
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#fff9f3] px-4 py-5 text-[#321428]">
      <section className="mx-auto max-w-xl overflow-hidden rounded-[28px] border border-[#ead9cf] bg-white shadow-[0_24px_70px_rgba(90,35,72,0.14)]">
        <div className="bg-[#5a2348] px-6 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eac7ce]">
            Alyssa Medical Beauty
          </p>
          <h1 className="mt-3 text-2xl font-bold">Personal consultation booking</h1>
          <p className="mt-2 text-sm leading-6 text-[#f8e8e2]">
            Share your details and Alyssa will arrange the best next appointment window.
          </p>
        </div>
        <div className="p-6">
          <div className="rounded-3xl border border-[#ead9cf] bg-[#fff6f0] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
              Selected treatment
            </p>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <p className="font-bold">{selectedTreatment?.name}</p>
                <p className="mt-1 text-sm leading-6 text-[#7b5a6a]">
                  {selectedTreatment?.description}
                </p>
              </div>
              <p className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#5a2348]">
                {selectedPackage?.promoPrice > 0
                  ? `$${selectedPackage.promoPrice}`
                  : "Free"}
              </p>
            </div>
          </div>

          <form onSubmit={submitForm} className="mt-5 space-y-4">
            <input
              className="hidden"
              tabIndex={-1}
              value={formData.honeypot}
              onChange={(event) => updateField("honeypot", event.target.value)}
            />

            <Field label="Treatment">
              <select
                className="focus-ring mt-2 w-full rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm"
                value={formData.treatment_id}
                onChange={(event) => updateField("treatment_id", event.target.value)}
              >
                {treatments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Package">
              <select
                className="focus-ring mt-2 w-full rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm"
                value={formData.package_id}
                onChange={(event) => updateField("package_id", event.target.value)}
              >
                {availablePackages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {item.promoPrice > 0 ? `$${item.promoPrice}` : "Free"}
                  </option>
                ))}
              </select>
            </Field>

            {selectedPackage?.paymentRequired && (
              <Field label="Booking option">
                <select
                  className="focus-ring mt-2 w-full rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm"
                  value={formData.payment_option}
                  onChange={(event) => updateField("payment_option", event.target.value)}
                >
                  <option value="pay_now">Pay deposit now</option>
                  <option value="booking_only">Booking request only</option>
                </select>
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  required
                  className="focus-ring mt-2 w-full rounded-2xl border border-[#ead9cf] px-4 py-3 text-sm"
                  value={formData.customer_name}
                  onChange={(event) => updateField("customer_name", event.target.value)}
                  placeholder="Your name"
                />
              </Field>
              <Field label="WhatsApp phone">
                <input
                  required
                  inputMode="tel"
                  className="focus-ring mt-2 w-full rounded-2xl border border-[#ead9cf] px-4 py-3 text-sm"
                  value={formData.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="9123 4567"
                />
              </Field>
            </div>

            <Field label="Email optional">
              <input
                type="email"
                className="focus-ring mt-2 w-full rounded-2xl border border-[#ead9cf] px-4 py-3 text-sm"
                value={formData.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="name@example.com"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Branch">
                <select
                  className="focus-ring mt-2 w-full rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm"
                  value={formData.branch_id}
                  onChange={(event) => updateField("branch_id", event.target.value)}
                >
                  {branches.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  className="focus-ring mt-2 w-full rounded-2xl border border-[#ead9cf] px-4 py-3 text-sm"
                  value={formData.appointment_date}
                  onChange={(event) => updateField("appointment_date", event.target.value)}
                />
              </Field>
              <Field label="Time">
                <select
                  className="focus-ring mt-2 w-full rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm"
                  value={formData.appointment_time}
                  onChange={(event) => updateField("appointment_time", event.target.value)}
                >
                  {["11:00", "12:00", "14:00", "16:00", "18:00", "19:30"].map(
                    (time) => (
                      <option key={time}>{time}</option>
                    )
                  )}
                </select>
              </Field>
            </div>

            <button
              disabled={state === "loading"}
              className="w-full rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#d95f55] disabled:opacity-60"
            >
              {state === "loading" ? "Submitting..." : "Confirm booking"}
            </button>
          </form>

          {message && (
            <div
              className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                state === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : state === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-[#ead9cf] bg-[#fff6f0] text-[#5a2348]"
              }`}
            >
              {message}
              {state === "success" && (
                <p className="mt-2 text-xs font-normal">
                  Lead: {leadMeta.leadId} - Snapshot: {leadMeta.snapshotId} -
                  Tracking: {leadMeta.trackingStatus}
                </p>
              )}
            </div>
          )}
          <p className="mt-4 text-center text-xs leading-5 text-[#8a6b78]">
            Your details are used only for booking follow-up and consultation handling.
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold text-[#5a2348]">
      {label}
      {children}
    </label>
  );
}
