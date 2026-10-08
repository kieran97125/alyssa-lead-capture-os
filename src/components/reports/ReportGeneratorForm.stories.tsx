import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ReportGeneratorForm } from "@/components/reports/ReportGeneratorForm";

const meta = {
  title: "Reports/Google Slides Generator",
  component: ReportGeneratorForm,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: {
    options: {
      defaultStartDate: "2026-10-01",
      defaultEndDate: "2026-10-07",
      brandOptions: [{ value: "", label: "全部品牌" }, { value: "gos", label: "GOS Beauty" }],
    },
  },
  decorators: [(Story) => <main className="command-page report-generator-page"><div className="command-page-inner"><h1 className="command-page-title">報告生成</h1><Story /></div></main>],
} satisfies Meta<typeof ReportGeneratorForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GoogleSlidesDefault: Story = {};
export const SingleBrand: Story = {
  args: { options: { ...meta.args.options, brandOptions: [{ value: "", label: "GOS Beauty" }] } },
};
