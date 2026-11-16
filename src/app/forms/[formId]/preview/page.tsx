import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PublicLeadForm } from "@/components/alyssa/PublicLeadForm";
import { getConfigurationData } from "@/lib/data/configuration";
import { buildPreviewFormConfig } from "@/lib/acquisition/previewFormConfig";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "登記表格預覽", robots: { index: false, follow: false } };

export default async function FormPreview({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  const access = await requireModuleAccess("forms");
  if (!access.allowed) redirect("/login?next=" + encodeURIComponent(`/forms/${formId}/preview`) + "&error=permission_denied");
  const config = await getConfigurationData({ strict: true });
  const form = config.forms.find(f => f.id === formId);
  if (!form) notFound();
  return <main className="min-h-screen bg-system-background text-system-foreground" data-testid="protected-form-preview">
    <header className="border-b border-system-border bg-system-card px-4 py-4"><div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
      <div><h1 className="font-semibold">{form.formName}</h1><p className="mt-1 text-xs text-system-muted-foreground">只供內部檢查，登記及廣告追蹤已停用。</p></div>
      <Link href={`/forms/${form.id}`} className="text-sm font-semibold text-system-primary underline underline-offset-4">返回設定</Link>
    </div></header>
    <div className="mx-auto max-w-3xl px-4 py-8"><PublicLeadForm formToken={form.publicFormToken} formId={form.id} initialConfig={buildPreviewFormConfig(config, form)} mode="inline" previewMode /></div>
  </main>;
}
