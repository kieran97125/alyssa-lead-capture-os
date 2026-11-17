import { redirect } from "next/navigation";
import { PlatformOverview } from "@/components/platform/PlatformOverview";
import { createWorkspaceAction } from "@/app/platform/actions";
import { getPlatformOverview } from "@/lib/platform/workspaces";
import { getCurrentPlatformOperator, canProvisionCustomers } from "@/lib/security/platformAccess";
export const dynamic = "force-dynamic";
export const metadata = { title: "平台管理 · Marketing OS", robots: { index: false, follow: false } };
export default async function PlatformPage({ searchParams }: { searchParams?: Promise<{ status?: string }> }) {
  const access = await getCurrentPlatformOperator();
  if (!access) redirect("/login?next=%2Fplatform&error=platform_required");
  const [data, query] = await Promise.all([getPlatformOverview(access), searchParams]);
  return <PlatformOverview data={data} email={access.email} canProvision={canProvisionCustomers(access)} createAction={createWorkspaceAction} status={query?.status}/>;
}
