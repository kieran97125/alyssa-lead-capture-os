import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  IMAGE_REFERENCE_DISCLAIMER_FULL,
  resolveLegalBrandDisplay,
} from "@/lib/legal/consent";

const documentLabels = {
  privacy: "私隱政策",
  terms: "條款及細則",
  disclaimer: "免責聲明",
} as const;

type DocumentType = keyof typeof documentLabels;

type LegalSection = {
  title: string;
  body: string[];
};

function isDocumentType(value: string): value is DocumentType {
  return value in documentLabels;
}

function addImageReferenceDisclaimer(
  sections: LegalSection[],
  documentType: DocumentType
) {
  if (documentType !== "terms" && documentType !== "disclaimer") return sections;

  return [
    ...sections,
    {
      title: "圖片及視覺素材",
      body: [IMAGE_REFERENCE_DISCLAIMER_FULL],
    },
  ];
}

function getLegalSections(documentType: DocumentType, brandName: string): LegalSection[] {
  if (documentType === "privacy") {
    return [
      {
        title: "我們收集的資料",
        body: [
          `當你向 ${brandName} 提交登記或預約表格時，我們可能會收集你的姓名、電話 / WhatsApp、電郵、感興趣的療程、套餐、分店、預約日期時間，以及你在表格中主動提供的資料。`,
          "為了了解廣告及 Campaign 成效，表格亦可能記錄來源資料，例如 UTM 參數、click ID、頁面網址、提交時間、瀏覽器提供的基本技術資料及相關活動記錄。",
        ],
      },
      {
        title: "資料用途",
        body: [
          "我們會使用你提交的資料作預約安排、WhatsApp 或電話跟進、客戶服務、療程查詢、分店安排及相關行政用途。",
          "我們亦會使用來源資料分析 Campaign、廣告、Landing Page、表格及優惠成效，以改善服務流程及市場推廣安排。",
        ],
      },
      {
        title: "資料準確性及保留",
        body: [
          "請確保提交的聯絡及預約資料準確。如資料有誤，我們可能無法完成預約或跟進。",
          "資料會按業務、客戶服務、合規及紀錄需要保留一段合理時間，並會在不再需要時按適用程序處理。",
        ],
      },
      {
        title: "資料分享及處理",
        body: [
          "你的資料可能由品牌營運團隊、分店、客戶服務人員、預約跟進人員及受託服務供應商處理，目的限於預約、客戶服務、系統運作、成效分析及相關跟進。",
          "我們不會把客戶資料用於與預約、客戶服務、系統運作、成效分析及相關跟進無關的目的。",
        ],
      },
      {
        title: "直接促銷",
        body: [
          "本表格的必填同意只涵蓋預約、客戶服務及相關跟進。",
          "如日後需要發送推廣或直接促銷訊息，應在適用法例容許及 / 或取得適當同意的情況下另行處理。",
        ],
      },
      {
        title: "聯絡我們",
        body: [
          "如你希望查詢、更正或跟進已提交的資料，請透過品牌官方 WhatsApp、預約表格或品牌指定聯絡方式與我們聯絡。",
        ],
      },
    ];
  }

  if (documentType === "terms") {
    return [
      {
        title: "優惠及 Campaign 內容",
        body: [
          "Landing Page 或表格上的優惠、價錢、療程、套餐及分店資料只適用於指定 Campaign，並可能受名額、日期、分店、客人狀況及品牌確認限制。",
          "所有優惠內容以品牌最終確認為準。如頁面內容與實際安排不一致，品牌可按合理情況作出更正或更新。",
        ],
      },
      {
        title: "預約及付款",
        body: [
          "提交表格不代表預約已最終確認。品牌團隊會透過 WhatsApp、電話或其他指定方式跟進確認日期、時間、分店及療程安排。",
          "選擇只預約、booking_only 或稍後付款，不代表療程、套餐或服務免費。實際價格、付款安排及可用優惠以頁面、品牌確認及到店安排為準。",
        ],
      },
      {
        title: "更改、取消及遲到",
        body: [
          "如需更改或取消預約，請盡早聯絡品牌團隊。品牌可能因分店安排、療程時段、員工安排或其他合理原因調整預約。",
          "如客人遲到、未能出席或資料不完整，品牌可能需要重新安排時段或取消該次預約。",
        ],
      },
      {
        title: "使用者責任",
        body: [
          "你提交表格時，應提供真實、準確及屬於自己的聯絡資料，並確認你有權提交相關資料。",
          "如你有皮膚狀況、敏感、懷孕、長期病患、正在服藥或其他可能影響療程的情況，應在預約或到店評估時主動告知。",
        ],
      },
      {
        title: "私隱",
        body: [
          "你提交的個人資料會按本品牌的私隱政策處理，並用於預約、客戶服務、相關跟進及 Campaign 成效分析。",
        ],
      },
    ];
  }

  return [
    {
      title: "療程效果",
      body: [
        "任何療程、護理、產品或服務的效果會因個人體質、皮膚狀況、生活習慣、護理後配合度及其他因素而有所不同。頁面或廣告上的描述不應視為保證效果。",
      ],
    },
    {
      title: "專業評估",
      body: [
        "療程是否適合你，應以到店後的專業評估、諮詢及實際情況為準。品牌團隊可能因安全、健康或其他合理原因建議改期、更改療程或不建議進行某項服務。",
      ],
    },
    {
      title: "非醫療診斷",
      body: [
        "Landing Page、表格、廣告及客服回覆只作一般資料及預約用途，不構成醫療診斷、治療建議或替代醫生意見。若你有任何醫療或皮膚健康疑問，應諮詢合資格專業人士。",
      ],
    },
    {
      title: "圖片及內容",
      body: [
        "頁面上的圖片、描述、優惠摘要及示例內容只供參考。實際環境、設備、產品、流程、效果及可提供項目，可能因分店、時間及個別情況而不同。",
      ],
    },
    {
      title: "責任限制",
      body: [
        "在適用法律容許的範圍內，品牌及營運方不會就因不準確資料、未披露個人狀況、未遵從護理建議或不可控制因素而引致的損失承擔不合理責任。",
      ],
    },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ brandSlug: string; documentType: string }>;
}): Promise<Metadata> {
  const { brandSlug, documentType } = await params;
  const profile = resolveLegalBrandDisplay(brandSlug);
  const label = isDocumentType(documentType) ? documentLabels[documentType] : "法律文件";

  return {
    title: `${label} | ${profile.brandName}`,
    description: `${profile.brandName} ${label}`,
  };
}

