"use client";

import { useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Save } from "lucide-react";
import { SystemButton } from "@/components/system/SystemButton";
import { SystemDetails } from "@/components/system/SystemDetails";
import { acquisitionFieldClass, type AcquisitionActionResult, type AcquisitionConfiguration } from "./managedFormUi";
import { managedFormSchema, type ManagedFormFields, type ManagedFormValues } from "@/lib/acquisition/managedFormSchema";
import type { FormSetting } from "@/lib/data/configuration";
import { packagePriceLabel } from "@/lib/acquisition/offerDisplay";

export function ManagedFormEditor({ config, setting, selectedPackageIds, selectedBranchIds, action }: {
  config: AcquisitionConfiguration;
  setting: FormSetting;
  selectedPackageIds: string[];
  selectedBranchIds: string[];
  action: (data: FormData) => AcquisitionActionResult | Promise<AcquisitionActionResult>;
}) {
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submissionLock = useRef(false);
  const form = useForm<ManagedFormFields, unknown, ManagedFormValues>({
    resolver: zodResolver(managedFormSchema),
    mode: "onBlur",
    defaultValues: {
      formName: setting.formName,
      brandId: setting.brandId,
      defaultTreatmentId: setting.defaultTreatmentId ?? "",
      defaultPackageId: setting.defaultPackageId ?? "",
      packageSelectionMode: setting.packageSelectionMode,
      packageIds: selectedPackageIds,
      defaultBranchId: setting.defaultBranchId ?? "",
      branchIds: selectedBranchIds,
      allowedDomains: setting.allowedDomains.join("\n"),
      placementKind: setting.placementKind ?? "unspecified",
      placementUrl: setting.placementUrl ?? "",
      expectedRevision: setting.revision,
    },
  });
  const values = useWatch({ control: form.control, compute: (fields: ManagedFormFields) => fields });
  const brand = config.brands.find(item => item.id === setting.brandId);
  const treatments = config.treatments.filter(item => item.brandId === setting.brandId && (item.status === "active" || item.id === values.defaultTreatmentId));
  const offers = config.packages.filter(item => item.treatmentId === values.defaultTreatmentId && (item.status === "active" || item.id === values.defaultPackageId || values.packageIds.includes(item.id)));
  const brandTreatmentIds = new Set(config.treatments.filter(item => item.brandId === setting.brandId).map(item => item.id));
  const choiceOffers = config.packages.filter(item => brandTreatmentIds.has(item.treatmentId) && (item.status === "active" || values.packageIds.includes(item.id)));
  const branches = config.branches.filter(item => item.brandId === setting.brandId && (item.status === "active" || item.id === values.defaultBranchId || values.branchIds.includes(item.id)));
  const error = (name: keyof ManagedFormFields) => form.formState.errors[name]?.message;
  const errorText = (name: keyof ManagedFormFields) => error(name) ? <span role="alert" className="mt-2 block text-xs text-system-destructive">{error(name)}</span> : null;

  function selectTreatment(id: string) {
    const offer = config.packages.find(item => item.treatmentId === id && item.status === "active");
    form.setValue("defaultTreatmentId", id, { shouldDirty: true });
    form.setValue("defaultPackageId", offer?.id ?? "", { shouldDirty: true });
    form.setValue("packageIds", offer ? [offer.id] : [], { shouldDirty: true });
  }
  function toggleSelection(key: "packageIds" | "branchIds", id: string, checked: boolean) {
    const current = form.getValues(key);
    form.setValue(key, checked ? [...new Set([...current, id])] : current.filter(value => value !== id), { shouldDirty: true });
  }
  function save(fields: ManagedFormValues) {
    if (submissionLock.current) return;
    submissionLock.current = true;
    setFailure(null);
    const data = new FormData();
    data.set("formId", setting.id);
    Object.entries(fields).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach(item => data.append(key, item));
      else if (value !== undefined) data.set(key, String(value));
    });
    startTransition(async () => {
      try {
        const result = await action(data);
        if (result && !result.ok) {
          setFailure(result.message);
          Object.entries(result.fieldErrors ?? {}).forEach(([key, message]) => form.setError(key as keyof ManagedFormFields, { message }));
        }
      } catch (cause) {
        if (cause && typeof cause === "object" && "digest" in cause && String(cause.digest).startsWith("NEXT_REDIRECT")) throw cause;
        setFailure("暫時未能儲存，修改已保留。請再試一次。");
      } finally { submissionLock.current = false; }
    });
  }

  return <form noValidate onSubmit={event => { void form.handleSubmit(save)(event); }} className="grid min-w-0 gap-5 rounded-[var(--radius-panel)] border border-system-border bg-system-card p-5 sm:p-6" data-testid="form-settings-card">
    <input type="hidden" name="formId" value={setting.id} />
    <input type="hidden" {...form.register("expectedRevision", { valueAsNumber: true })} />
    <input type="hidden" {...form.register("brandId")} />
    <div><h2 className="text-xl font-semibold">表格設定</h2><p className="mt-2 text-sm text-system-muted-foreground">{brand?.name ?? "未設定品牌"} · 修改後按儲存，就會套用到這張表格。</p></div>
    {setting.status === "archived" ? <p className="rounded-[var(--radius-control)] bg-system-muted p-3 text-sm text-system-muted-foreground">這張表格已停用。儲存設定後仍會維持停用。</p> : null}
    {failure ? <p role="alert" className="rounded-[var(--radius-control)] border border-system-destructive/30 bg-system-destructive/5 p-4 text-sm text-system-destructive">{failure}</p> : null}
    <label className="text-sm font-medium">管理名稱<input aria-label="管理名稱" className={acquisitionFieldClass} {...form.register("formName")} aria-invalid={!!error("formName")} />{errorText("formName")}</label>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium">療程<select aria-label="療程" className={acquisitionFieldClass} value={values.defaultTreatmentId} onChange={e => selectTreatment(e.target.value)} aria-invalid={!!error("defaultTreatmentId")}><option value="">請選擇療程</option>{treatments.map(item => <option key={item.id} value={item.id}>{item.name}{item.status === "active" ? "" : "（已停用）"}</option>)}</select>{errorText("defaultTreatmentId")}</label>
      <label className="text-sm font-medium">優惠<select aria-label="優惠" className={acquisitionFieldClass} value={values.defaultPackageId} onChange={e => {
        const id = e.target.value;
        form.setValue("defaultPackageId", id, { shouldDirty: true });
        form.setValue("packageIds", values.packageSelectionMode === "fixed" ? [id].filter(Boolean) : [...new Set([...values.packageIds, id])].filter(Boolean), { shouldDirty: true });
      }} aria-invalid={!!error("defaultPackageId")}><option value="">請選擇優惠</option>{offers.map(item => <option key={item.id} value={item.id}>{packagePriceLabel(item)}{item.status === "active" ? "" : "（已停用）"}</option>)}</select>{errorText("defaultPackageId")}</label>
      <label className="text-sm font-medium">預設分店<select aria-label="預設分店" className={acquisitionFieldClass} value={values.defaultBranchId} onChange={e => {
        const id = e.target.value;
        form.setValue("defaultBranchId", id, { shouldDirty: true });
        form.setValue("branchIds", [...new Set([...values.branchIds, id])].filter(Boolean), { shouldDirty: true });
      }} aria-invalid={!!error("defaultBranchId")}><option value="">請選擇分店</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}{item.status === "active" ? "" : "（已停用）"}</option>)}</select>{errorText("defaultBranchId")}</label>
      <label className="text-sm font-medium">用途<select aria-label="用途" className={acquisitionFieldClass} {...form.register("placementKind")}><option value="unspecified">未分類</option><option value="wix">Wix網站</option><option value="landing_page">獨立廣告頁</option><option value="both">網站及廣告頁</option></select></label>
    </div>
    <label className="text-sm font-medium">網站網址<input aria-label="網站網址" type="url" placeholder="https://www.example.com/offer" className={acquisitionFieldClass} {...form.register("placementUrl")} aria-invalid={!!error("placementUrl")} />{errorText("placementUrl")}<span className="mt-2 block text-xs font-normal text-system-muted-foreground">填寫放置表格的頁面，方便同事辨認及開啟。</span></label>
    <SystemDetails title="更多表格設定">
      <div className="grid gap-5">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.packageSelectionMode === "customer_choice"} onChange={e => {
          form.setValue("packageSelectionMode", e.target.checked ? "customer_choice" : "fixed", { shouldDirty: true });
          if (!e.target.checked) form.setValue("packageIds", [values.defaultPackageId].filter(Boolean), { shouldDirty: true });
        }} />讓客人自行選擇優惠</label>
        {values.packageSelectionMode === "customer_choice" ? <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-medium">可選優惠</legend>{choiceOffers.map(item => <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.packageIds.includes(item.id) || item.id === values.defaultPackageId} disabled={item.id === values.defaultPackageId} onChange={e => toggleSelection("packageIds", item.id, e.target.checked)} />{config.treatments.find(treatment => treatment.id === item.treatmentId)?.name} · {packagePriceLabel(item)}{item.status === "active" ? "" : "（已停用，請重新選擇）"}</label>)}</fieldset> : null}
        {branches.length > 1 ? <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-medium">可選分店</legend>{branches.map(item => <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.branchIds.includes(item.id) || item.id === values.defaultBranchId} disabled={item.id === values.defaultBranchId} onChange={e => toggleSelection("branchIds", item.id, e.target.checked)} />{item.name}{item.status === "active" ? "" : "（已停用，請重新選擇）"}</label>)}</fieldset> : null}
        <label className="text-sm font-medium">額外允許網站<textarea aria-label="額外允許網站" rows={3} className={acquisitionFieldClass} {...form.register("allowedDomains")} />{errorText("allowedDomains")}<span className="mt-2 block text-xs font-normal text-system-muted-foreground">每行一個網址；一般只需填寫上方網站網址。</span></label>
      </div>
    </SystemDetails>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-system-border pt-4" data-testid="form-settings-actions"><p className="text-xs text-system-muted-foreground" aria-live="polite">{pending ? "正在儲存…" : form.formState.isDirty ? "有修改尚未儲存" : "設定已載入"}</p><SystemButton type="submit" disabled={pending} aria-busy={pending}>{pending ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" /> : <Save size={16} />}{pending ? "儲存中…" : "儲存設定"}</SystemButton></div>
  </form>;
}
