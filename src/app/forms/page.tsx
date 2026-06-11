import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";

export default function FormsPage() {
  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
          Form management
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#321428]">Alyssa registration forms</h1>
        <div className="mt-6 max-w-3xl rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
            Active seed form
          </p>
          <h2 className="mt-3 text-xl font-bold text-[#321428]">{alyssaDefaultForm.formName}</h2>
          <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
            Public token, allowed domains, default treatment, package, and branch are
            modeled server-side. Client submitted prices are ignored.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/forms/${alyssaDefaultForm.id}`} className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white">
              Open Config
            </Link>
            <Link href={`/embed/${alyssaDefaultForm.publicFormToken}`} className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]">
              Preview Embed
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
