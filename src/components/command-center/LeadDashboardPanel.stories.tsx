import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LeadDashboardPanel } from "./LeadDashboardPanel";
import { leadDashboardAvailabilityFixture } from "../../../e2e/fixtures/lead-dashboard-availability";
import { buildLeadSheetGroups } from "@/lib/marketing/googleSheetsMetricParser";
import { buildLeadDashboardModel } from "@/lib/marketing/leadDashboardMath";

const meta = {
  title: "Dashboard/Lead authority availability",
  component: LeadDashboardPanel,
  parameters: { layout: "padded", nextjs: { appDirectory: true, navigation: { pathname: "/dashboard" } } },
  args: { snapshot: leadDashboardAvailabilityFixture(false) },
} satisfies Meta<typeof LeadDashboardPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unavailable: Story = {};
export const VerifiedEmpty: Story = { args: { snapshot: leadDashboardAvailabilityFixture(true) } };
export const SuccessfulWithAuditWarnings: Story = { args: { snapshot: {
  ...leadDashboardAvailabilityFixture(true), sourceStatus: "warning",
} } };
export const PreviousSuccessfulUpdate: Story = {
  render: ({ snapshot }) => <>
    {snapshot.warnings.map((warning) => <p key={warning} className="command-status-message is-error" role="status">{warning}</p>)}
    <LeadDashboardPanel snapshot={snapshot} />
  </>,
  args: {
    snapshot: {
      ...leadDashboardAvailabilityFixture(true),
      sourceStatus: "error",
      warnings: ["最近一次更新未成功；以下保留上次成功同步嘅資料。"],
    },
  },
};

const medicalBrands = [
  { id: "medical-brand", name: "Alyssa Medical", slug: "alyssa-medical" },
  { id: "aesthetics-brand", name: "Aesthetics Medical", slug: "aesthetics" },
];
const medicalFilters = { ...leadDashboardAvailabilityFixture(true).filters, accountId: "alyssa-medical" };
const medicalGroups = buildLeadSheetGroups({
  headers: ["最後更新日期", "Created At", "跟進狀態", "品牌", "Account", "電話", "療程項目"],
  rows: medicalBrands.map((brand, i) => ["2026-10-03", "2026-10-02", "已預約", brand.name, "Alyssa Medical", String(10000001+i), "Synthetic treatment"]),
  brands: medicalBrands, sourceBrandId: null,
});
export const MixedMedicalBrands: Story = { args: { snapshot: {
  ...leadDashboardAvailabilityFixture(true),
  ...buildLeadDashboardModel({ groups: medicalGroups.groups, brands: medicalBrands, filters: medicalFilters }),
  filters: medicalFilters, diagnostics: medicalGroups.diagnostics,
} } };
