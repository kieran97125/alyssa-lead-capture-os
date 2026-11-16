import { notFound, redirect } from "next/navigation";
import { AcquisitionCreationForm } from "@/components/acquisition/AcquisitionCreationForm";
import { WixSetupPanel } from "@/components/acquisition/WixSetupPanel";
import { LandingPageView } from "@/components/acquisition/LandingPageView";
import { AcquisitionCatalogue, type AcquisitionActivity } from "@/components/acquisition/AcquisitionCatalogue";
import { LandingPageEditorForm } from "@/components/acquisition/LandingPageEditorForm";
import { ManagedFormEditor } from "@/components/acquisition/ManagedFormEditor";
import { acquisitionFixtureConfig, acquisitionFixtureDraft, fixtureIds } from "./fixtureData";

export const dynamic = "force-dynamic";

async function inspectSubmission(formData: FormData, failure: boolean, actionName: string, throws: boolean) {
  if (process.env.ALYSSA_E2E_FIXTURES !== "1") notFound();
  if (throws) throw new Error("Synthetic fixture action failure");
  if (failure) {
    await new Promise(resolve => setTimeout(resolve, 750));
    return { ok: false as const, message: actionName === "create" || actionName === "form-edit"
      ? "暫時未能儲存，請再試一次。" : `暫時未能完成${actionName === "publish" ? "發布" : actionName === "preview" ? "預覽" : "儲存"}。` };
  }
  const fields = ["mode", "campaignMode", "campaignName", "formName", "brandId", "defaultTreatmentId",
    "defaultPackageId", "defaultBranchId", "placementKind", "placementUrl", "allowedDomains",
    "existingFormId", "pageTitle", "heroTitle", "heroSubtitle", "requestId", "formId", "expectedRevision", "editorIntent", "status"];
  const submitted: Record<string, string | string[]> = { actionName };
  for (const field of fields) submitted[field] = String(formData.get(field) ?? "").slice(0, 2000);
  submitted.packageIds = formData.getAll("packageIds").map(value => String(value).slice(0, 80));
  submitted.branchIds = formData.getAll("branchIds").map(value => String(value).slice(0, 80));
  redirect(`/e2e/acquisition-management?submitted=${encodeURIComponent(JSON.stringify(submitted))}`);
}

