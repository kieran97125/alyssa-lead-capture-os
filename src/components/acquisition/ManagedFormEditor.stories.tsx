import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { acquisitionFixtureConfig, fixtureIds } from "@/app/e2e/acquisition-management/fixtureData";
import { ManagedFormEditor } from "./ManagedFormEditor";

const active = acquisitionFixtureConfig.forms.find(item => item.id === fixtureIds.activeFormA)!;
const stopped = acquisitionFixtureConfig.forms.find(item => item.id === fixtureIds.stoppedFormA)!;
const meta = {
  title: "Acquisition/Form settings",
  component: ManagedFormEditor,
  parameters: { layout: "padded" },
  args: {
    config: acquisitionFixtureConfig,
    setting: active,
    selectedPackageIds: [fixtureIds.faceOffer],
    selectedBranchIds: [fixtureIds.branchA],
    action: async () => ({ ok: false as const, message: "設定已由其他同事更新。你的修改已保留，請先核對最新版本。" }),
  },
} satisfies Meta<typeof ManagedFormEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Receiving: Story = {};
export const Archived: Story = { args: { setting: stopped, selectedPackageIds: [fixtureIds.bodyOffer], selectedBranchIds: [fixtureIds.branchASecond] } };
export const MultipleChoices: Story = { args: { setting: { ...active, packageSelectionMode: "customer_choice" }, selectedBranchIds: [fixtureIds.branchA, fixtureIds.branchASecond] } };
export const SelectedOfferStopped: Story = { args: { setting: { ...active, defaultPackageId: fixtureIds.inactiveOffer }, selectedPackageIds: [fixtureIds.inactiveOffer] } };
