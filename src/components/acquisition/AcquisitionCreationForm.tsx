"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, FileText, Globe, LoaderCircle } from "lucide-react";
import { SystemButton } from "@/components/system/SystemButton";
import { SystemDetails } from "@/components/system/SystemDetails";
import { managedFormSchema, type ManagedFormFields, type ManagedFormValues } from "@/lib/acquisition/managedFormSchema";
import { packagePriceLabel } from "@/lib/acquisition/offerDisplay";
import { acquisitionFieldClass, type AcquisitionActionResult, type AcquisitionConfiguration } from "./managedFormUi";
export { acquisitionFieldClass, type AcquisitionActionResult, type AcquisitionConfiguration } from "./managedFormUi";
const labelClass = "text-sm font-medium text-system-foreground";
const panelClass = "rounded-[var(--radius-panel)] border border-system-border bg-system-card p-5 sm:p-6";

function firstSelection(config: AcquisitionConfiguration, brandId: string) {
  const treatment = config.treatments.find(item => item.brandId === brandId && item.status === "active");
  const offer = config.packages.find(item => item.treatmentId === treatment?.id && item.status === "active");
  const branch = config.branches.find(item => item.brandId === brandId && item.status === "active");
  return { treatmentId: treatment?.id ?? "", packageId: offer?.id ?? "", branchId: branch?.id ?? "" };
}