export default async function LegalDocumentPage({
  params,
}: {
  params: Promise<{ brandSlug: string; documentType: string }>;
}) {
  const { brandSlug, documentType } = await params;

  if (!isDocumentType(documentType)) notFound();

  const profile = resolveLegalBrandDisplay(brandSlug);
  const label = documentLabels[documentType];
  const sections = addImageReferenceDisclaimer(
    getLegalSections(documentType, profile.brandName),
    documentType
  );
  const operatorLine = profile.operatingCompanyName
    ? `服務提供及資料使用者：${profile.brandName}，由 ${profile.operatingCompanyName} 營運。`
    : `服務提供及資料使用者：${profile.brandName}。營運方資料待品牌確認。`;

  return (
    <main className="min-h-screen bg-[#fff9f3] px-5 py-10 text-[#321428]">
      <article className="mx-auto max-w-4xl rounded-[28px] border border-[#ead9cf] bg-white p-6 shadow-[0_24px_70px_rgba(90,35,72,0.12)] md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a5d76]">
          品牌法律文件
        </p>
        <h1 className="mt-3 text-3xl font-bold md:text-4xl">{label}</h1>
        <div className="mt-4 grid gap-2 text-sm leading-6 text-[#6d4a5c]">
          <p>{operatorLine}</p>
          <p>最後更新：{profile.lastUpdated}</p>
          <p>以下內容為香港美容、醫學美容及健康服務 Campaign 頁面第一版客戶文件，正式使用前應由公司及法律顧問審閱。</p>
        </div>

        <div className="mt-8 grid gap-5">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-3xl border border-[#ead9cf] bg-[#fff6f0] p-5"
            >
              <h2 className="text-xl font-bold text-[#321428]">{section.title}</h2>
              <div className="mt-3 grid gap-3 text-sm leading-7 text-[#5a2348]">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-3xl border border-[#ead9cf] bg-white p-5">
          <h2 className="text-xl font-bold text-[#321428]">聯絡方式</h2>
          <p className="mt-3 text-sm leading-7 text-[#5a2348]">{profile.contactLabel}</p>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
          >
            返回首頁
          </Link>
          <Link
            href={profile.privacyPolicyUrl}
            className="rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
          >
            私隱政策
          </Link>
          <Link
            href={profile.termsUrl}
            className="rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
          >
            條款及細則
          </Link>
          <Link
            href={profile.disclaimerUrl}
            className="rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
          >
            免責聲明
          </Link>
        </div>
      </article>
    </main>
  );
}
