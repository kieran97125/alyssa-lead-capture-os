import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { EmbedCodeCard } from "@/components/alyssa/EmbedCodeCard";
import {
  alyssaBranches,
  alyssaBrand,
  alyssaDefaultForm,
  alyssaPackages,
  alyssaTreatments,
} from "@/lib/data/alyssaConfig";
import { getDefaultEmbedCode, getEmbedScriptUrl } from "@/lib/data/appUrl";

export default function FormsPage() {
  const embedCode = getDefaultEmbedCode(
    alyssaDefaultForm.publicFormToken,
    alyssaDefaultForm.id
  );
  const embedScriptUrl = getEmbedScriptUrl();
  const defaultTreatment = alyssaTreatments.find(
    (item) => item.id === alyssaDefaultForm.defaultTreatmentId
  );
  const defaultPackage = alyssaPackages.find(
    (item) => item.id === alyssaDefaultForm.defaultPackageId
  );
  const defaultBranch = alyssaBranches.find(
    (item) => item.id === alyssaDefaultForm.defaultBranchId
  );

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
              Form management
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#321428]">
              Alyssa registration forms
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
              Form setup is treated as operational configuration: public token,
              brand defaults, offer validation, allowed domains, and embed readiness
              are all source-of-truth inputs.
            </p>
          </div>
          <Link
            href="/embed-preview"
            className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d95f55]"
          >
            Test Wix Preview
          </Link>
        </div>

        <section className="mt-7 grid gap-5 xl:grid-cols-[1fr_0.92fr]">
          <article className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                  Active seed form
                </p>
                <h2 className="mt-3 text-2xl font-bold text-[#321428]">
                  {alyssaDefaultForm.formName}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                  This local form mirrors the production shape. Supabase can replace
                  the seed values with UUID-backed configuration without changing the
                  iframe or public submit flow.
                </p>
              </div>
              <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                Embed ready
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoCell label="Form token" value={alyssaDefaultForm.publicFormToken} copy />
              <InfoCell label="Brand" value={alyssaBrand.name} />
              <InfoCell label="Default treatment" value={defaultTreatment?.name ?? "Unset"} />
              <InfoCell label="Default package" value={defaultPackage?.name ?? "Unset"} />
              <InfoCell label="Default branch" value={defaultBranch?.name ?? "Unset"} />
              <InfoCell
                label="Allowed domains"
                value={alyssaDefaultForm.allowedDomains.join(", ")}
                copy
              />
              <InfoCell label="Public script" value={embedScriptUrl} copy wide />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/forms/${alyssaDefaultForm.id}`}
                className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
              >
                Open Config
              </Link>
              <Link
                href={`/embed/${alyssaDefaultForm.publicFormToken}`}
                className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
              >
                Direct Iframe
              </Link>
            </div>
          </article>

          <EmbedCodeCard
            code={embedCode}
            title="Copy-ready Wix snippet"
            description="Use this script tag on the parent page so UTM and click IDs are captured before iframe submission."
          />
        </section>
      </div>
    </main>
  );
}

function InfoCell({
  label,
  value,
  copy = false,
  wide = false,
}: {
  label: string;
  value: string;
  copy?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-[#fff6f0] p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
            {label}
          </dt>
          <dd className="mt-2 break-words text-sm font-semibold text-[#5a2348]">
            {value}
          </dd>
        </div>
        {copy && <CopyButton value={value} />}
      </div>
    </div>
  );
}
