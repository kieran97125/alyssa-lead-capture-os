import { AuthConfirmClient } from "@/components/auth/AuthConfirmClient";
import { safeInternalNextPath } from "@/lib/supabase/authConfig";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams?: Promise<{
    code?: string | string[];
    next?: string | string[];
    token_hash?: string | string[];
    type?: string | string[];
  }>;
}) {
  const query = await searchParams;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,#fff1f7_0,#fff9f3_42%,#f8e8e2_100%)] px-5 py-10">
      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-xl place-items-center">
        <div className="w-full rounded-[32px] border border-[#ead9cf] bg-white/92 p-8 shadow-[0_30px_90px_rgba(90,35,72,0.14)]">
          <p className="mb-5 text-center text-xs font-bold uppercase tracking-[0.22em] text-[#9a5d76]">
            Alyssa Growth OS
          </p>
          <AuthConfirmClient
            code={firstParam(query?.code)}
            next={safeInternalNextPath(firstParam(query?.next))}
            tokenHash={firstParam(query?.token_hash)}
            type={firstParam(query?.type)}
          />
        </div>
      </section>
    </main>
  );
}
