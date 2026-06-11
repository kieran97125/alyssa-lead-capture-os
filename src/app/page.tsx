import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";

export default function HomePage() {
  return (
    <main className="alyssa-shell">
      <AppNav />
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            Source-of-truth layer
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-[#321428] md:text-6xl">
            Alyssa Lead Capture OS
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#6d4a5c]">
            Registration forms, parent-page attribution, CTWA-ready source snapshots,
            lead events, and booking outcome feedback paths for Alyssa medical beauty.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d95f55]"
            >
              Open Dashboard
            </Link>
            <Link
              href="/embed/alyssa-main-form-dev-token"
              className="rounded-full border border-[#d9b66f] bg-white/70 px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              Preview Form
            </Link>
          </div>
        </div>
        <div className="rounded-[28px] border border-[#ead9cf] bg-white/78 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.12)]">
          <p className="text-sm font-bold text-[#9a5d76]">Embed script</p>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-[#321428] p-4 text-xs leading-6 text-[#fff9f3]">
{`<script
  src="https://YOUR_DOMAIN/embed/alyssa-form.js"
  data-form-token="FORM_PUBLIC_TOKEN"
  data-brand="alyssa"
  data-form-id="FORM_ID">
</script>`}
          </pre>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Parent UTM capture",
              "Source snapshots",
              "Lead event timeline",
              "CRM outcome feedback",
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-[#fff6f0] p-4 text-sm font-semibold text-[#5a2348]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
