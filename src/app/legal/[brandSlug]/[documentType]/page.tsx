import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrandLegalProfile } from "@/lib/legal/consent";

const documentLabels = {
  privacy: "私隱政策",
  terms: "條款及細則",
  disclaimer: "免責聲明",
} as const;

type DocumentType = keyof typeof documentLabels;

function isDocumentType(value: string): value is DocumentType {
  return value in documentLabels;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ documentType: string }>;
}): Promise<Metadata> {
  const { documentType } = await params;
  const label = isDocumentType(documentType)
    ? documentLabels[documentType]
    : "法律文件";

  return {
    title: `${label} | 品牌法律文件`,
    description: "品牌法律文件預留頁。",
  };
}

export default async function LegalDocumentPage({
  params,
}: {
  params: Promise<{ brandSlug: string; documentType: string }>;
}) {
  const { brandSlug, documentType } = await params;

  if (!isDocumentType(documentType)) notFound();

  const label = documentLabels[documentType];
  const profile = getBrandLegalProfile({
    brandSlug,
    brandName: brandSlug === "alyssa" ? "Alyssa" : brandSlug,
  });

  return (
    <main className="min-h-screen bg-[#fff9f3] px-5 py-10 text-[#321428]">
      <section className="mx-auto max-w-3xl rounded-[28px] border border-[#ead9cf] bg-white p-6 shadow-[0_24px_70px_rgba(90,35,72,0.12)] md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a5d76]">
          Brand Legal
        </p>
        <h1 className="mt-3 text-3xl font-bold">{label}</h1>
        <p className="mt-4 text-sm leading-7 text-[#6d4a5c]">
          此頁為 {profile.brandName} 的{label}預留位置。正式法律文件上線前，請由品牌管理團隊或法律顧問確認內容。
        </p>
        <div className="mt-6 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4 text-sm leading-7 text-[#5a2348]">
          <p className="font-bold">目前提交表格前，客人需要確認：</p>
          <p className="mt-2">
            已閱讀並同意相關條款，並同意提交資料可用於預約、客戶服務及相關跟進用途。
          </p>
        </div>
      </section>
    </main>
  );
}
