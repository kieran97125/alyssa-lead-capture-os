import { Save, SlidersHorizontal } from "lucide-react";
import { upsertMonthlyPlanAction } from "@/app/command-center/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { BrandMark } from "@/components/command-center/BrandMark";
import { getCommandCenterSnapshot } from "@/lib/marketing/commandCenter";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function PlanningSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    command_status?: string | string[];
    message?: string | string[];
  }>;
}) {
  const [snapshot, query] = await Promise.all([
    getCommandCenterSnapshot(),
    searchParams,
  ]);
  const message = firstParam(query?.message);
  const status = firstParam(query?.command_status);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page">
        <div className="command-page-inner">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">Planning Control</p>
              <h1 className="command-page-title">月度 Budget／KPI 設定</h1>
              <p className="command-page-subtitle">
                設定 {snapshot.month.label}各品牌預算、Lead、Book、Show
                及內容產量。儲存後主頁同 KPI 頁會立即使用同一口徑。
              </p>
            </div>
            <span className="planning-month-chip">
              <SlidersHorizontal size={15} />
              {snapshot.month.monthStart}
            </span>
          </header>

          {message ? (
            <p
              className={`command-status-message ${
                status === "error" ? "is-error" : "is-success"
              }`}
            >
              {message}
            </p>
          ) : null}
          {!snapshot.schemaReady ? (
            <p className="command-status-message">
              Migration 尚未套用；可先檢視表格，正式上線時先會寫入設定。
            </p>
          ) : null}

          <section className="planning-grid">
            {snapshot.brands.map((brand) => (
              <form
                key={brand.id}
                action={upsertMonthlyPlanAction}
                className="command-surface planning-card"
              >
                <input type="hidden" name="brandId" value={brand.id} />
                <input
                  type="hidden"
                  name="monthStart"
                  value={snapshot.month.monthStart}
                />
                <input type="hidden" name="currency" value="HKD" />
                <input
                  type="hidden"
                  name="returnPath"
                  value="/settings/planning"
                />

                <header>
                  <BrandMark
                    compact
                    name={brand.name}
                    color={brand.color}
                  />
                  <div>
                    <h2>{brand.name}</h2>
                    <p>{snapshot.month.label}</p>
                  </div>
                </header>

                <div className="planning-input-grid">
                  <PlanningInput
                    label="月度 Budget"
                    name="budget"
                    defaultValue={brand.monthlyPlan.budget}
                    prefix="$"
                  />
                  <PlanningInput
                    label="Lead 目標"
                    name="leadTarget"
                    defaultValue={brand.monthlyPlan.leadTarget}
                  />
                  <PlanningInput
                    label="Book 目標"
                    name="bookingTarget"
                    defaultValue={brand.monthlyPlan.bookingTarget}
                  />
                  <PlanningInput
                    label="Show 目標"
                    name="showTarget"
                    defaultValue={brand.monthlyPlan.showTarget}
                  />
                  <PlanningInput
                    label="內容產量"
                    name="contentTarget"
                    defaultValue={brand.monthlyPlan.contentTarget}
                  />
                </div>

                <label className="planning-notes">
                  <span>備註</span>
                  <textarea
                    name="notes"
                    defaultValue={brand.monthlyPlan.notes ?? ""}
                    rows={2}
                    placeholder="例如：本月主推療程、投放調整、特殊活動"
                  />
                </label>

                <SubmitButton
                  className="command-primary-button"
                  disabled={!snapshot.schemaReady}
                  pendingLabel={`儲存 ${brand.name}…`}
                >
                  <Save size={15} />
                  儲存 {brand.name}
                </SubmitButton>
              </form>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}

function PlanningInput({
  label,
  name,
  defaultValue,
  prefix,
}: {
  label: string;
  name: string;
  defaultValue: number;
  prefix?: string;
}) {
  return (
    <label className="planning-input">
      <span>{label}</span>
      <div>
        {prefix ? <strong>{prefix}</strong> : null}
        <input
          type="number"
          name={name}
          min="0"
          step="1"
          defaultValue={defaultValue}
          required
        />
      </div>
    </label>
  );
}