export function AcquisitionCreationForm({ config, initialBrandId, initialMode, action }: {
  config: AcquisitionConfiguration;
  initialBrandId?: string;
  initialMode?: "wix" | "landing_page";
  action: (data: FormData) => AcquisitionActionResult | Promise<AcquisitionActionResult>;
}) {
  const initialBrand = config.brands.find(item => item.id === initialBrandId || item.slug === initialBrandId)
    ?? (config.brands.length === 1 ? config.brands[0] : undefined);
  const initial = firstSelection(config, initialBrand?.id ?? "");
  const [purpose, setPurpose] = useState<"wix" | "landing_page" | null>(initialMode ?? null);
  const [step, setStep] = useState(1);
  const [reuseForm, setReuseForm] = useState(false);
  const [existingFormId, setExistingFormId] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submissionLock = useRef(false);
  const attemptedFingerprint = useRef<string | null>(null);
  const form = useForm<ManagedFormFields, unknown, ManagedFormValues>({
    resolver: zodResolver(managedFormSchema),
    defaultValues: {
      formName: [initialBrand?.name, config.packages.find(item => item.id === initial.packageId)?.name].filter(Boolean).join(" · "), brandId: initialBrand?.id ?? "", defaultTreatmentId: initial.treatmentId,
      defaultPackageId: initial.packageId, packageSelectionMode: "fixed", packageIds: initial.packageId ? [initial.packageId] : [],
      defaultBranchId: initial.branchId, branchIds: initial.branchId ? [initial.branchId] : [], allowedDomains: "",
      placementKind: initialMode ?? "wix", placementUrl: "",
    },
    mode: "onBlur",
  });
  const values = useWatch({ control: form.control, compute: (fields: ManagedFormFields) => fields });
  const brand = config.brands.find(item => item.id === values.brandId);
  const treatment = config.treatments.find(item => item.id === values.defaultTreatmentId);
  const offer = config.packages.find(item => item.id === values.defaultPackageId);
  const branch = config.branches.find(item => item.id === values.defaultBranchId);
  const treatments = config.treatments.filter(item => item.brandId === values.brandId && item.status === "active");
  const offers = config.packages.filter(item => item.treatmentId === values.defaultTreatmentId && item.status === "active");
  const activeTreatmentIds = new Set(treatments.map(item => item.id));
  const choiceOffers = config.packages.filter(item => activeTreatmentIds.has(item.treatmentId) && item.status === "active");
  const branches = config.branches.filter(item => item.brandId === values.brandId && item.status === "active");
  const reusable = config.forms.filter(item => item.brandId === values.brandId && item.status === "active");
  const selectedExisting = reusable.find(item => item.id === existingFormId);

  useEffect(() => { form.setValue("requestId", crypto.randomUUID()); }, [form]);

  function suggestName(brandId: string, packageId: string) {
    if (form.getFieldState("formName").isDirty) return;
    const nextBrand = config.brands.find(item => item.id === brandId);
    const nextOffer = config.packages.find(item => item.id === packageId);
    form.setValue("formName", [nextBrand?.name, nextOffer?.name].filter(Boolean).join(" · "));
  }
  function selectBrand(id: string) {
    const next = firstSelection(config, id);
    form.setValue("brandId", id, { shouldDirty: true });
    form.setValue("defaultTreatmentId", next.treatmentId);
    form.setValue("defaultPackageId", next.packageId);
    form.setValue("packageIds", next.packageId ? [next.packageId] : []);
    form.setValue("defaultBranchId", next.branchId);
    form.setValue("branchIds", next.branchId ? [next.branchId] : []);
    setExistingFormId(""); suggestName(id, next.packageId); setFailure(null);
  }
  function selectTreatment(id: string) {
    const next = config.packages.find(item => item.treatmentId === id && item.status === "active");
    form.setValue("defaultTreatmentId", id, { shouldDirty: true });
    form.setValue("defaultPackageId", next?.id ?? "");
    form.setValue("packageIds", next ? [next.id] : []);
    suggestName(values.brandId, next?.id ?? "");
  }
  function selectExisting(id: string) {
    setExistingFormId(id);
    const selected = reusable.find(item => item.id === id);
    if (!selected) return;
    form.setValue("defaultTreatmentId", selected.defaultTreatmentId ?? "");
    form.setValue("defaultPackageId", selected.defaultPackageId ?? "");
    form.setValue("packageIds", selected.defaultPackageId ? [selected.defaultPackageId] : []);
    form.setValue("defaultBranchId", selected.defaultBranchId ?? "");
    form.setValue("branchIds", selected.defaultBranchId ? [selected.defaultBranchId] : []);
    suggestName(selected.brandId, selected.defaultPackageId ?? "");
  }
  async function next() {
    setFailure(null);
    if (step === 1) { if (purpose) setStep(2); return; }
    if (reuseForm && !selectedExisting) { setFailure("請選擇要使用的登記表格。"); return; }
    if (purpose === "wix" && !values.placementUrl.trim() && !values.allowedDomains.trim()) {
      form.setError("placementUrl", { message: "請填入準備放置表格的網站網址。" }, { shouldFocus: true });
      return;
    }
    if (await form.trigger()) setStep(3);
  }
  function submit(fields: ManagedFormValues) {
    if (step !== 3 || !purpose || submissionLock.current) return;
    submissionLock.current = true; setFailure(null);
    const fingerprint = JSON.stringify({ ...fields, requestId: undefined, purpose, existingFormId: reuseForm ? existingFormId : "", headline, description });
    const requestId = attemptedFingerprint.current && attemptedFingerprint.current !== fingerprint ? crypto.randomUUID() : fields.requestId ?? crypto.randomUUID();
    form.setValue("requestId", requestId); attemptedFingerprint.current = fingerprint;
    const data = new FormData();
    Object.entries({ ...fields, requestId }).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach(item => data.append(key, item));
      else if (value !== undefined) data.set(key, String(value));
    });
    data.set("campaignName", fields.formName); data.set("formName", fields.formName);
    data.set("campaignMode", purpose === "wix" ? "wix_form" : reuseForm ? "existing_form_landing_page" : "new_landing_page");
    if (reuseForm) data.set("existingFormId", existingFormId);
    if (purpose === "landing_page") {
      data.set("pageTitle", fields.formName); data.set("heroTitle", headline.trim() || fields.formName);
      data.set("heroSubtitle", description.trim()); data.set("ctaText", "立即登記");
    }
    startTransition(async () => {
      try {
        const result = await action(data);
        if (result && !result.ok) {
          setFailure(result.message);
          Object.entries(result.fieldErrors ?? {}).forEach(([key, message]) => form.setError(key as keyof ManagedFormFields, { message }));
        }
      } catch (error) {
        if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
        setFailure("暫時未能建立，資料已保留。請再試一次。");
      } finally { submissionLock.current = false; }
    });
  }
  const fieldError = (name: keyof ManagedFormFields) => form.formState.errors[name]?.message;

  return <form onSubmit={event => { void form.handleSubmit(submit)(event); }} noValidate data-testid="acquisition-creation-form" className="grid gap-5">
    <input type="hidden" {...form.register("requestId")} />
    <ol className="grid grid-cols-3 gap-2" aria-label="建立步驟">
      {["選擇用途", "優惠設定", "檢查及建立"].map((name, index) => <li key={name} aria-current={step === index + 1 ? "step" : undefined} className={`flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-3 text-xs font-medium sm:text-sm ${step === index + 1 ? "bg-system-primary text-system-primary-foreground" : "bg-system-muted text-system-muted-foreground"}`}><span className="grid size-5 shrink-0 place-items-center rounded-full border border-current">{step > index + 1 ? <Check size={12} /> : index + 1}</span><span>{name}</span></li>)}
    </ol>
    {failure ? <div role="alert" className="rounded-[var(--radius-control)] border border-system-destructive/30 bg-system-destructive/5 p-4 text-sm text-system-destructive">{failure}</div> : null}
    <section className={panelClass} data-testid="acquisition-step" data-step={step}>
      {step === 1 ? <>
        <h2 className="text-xl font-semibold">今次用喺邊度？</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {([{ value: "wix", label: "放入Wix網站", detail: "網站已有內容，只需加入登記表格。", Icon: FileText }, { value: "landing_page", label: "建立獨立廣告頁", detail: "建立一張連登記表格的獨立頁面。", Icon: Globe }] as const).map(({ value, label, detail, Icon }) => <button key={value} type="button" aria-pressed={purpose === value} data-testid={`acquisition-purpose-${value === "wix" ? "wix" : "landing"}`} onClick={() => { setPurpose(value); form.setValue("placementKind", value); }} className={`flex min-h-40 flex-col items-start rounded-[var(--radius-card)] border p-5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-system-ring ${purpose === value ? "border-system-primary bg-system-accent" : "border-system-border bg-system-card hover:bg-system-muted"}`}><Icon size={24} aria-hidden="true" className="mb-4 text-system-primary" /><span className="font-semibold">{label}</span><span className="mt-2 text-sm leading-6 text-system-muted-foreground">{detail}</span></button>)}
        </div>
      </> : step === 2 ? <div className="grid gap-5">
        <div><h2 className="text-xl font-semibold">設定今次優惠</h2><p className="mt-2 text-sm text-system-muted-foreground">選好內容，之後可以隨時修改。</p></div>
        <label className={labelClass}>品牌<select aria-label="品牌" aria-invalid={!!fieldError("brandId")} className={acquisitionFieldClass} value={values.brandId} onChange={e => selectBrand(e.target.value)}><option value="">請選擇品牌</option>{config.brands.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError("brandId") ? <FieldError>{fieldError("brandId")}</FieldError> : null}</label>
        {purpose === "landing_page" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reuseForm} onChange={e => { setReuseForm(e.target.checked); setExistingFormId(""); if (!e.target.checked) selectBrand(values.brandId); }} />使用現有登記表格</label> : null}
        {reuseForm ? <>
          <label className={labelClass}>現有登記表格<select aria-label="現有登記表格" className={acquisitionFieldClass} value={existingFormId} onChange={e => selectExisting(e.target.value)}><option value="">請選擇表格</option>{reusable.map(item => <option key={item.id} value={item.id}>{item.formName}</option>)}</select></label>
          {selectedExisting ? <div className="rounded-[var(--radius-control)] bg-system-muted p-4 text-sm leading-6">{treatment?.name} · {offer ? packagePriceLabel(offer) : "未設定優惠"} · {branch?.name}</div> : <p className="text-sm text-system-muted-foreground">只會顯示這個品牌正在接收登記的表格。</p>}
        </> : <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>療程<select aria-label="療程" className={acquisitionFieldClass} value={values.defaultTreatmentId} onChange={e => selectTreatment(e.target.value)}><option value="">請選擇療程</option>{treatments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError("defaultTreatmentId") ? <FieldError>{fieldError("defaultTreatmentId")}</FieldError> : null}</label>
          <label className={labelClass}>優惠<select aria-label="優惠" className={acquisitionFieldClass} value={values.defaultPackageId} onChange={e => { form.setValue("defaultPackageId", e.target.value, { shouldDirty: true }); form.setValue("packageIds", [e.target.value].filter(Boolean)); suggestName(values.brandId, e.target.value); }}><option value="">請選擇優惠</option>{offers.map(item => <option key={item.id} value={item.id}>{packagePriceLabel(item)}</option>)}</select>{fieldError("defaultPackageId") ? <FieldError>{fieldError("defaultPackageId")}</FieldError> : null}</label>
          <label className={labelClass}>預設分店<select aria-label="預設分店" className={acquisitionFieldClass} value={values.defaultBranchId} onChange={e => { form.setValue("defaultBranchId", e.target.value, { shouldDirty: true }); form.setValue("branchIds", [e.target.value].filter(Boolean)); }}><option value="">請選擇分店</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError("defaultBranchId") ? <FieldError>{fieldError("defaultBranchId")}</FieldError> : null}</label>
        </div>}
        <label className={labelClass}>管理名稱<input aria-label="管理名稱" className={acquisitionFieldClass} placeholder="例如：夏季輕腿優惠" {...form.register("formName")} aria-invalid={!!fieldError("formName")} />{fieldError("formName") ? <FieldError>{fieldError("formName")}</FieldError> : <span className="mt-2 block text-xs text-system-muted-foreground">方便同事辨認，客人唔會見到呢個名稱。</span>}</label>
        {purpose === "wix" ? <label className={labelClass}>網站網址<input type="url" aria-label="網站網址" className={acquisitionFieldClass} placeholder="https://www.example.com/offer" {...form.register("placementUrl")} aria-invalid={!!fieldError("placementUrl")} />{fieldError("placementUrl") ? <FieldError>{fieldError("placementUrl")}</FieldError> : <span className="mt-2 block text-xs text-system-muted-foreground">填入準備放表格的網站頁面，讓系統接收該網站的登記。</span>}</label> : <div className="grid gap-5"><label className={labelClass}>主要標題<input aria-label="主要標題" className={acquisitionFieldClass} value={headline} onChange={e => setHeadline(e.target.value)} placeholder="留空會使用管理名稱" /></label><label className={labelClass}>頁面簡介<textarea aria-label="頁面簡介" className={acquisitionFieldClass} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="用幾句說明療程及優惠。" /></label></div>}
        <SystemDetails title="進階設定">
          {!reuseForm ? <div className="mb-4 grid gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.packageSelectionMode === "customer_choice"} onChange={e => form.setValue("packageSelectionMode", e.target.checked ? "customer_choice" : "fixed")} />讓客人選擇多個優惠</label>
            {values.packageSelectionMode === "customer_choice" ? <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-medium">可選優惠</legend>{choiceOffers.map(item => <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" value={item.id} {...form.register("packageIds")} />{config.treatments.find(treatment => treatment.id === item.treatmentId)?.name} · {packagePriceLabel(item)}</label>)}</fieldset> : null}
            {branches.length > 1 ? <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-medium">可選分店</legend>{branches.map(item => <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" value={item.id} {...form.register("branchIds")} />{item.name}</label>)}</fieldset> : null}
          </div> : null}
          <label className={labelClass}>額外允許網站<textarea aria-label="額外允許網站" rows={3} className={acquisitionFieldClass} {...form.register("allowedDomains")} placeholder="一般情況毋須填寫" /></label>
        </SystemDetails>
      </div> : <>
        <h2 className="text-xl font-semibold">確認內容</h2>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">{[["用途", purpose === "wix" ? "放入Wix網站" : "獨立廣告頁"], ["管理名稱", values.formName], ["品牌", brand?.name], ["療程", treatment?.name], ["優惠", offer ? packagePriceLabel(offer) : ""], ["分店", branch?.name], ...(reuseForm ? [["使用表格", selectedExisting?.formName]] : []), ...(purpose === "wix" && values.placementUrl ? [["網站網址", values.placementUrl]] : [])].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-system-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value || "未設定"}</dd></div>)}</dl>
        <p className="mt-5 rounded-[var(--radius-control)] bg-system-muted p-4 text-sm leading-6 text-system-muted-foreground">{purpose === "wix" ? "建立後會顯示安裝步驟，方便你將表格放入網站。" : "會先建立草稿；預覽及確認內容後，再發佈給客人。"}</p>
      </>}
    </section>
    <div className="flex items-center justify-between gap-3">
      {step > 1 ? <SystemButton type="button" variant="outline" disabled={pending} data-testid="acquisition-back" onClick={() => { setFailure(null); setStep(step - 1); }}><ArrowLeft size={16} />上一步</SystemButton> : <span />}
      {step < 3 ? <SystemButton type="button" disabled={!purpose} data-testid="acquisition-next" onClick={() => { void next(); }}>繼續<ArrowRight size={16} /></SystemButton> : <SystemButton type="submit" disabled={pending} aria-busy={pending} data-testid="acquisition-submit">{pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" size={16} /> : <Check size={16} />}{pending ? "建立中…" : purpose === "wix" ? "建立登記表格" : "建立廣告頁草稿"}</SystemButton>}
    </div>
  </form>;
}

function FieldError({ children }: { children?: string }) { return <span role="alert" className="mt-2 block text-xs text-system-destructive">{children}</span>; }