export default async function AcquisitionManagementFixture({ searchParams }: {
  searchParams: Promise<{ view?: string; purpose?: string; action?: string; submitted?: string; tab?: string; unavailable?: string; disabled?: string; published?: string; archived?: string; inactiveChoices?: string }>;
}) {
  if (process.env.ALYSSA_E2E_FIXTURES !== "1") notFound();
  const query = await searchParams;
  const failure = query.action === "failure";
  const throws = query.action === "throw";
  const editorConfig = query.inactiveChoices === "1" ? {
    ...acquisitionFixtureConfig,
    treatments: acquisitionFixtureConfig.treatments.map(item => item.id === fixtureIds.body ? { ...item, status: "archived" } : item),
    packages: [...acquisitionFixtureConfig.packages, { ...acquisitionFixtureConfig.packages.find(item => item.id === fixtureIds.bodyOffer)!,
      id: "a3000000-0000-4000-8000-000000000004", name: "未選取的停用療程優惠" }],
    forms: acquisitionFixtureConfig.forms.map(item => item.id === fixtureIds.activeFormA ? { ...item, packageSelectionMode: "customer_choice" as const } : item),
  } : acquisitionFixtureConfig;
  if (query.view === "preview") return <div data-testid="acquisition-preview-fixture">
    <LandingPageView page={acquisitionFixtureDraft} config={acquisitionFixtureConfig} preview />
  </div>;
  if (query.view === "shared-offer") {
    const config = { ...acquisitionFixtureConfig, forms: acquisitionFixtureConfig.forms.map(form => form.id === fixtureIds.activeFormA
      ? { ...form, defaultTreatmentId: fixtureIds.body, defaultPackageId: fixtureIds.bodyOffer, defaultBranchId: fixtureIds.branchASecond }
      : form) };
    return <LandingPageView page={acquisitionFixtureDraft} config={config} preview />;
  }
  const activity = new Map<string, AcquisitionActivity>([[fixtureIds.activeFormB, {
    available: true, lastRegistrationAt: null, lastDeliveryAt: null, pendingCount: 0, blockedCount: 1, uncertainCount: 0,
  }]]);
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 text-system-foreground" data-testid="acquisition-fixture">
      <header>
        <h1 className="text-2xl font-semibold">{query.view === "editor" ? "編輯廣告頁" : query.view === "form-editor" ? "表格設定" : "新增推廣"}</h1>
        <p className="mt-2 text-sm text-system-muted-foreground">隔離驗收資料，不會建立真實登記或發出訊息。</p>
        {query.view === "editor" ? <a href="/e2e/acquisition-management?view=catalogue" className="mt-3 inline-block text-sm text-system-primary underline underline-offset-4">返回推廣列表</a> : null}
      </header>
      {query.submitted ? <section aria-label="驗收提交結果" className="rounded-[var(--radius-panel)] border border-system-border bg-system-card p-4">
        <h2 className="font-semibold">已完成驗收提交</h2>
        <output data-testid="acquisition-submitted" className="mt-3 block break-all text-sm">{query.submitted.slice(0, 8000)}</output>
      </section> : null}
      {query.view === "editor" ? <LandingPageEditorForm disabled={query.disabled === "1"} published={query.published === "1"}
        saveAction={async data => { "use server"; return inspectSubmission(data, failure, "save", throws); }}
        previewAction={async data => { "use server"; return inspectSubmission(data, failure, "preview", throws); }}
        publishAction={async data => { "use server"; return inspectSubmission(data, failure, "publish", throws); }}>
        <input type="hidden" name="pageId" value={acquisitionFixtureDraft.id} />
        <input type="hidden" name="requestId" value="a8000000-0000-4000-8000-000000000001" />
        <input type="hidden" name="expectedRevision" value="3" />
        <section className="grid min-w-0 gap-5 rounded-[var(--radius-panel)] border border-system-border bg-system-card p-5">
          <div><h2 className="text-lg font-semibold">首屏內容</h2><p className="mt-2 text-sm text-system-muted-foreground">先儲存並預覽，確認好再發布。</p></div>
          <label className="grid gap-2 text-sm font-medium">主標題<input name="heroTitle" defaultValue="尚未發布的草稿標題" className="rounded-[var(--radius-control)] border border-system-input bg-system-background px-3 py-3" /></label>
          <label className="grid gap-2 text-sm font-medium">補充說明<textarea name="heroSubtitle" defaultValue="登記後由同事安排合適時間。" rows={3} className="rounded-[var(--radius-control)] border border-system-input bg-system-background px-3 py-3" /></label>
        </section>
      </LandingPageEditorForm> : query.view === "form-editor" ? <ManagedFormEditor config={editorConfig}
        setting={editorConfig.forms.find(form => form.id === (query.archived === "1" ? fixtureIds.stoppedFormA : fixtureIds.activeFormA))!}
        selectedPackageIds={query.inactiveChoices === "1" ? [fixtureIds.faceOffer, fixtureIds.bodyOffer, fixtureIds.inactiveOffer] : [query.archived === "1" ? fixtureIds.bodyOffer : fixtureIds.faceOffer]}
        selectedBranchIds={[query.archived === "1" ? fixtureIds.branchASecond : fixtureIds.branchA]}
        action={async data => { "use server"; return inspectSubmission(data, failure, "form-edit", throws); }} /> : query.view === "catalogue" ? <AcquisitionCatalogue config={acquisitionFixtureConfig} pages={[acquisitionFixtureDraft]}
        activity={activity} tab={query.tab === "pages" ? "pages" : "forms"} query={{}} pagesAvailable={query.unavailable !== "1"} /> : query.view === "setup" ? (
        <WixSetupPanel
          formName="面部護理登記表"
          embedCode={'<div id="fixture-registration"></div><script src="https://example.test/embed/alyssa-form.js" data-form-token="fixture-install-token"></script>'}
          wixAttributionBridgeCode={'// fixture-only Wix bridge\n$w.onReady(() => {});'}
          previewUrl={`/forms/${fixtureIds.activeFormA}/preview`}
          placementUrl="https://example.test/promotion"
          trackingParameters="utm_source=meta&utm_medium=paid_social&utm_campaign=fixture"
        />
      ) : (
        <AcquisitionCreationForm
          config={acquisitionFixtureConfig}
          initialBrandId={fixtureIds.brandA}
          initialMode={query.purpose === "landing_page" ? "landing_page" : query.purpose === "wix" ? "wix" : undefined}
          action={async (formData) => {
            "use server";
            return inspectSubmission(formData, failure, "create", throws);
          }}
        />
      )}
    </main>
  );
}
