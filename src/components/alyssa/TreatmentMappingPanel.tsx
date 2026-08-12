import { SubmitButton } from "@/components/alyssa/SubmitButton";
import {
  createTreatmentMappingRuleAction,
  resyncTreatmentMappingAction,
  updateTreatmentMappingRuleAction,
} from "@/app/settings/treatments/mappingActions";
import { getTreatmentMappingRules } from "@/lib/marketing/treatmentMappingStore";

export async function TreatmentMappingPanel({
  brandId,
  brandName,
  returnPath,
}: {
  brandId: string;
  brandName: string;
  returnPath: string;
}) {
  const rules = await getTreatmentMappingRules({
    brandId,
    includeDisabled: true,
  });
  const nextSortOrder = Math.max(0, ...rules.map((rule) => rule.sortOrder)) + 10;

  return (
    <section id="lead-classification-rules" className="mt-8" data-testid="treatment-mapping-manager">
      <div className="rounded-[26px] border border-[#d9c7e4] bg-[linear-gradient(135deg,#fff_0%,#fbf7ff_55%,#fff9f3_100%)] p-5 shadow-[0_20px_60px_rgba(90,35,72,0.07)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#79539a]">
                Lead Classification Engine
              </p>
              <span className="rounded-full bg-[#efe7f7] px-3 py-1 text-[11px] font-bold text-[#684587]">
                System source of truth
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-bold text-[#321428]">療程分類規則</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#6d4a5c]">
              Growth OS 會用呢度嘅關鍵字將 Lead Sheet 原始「療程／優惠、療程項目、Campaign」標準化，再供 Dashboard、同期比較、療程成效同報告使用。Google Sheet 個「療程管理」只保留做歷史參考，唔再係控制中心。
            </p>
          </div>
          <form action={resyncTreatmentMappingAction}>
            <input type="hidden" name="brandId" value={brandId} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <SubmitButton
              className="rounded-full border border-[#d5c4e0] bg-white px-4 py-2.5 text-sm font-bold text-[#684587]"
              pendingLabel="同步中…"
            >
              重新套用分類
            </SubmitButton>
          </form>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="目前品牌" value={brandName} />
          <Metric label="規則" value={`${rules.length} 條`} />
          <Metric label="啟用中" value={`${rules.filter((rule) => rule.enabled).length} 條`} />
        </div>
      </div>

      <details className="mt-4 rounded-[22px] border border-[#d9c7e4] bg-white/94">
        <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-[#684587]">
          ＋ 新增 Lead 分類規則
        </summary>
        <form
          action={createTreatmentMappingRuleAction}
          className="grid gap-4 border-t border-[#eee4f3] p-5 lg:grid-cols-2"
        >
          <input type="hidden" name="brandId" value={brandId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <MappingInput label="項目代號" name="itemCode" placeholder="alyssa-new-treatment" />
          <MappingInput label="排序" name="sortOrder" type="number" defaultValue={String(nextSortOrder)} />
          <div className="lg:col-span-2">
            <MappingTextArea
              label="配對關鍵字"
              name="keywords"
              placeholder="keyword 1 | keyword 2 | keyword 3"
              helper="支援 |、全形｜或換行分隔；系統會自動去重。"
            />
          </div>
          <MappingTextArea label="標準輸出（原 I 欄）" name="outputLabel" />
          <MappingInput label="Dashboard 分類" name="dashboardLabel" />
          <div className="lg:col-span-2">
            <MappingTextArea label="備註" name="note" required={false} />
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-[#5a2348]">
            <input type="checkbox" name="enabled" defaultChecked />
            啟用規則
          </label>
          <div className="flex items-end justify-end">
            <SubmitButton
              className="rounded-full bg-[#684587] px-5 py-3 text-sm font-bold text-white"
              pendingLabel="建立及同步中…"
            >
              建立規則
            </SubmitButton>
          </div>
        </form>
      </details>

      <div
        className="mt-4 overflow-hidden rounded-[24px] border border-[#d9c7e4] bg-white/94 shadow-[0_18px_50px_rgba(90,35,72,0.05)]"
        data-testid="treatment-mapping-rule-list"
      >
        <div className="hidden grid-cols-[minmax(210px,1fr)_minmax(220px,1.2fr)_minmax(170px,0.9fr)_90px_70px] gap-4 bg-[#faf6fd] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#79539a] md:grid">
          <span>項目代號</span>
          <span>關鍵字</span>
          <span>Dashboard</span>
          <span>狀態</span>
          <span />
        </div>
        {rules.map((rule) => (
          <details key={rule.id} className="border-t border-[#eee4f3] first:border-t-0 md:first:border-t">
            <summary className="grid cursor-pointer gap-2 px-5 py-4 transition hover:bg-[#fdfaff] md:grid-cols-[minmax(210px,1fr)_minmax(220px,1.2fr)_minmax(170px,0.9fr)_90px_70px] md:items-center md:gap-4">
              <span className="break-words font-mono text-xs font-bold text-[#55376f]">{rule.itemCode}</span>
              <span className="line-clamp-2 text-xs font-semibold leading-5 text-[#6d4a5c]">{rule.keywords.join(" · ")}</span>
              <span className="text-sm font-bold text-[#321428]">{rule.dashboardLabel}</span>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${rule.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                {rule.enabled ? "啟用" : "停用"}
              </span>
              <span className="text-sm font-bold text-[#684587]">編輯</span>
            </summary>

            <form
              action={updateTreatmentMappingRuleAction}
              className="grid gap-4 border-t border-[#eee4f3] bg-[#fefcff] p-5 lg:grid-cols-2"
            >
              <input type="hidden" name="id" value={rule.id} />
              <input type="hidden" name="brandId" value={rule.brandId} />
              <input type="hidden" name="revision" value={rule.revision} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <MappingInput label="項目代號" name="itemCode" defaultValue={rule.itemCode} />
              <MappingInput label="排序" name="sortOrder" type="number" defaultValue={String(rule.sortOrder)} />
              <div className="lg:col-span-2">
                <MappingTextArea
                  label="配對關鍵字"
                  name="keywords"
                  defaultValue={rule.keywords.join(" | ")}
                  helper="修改後會自動更新 system compatibility cache，再重新同步 Lead classification。"
                />
              </div>
              <MappingTextArea label="標準輸出（原 I 欄）" name="outputLabel" defaultValue={rule.outputLabel} />
              <MappingInput label="Dashboard 分類" name="dashboardLabel" defaultValue={rule.dashboardLabel} />
              <div className="lg:col-span-2">
                <MappingTextArea label="備註" name="note" required={false} defaultValue={rule.note ?? ""} />
              </div>
              <label className="flex items-center gap-2 text-sm font-bold text-[#5a2348]">
                <input type="checkbox" name="enabled" defaultChecked={rule.enabled} />
                啟用規則
              </label>
              <div className="flex items-end justify-end">
                <SubmitButton
                  className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
                  pendingLabel="儲存及同步中…"
                >
                  儲存分類規則
                </SubmitButton>
              </div>
            </form>
          </details>
        ))}
        {rules.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm font-semibold text-[#7b5a6a]">
            此品牌未有 system-owned 分類規則。可以由上方新增第一條規則。
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white bg-white/80 px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9274aa]">{label}</span>
      <strong className="mt-1 block text-sm text-[#321428]">{value}</strong>
    </div>
  );
}

function MappingInput({
  label,
  name,
  defaultValue = "",
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#79539a]">{label}</span>
      <input
        required
        type={type}
        name={name}
        min={type === "number" ? 0 : undefined}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-[#ded0e7] bg-white px-4 py-3 text-sm font-semibold text-[#4d365c] outline-none focus:border-[#79539a]"
      />
    </label>
  );
}

function MappingTextArea({
  label,
  name,
  defaultValue = "",
  placeholder,
  helper,
  required = true,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  helper?: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#79539a]">{label}</span>
      <textarea
        required={required}
        name={name}
        rows={3}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-[#ded0e7] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#4d365c] outline-none focus:border-[#79539a]"
      />
      {helper ? <small className="mt-1 block text-xs font-semibold leading-5 text-[#8a7896]">{helper}</small> : null}
    </label>
  );
}
