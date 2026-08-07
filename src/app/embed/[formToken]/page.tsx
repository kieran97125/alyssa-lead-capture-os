import { Suspense } from "react";
import { EmbedFormClient } from "@/app/embed/[formToken]/EmbedFormClient";
import { getPublicFormConfig } from "@/lib/data/publicFormConfig";

type ConversionMode = "form_submit_pixel" | "thank_you_redirect";
type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function normalizeOrigin(value: string) {
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function normalizeConversionMode(value: string): ConversionMode | undefined {
  return value === "thank_you_redirect" ? "thank_you_redirect" : undefined;
}

export default async function EmbedFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ formToken: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ formToken }, query] = await Promise.all([params, searchParams]);
  const embedProps = {
    formToken,
    formId: firstParam(query.form_id) || undefined,
    brandSlug: firstParam(query.brand) || undefined,
    conversionMode: normalizeConversionMode(firstParam(query.conversion_mode)),
    successRedirectUrl: firstParam(query.success_redirect_url) || undefined,
    expectedParentOrigin: normalizeOrigin(firstParam(query.parent_origin)),
  };

  return (
    <Suspense fallback={<EmbedFormFallback />}>
      <EmbedFormWithConfig {...embedProps} />
    </Suspense>
  );
}

async function EmbedFormWithConfig({
  formToken,
  formId,
  brandSlug,
  conversionMode,
  successRedirectUrl,
  expectedParentOrigin,
}: {
  formToken: string;
  formId?: string;
  brandSlug?: string;
  conversionMode?: ConversionMode;
  successRedirectUrl?: string;
  expectedParentOrigin?: string;
}) {
  const initialResult = await getPublicFormConfig(formToken);
  const initialConfig = initialResult.body.ok
    ? initialResult.body
    : undefined;

  return (
    <EmbedFormClient
      formToken={formToken}
      formId={formId}
      brandSlug={brandSlug}
      conversionMode={conversionMode}
      successRedirectUrl={successRedirectUrl}
      expectedParentOrigin={expectedParentOrigin}
      initialConfig={initialConfig}
    />
  );
}

function EmbedFormFallback() {
  return (
    <main className="box-border w-full max-w-[100vw] overflow-x-hidden bg-transparent px-3 py-4 sm:px-5 sm:py-6">
      <section
        aria-label="正在準備預約表格"
        className="mx-auto box-border w-full max-w-3xl rounded-[24px] border border-[#ead9cf] bg-white px-4 py-5 shadow-[0_18px_56px_rgba(93,55,30,0.08)] sm:rounded-[30px] sm:px-8 sm:py-7"
      >
        <div className="h-3 w-28 animate-pulse rounded-full bg-[#f3e8e2]" />
        <div className="mt-3 h-8 w-64 max-w-[78%] animate-pulse rounded-xl bg-[#f6ece6]" />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-12 animate-pulse rounded-[13px] bg-[#faf3ee]"
            />
          ))}
        </div>
      </section>
    </main>
  );
}
