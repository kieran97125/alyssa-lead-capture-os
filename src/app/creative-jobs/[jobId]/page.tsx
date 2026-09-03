import Link from "next/link";
import { ArrowLeft, Palette } from "lucide-react";
import { AppNav } from "@/components/alyssa/AppNav";
import { CreativeJobStudio } from "@/components/creative/CreativeJobStudio";
import { getCreativeJobDetail } from "@/lib/creative/store";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function CreativeJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<{
    creative_status?: string | string[];
    creative_message?: string | string[];
  }>;
}) {
  const moduleAccess = await requireModuleAccess("creative_jobs");
  const { jobId } = await params;
  const query = (await searchParams) ?? {};
  const message = firstParam(query.creative_message);
  const feedback = message
    ? {
        status: firstParam(query.creative_status) === "error"
          ? ("error" as const)
          : ("success" as const),
        message,
      }
    : null;
  const detail = moduleAccess.allowed ? await getCreativeJobDetail(jobId) : null;

  if (!detail) {
    return (
      <main className="alyssa-shell">
        <AppNav access={moduleAccess.access} />
        <div className="command-page">
          <div className="command-page-inner">
            <section className="command-surface p-10 text-center">
              <Palette className="mx-auto text-[#9a5d76]" size={30} />
              <h1 className="mt-3 text-xl font-black text-[#321428]">
                搵唔到設計工作，或者你未有權限
              </h1>
              <p className="mt-2 text-sm font-semibold text-[#806174]">
                Designer 只會見到派畀自己嘅 Job；Marketer 會按品牌權限查看工作。
              </p>
              <Link
                href="/creative-jobs"
                className="command-secondary-button mt-5 inline-flex"
              >
                <ArrowLeft size={15} /> 返回 Job List
              </Link>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="alyssa-shell">
      <AppNav access={detail.access} />
      <div className="command-page p-0">
        <CreativeJobStudio
          key={detail.job.id}
          job={detail.job}
          assets={detail.assets}
          comments={detail.comments}
          versions={detail.versions}
          notifications={detail.notifications}
          brands={detail.brands}
          treatments={detail.treatments}
          taxonomies={detail.taxonomies}
          designers={detail.designers}
          canEditMetadata={detail.canEditMetadata}
          canEditBrief={detail.canEditBrief}
          canUpdateStatus={detail.canUpdateStatus}
          canContributeAssets={detail.canContributeAssets}
          canManageSettings={detail.canManageSettings}
          feedback={feedback}
        />
      </div>
    </main>
  );
}
