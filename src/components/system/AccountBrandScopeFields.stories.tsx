import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AccountBrandScopeFields } from "./AccountBrandScopeFields";

const meta = {
  title: "System/Filters/AccountBrandScopeFields",
  component: AccountBrandScopeFields,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <form
        className="lead-dashboard-filter-form"
        style={{ minWidth: 620, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
      >
        <Story />
      </form>
    ),
  ],
  args: {
    accountOptions: [
      { value: "alyssa-main", label: "Alyssa Main" },
      { value: "alyssa-medical", label: "Alyssa Medical" },
      { value: "alyssa-aesthetics", label: "Alyssa Aesthetics" },
      { value: "gos-beauty", label: "GOS Beauty" },
      { value: "ineffable", label: "Ineffable" },
      { value: "skin-light", label: "Skin Light" },
    ],
    brandOptions: [],
    accountId: "",
    brandId: "",
  },
} satisfies Meta<typeof AccountBrandScopeFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AccountNotSelected: Story = {};

export const AlyssaAestheticsSelected: Story = {
  args: {
    accountId: "alyssa-aesthetics",
    brandOptions: [
      { value: "alyssa", label: "Alyssa Aesthetics" },
      { value: "aesthetics", label: "Aesthetics Medical" },
    ],
  },
};

export const MedicalBrandSelected: Story = {
  args: {
    accountId: "alyssa-aesthetics",
    brandId: "aesthetics",
    brandOptions: [
      { value: "alyssa", label: "Alyssa Aesthetics" },
      { value: "aesthetics", label: "Aesthetics Medical" },
    ],
  },
};
