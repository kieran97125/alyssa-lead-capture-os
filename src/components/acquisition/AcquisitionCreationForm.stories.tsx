import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import { acquisitionFixtureConfig, fixtureIds } from "@/app/e2e/acquisition-management/fixtureData";
import { AcquisitionCreationForm } from "./AcquisitionCreationForm";

const meta = {
  title: "Acquisition/Guided creation",
  component: AcquisitionCreationForm,
  parameters: { layout: "padded" },
  args: {
    config: acquisitionFixtureConfig,
    initialBrandId: fixtureIds.brandA,
    action: async () => ({ ok: false as const, message: "暫時未能儲存，輸入內容已保留。請再試一次。" }),
  },
} satisfies Meta<typeof AcquisitionCreationForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ChoosePurpose: Story = {};
export const ChooseBrand: Story = { args: { initialBrandId: undefined, initialMode: "wix" }, play: async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByTestId("acquisition-next"));
} };
export const WixSettings: Story = { args: { initialMode: "wix" }, play: async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByTestId("acquisition-next"));
} };
export const LandingPageSettings: Story = { args: { initialMode: "landing_page" }, play: async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByTestId("acquisition-next"));
} };
export const FailedSavePreservesInput: Story = { args: { initialMode: "wix" }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByTestId("acquisition-next"));
  await userEvent.type(canvas.getByRole("textbox", { name: "網站網址" }), "https://example.test/offer");
  await userEvent.click(canvas.getByTestId("acquisition-next"));
  await userEvent.click(canvas.getByTestId("acquisition-submit"));
} };
