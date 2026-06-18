import Link from "next/link";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,#fff1f7_0,#fff9f3_34%,#f6f2ff_100%)] px-5 py-10 text-[#321428]">
      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-5xl place-items-center">
        <div className="w-full max-w-xl rounded-[32px] border border-[#ead9cf] bg-white/90 p-8 text-center shadow-[0_30px_90px_rgba(90,35,72,0.14)]">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#9a5d76]">
            LaunchHub
          </p>
          <h1 className="mt-3 text-3xl font-bold text-[#321428]">
            Internal Login Removed
          </h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#6d4a5c]">
            The internal admin backend is open by default. Use the dashboard
            link below to continue.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-[#e46f64] px-6 py-3 text-sm font-bold text-white shadow-[0_16px_36px_rgba(228,111,100,0.24)] transition hover:-translate-y-0.5 hover:bg-[#d85f55]"
          >
            Open Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
