import { AppNav } from "@/components/alyssa/AppNav";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";

export default function FormConfigPage() {
  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-4xl px-5 py-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
          Form config
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#321428]">{alyssaDefaultForm.formName}</h1>
        <div className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
          <pre className="overflow-x-auto rounded-2xl bg-[#321428] p-4 text-xs leading-6 text-[#fff9f3]">
{`<script
  src="https://YOUR_DOMAIN/embed/alyssa-form.js"
  data-form-token="${alyssaDefaultForm.publicFormToken}"
  data-brand="alyssa"
  data-form-id="${alyssaDefaultForm.id}">
</script>`}
          </pre>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Status", alyssaDefaultForm.status],
              ["Allowed domains", alyssaDefaultForm.allowedDomains.join(", ")],
              ["Default treatment", alyssaDefaultForm.defaultTreatmentId],
              ["Default package", alyssaDefaultForm.defaultPackageId],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-[#fff6f0] p-4">
                <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">{label}</dt>
                <dd className="mt-2 text-sm font-semibold text-[#5a2348]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </main>
  );
}
