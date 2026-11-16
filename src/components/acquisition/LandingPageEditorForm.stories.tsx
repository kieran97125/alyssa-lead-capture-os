import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import { LandingPageEditorForm } from "./LandingPageEditorForm";
import { LandingPageFormChoice } from "./LandingPageFormChoice";
import { LandingPageImageField } from "./LandingPageImageField";
import { acquisitionFieldClass } from "./managedFormUi";

const fail = async () => ({ ok: false as const, message: "暫時未能儲存，請稍後再試。" });

function EditorExample({ published = false, disabled = false }: { published?: boolean; disabled?: boolean }) {
  return <div className="mx-auto max-w-3xl"><LandingPageEditorForm saveAction={fail} previewAction={fail} publishAction={fail} published={published} disabled={disabled}>
    <input type="hidden" name="pageId" value="a6000000-0000-4000-8000-000000000001" />
    <input type="hidden" name="expectedRevision" value="1" />
    <input type="hidden" name="requestId" value="a7000000-0000-4000-8000-000000000001" />
    <section className="grid gap-5 rounded-[var(--radius-panel)] border border-system-border bg-system-card p-5"><h2 className="text-lg font-semibold">首屏內容</h2><label className="text-sm font-medium">主標題<input name="heroTitle" defaultValue="讓自己輕盈一點" className={acquisitionFieldClass} /></label><label className="text-sm font-medium">補充說明<textarea name="heroSubtitle" defaultValue="為你選擇合適的體驗療程。" rows={3} className={acquisitionFieldClass} /></label></section>
    <LandingPageImageField label="首屏主圖" name="heroImageUrl" value="" guidance="電腦版最上方的大圖，建議使用橫圖。" />
    <section className="rounded-[var(--radius-panel)] border border-system-border bg-system-card p-5"><LandingPageFormChoice initialFormId="example-face" options={[{ id: "example-face", name: "面部護理體驗", summary: "示例美容 · 面部護理 · HK$480 · A 分店", active: true }, { id: "example-body", name: "輕盈身體體驗", summary: "示例美容 · 身體護理 · HK$580 · B 分店", active: true }]} /></section>
  </LandingPageEditorForm></div>;
}

const meta = {
  title: "Acquisition/Landing page editor",
  component: EditorExample,
  parameters: { layout: "padded", nextjs: { appDirectory: true } },
} satisfies Meta<typeof EditorExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Draft: Story = {};
export const Published: Story = { args: { published: true } };
export const Unavailable: Story = { args: { disabled: true } };
export const FailedSave: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByRole("textbox", { name: "主標題" }), "，立即預約");
  await userEvent.click(canvas.getByRole("button", { name: "儲存草稿" }));
} };
