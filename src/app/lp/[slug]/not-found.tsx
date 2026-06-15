import Link from "next/link";

export default function LandingPageNotFound() {
  return (
    <main className="min-h-screen bg-[#fff9f3] px-5 py-16 text-[#321428]">
      <section className="mx-auto max-w-xl rounded-[28px] border border-[#ead9cf] bg-white/90 p-8 text-center shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9a5d76]">
          Campaign Page
        </p>
        <h1 className="mt-3 text-3xl font-bold">這個頁面暫時未能使用</h1>
        <p className="mt-4 text-sm leading-6 text-[#6d4a5c]">
          頁面可能尚未發布，或連結已經更新。請返回官方渠道重新開啟最新連結。
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
        >
          返回首頁
        </Link>
      </section>
    </main>
  );
}
