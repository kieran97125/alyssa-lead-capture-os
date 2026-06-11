import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { EmbedCodeCard } from "@/components/alyssa/EmbedCodeCard";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import { getDefaultEmbedCode, getEmbedScriptUrl } from "@/lib/data/appUrl";

export default function FormConfigPage() {
  const embedCode = getDefaultEmbedCode(
    alyssaDefaultForm.publicFormToken,
    alyssaDefaultForm.id
  );
  const scriptUrl = getEmbedScriptUrl();

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
          Form config
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#321428]">
          {alyssaDefaultForm.formName}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
          This view is the implementation handoff for Wix embed setup and future
          production configuration in Supabase.
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
            <h2 className="text-xl font-bold text-[#321428]">Operational config</h2>
            <dl className="mt-5 grid gap-3">
              {[
                ["Status", alyssaDefaultForm.status],
                ["Public form token", alyssaDefaultForm.publicFormToken],
                ["Allowed domains", alyssaDefaultForm.allowedDomains.join(", ")],
                ["Default treatment ID", alyssaDefaultForm.defaultTreatmentId],
                ["Default package ID", alyssaDefaultForm.defaultPackageId],
                ["Default branch ID", alyssaDefaultForm.defaultBranchId],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-[#fff6f0] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                        {label}
                      </dt>
                      <dd className="mt-2 break-words text-sm font-semibold text-[#5a2348]">
                        {value}
                      </dd>
                    </div>
                    <CopyButton value={value} />
                  </div>
                </div>
              ))}
            </dl>
          </section>

          <div className="space-y-5">
            <EmbedCodeCard
              code={embedCode}
              title="Embed code"
              description="Paste this into the Wix page body where the registration form should appear."
            />
            <section className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
              <h2 className="text-xl font-bold text-[#321428]">Script endpoint</h2>
              <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-[#fff6f0] p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="break-all text-sm font-semibold text-[#5a2348]">{scriptUrl}</p>
                <CopyButton value={scriptUrl} />
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/embed-preview"
                  className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white"
                >
                  Test Parent Embed
                </Link>
                <Link
                  href={`/embed/${alyssaDefaultForm.publicFormToken}`}
                  className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
                >
                  Open Iframe Directly
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
