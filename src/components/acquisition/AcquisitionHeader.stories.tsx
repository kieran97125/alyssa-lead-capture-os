import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AcquisitionHeader } from "./AcquisitionHeader";

const meta = {
  title: "Acquisition/Management header",
  component: AcquisitionHeader,
  parameters: { layout: "padded", nextjs: { appDirectory: true } },
  args: { tab: "forms", brand: "fixture-a" },
} satisfies Meta<typeof AcquisitionHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RegistrationForms: Story = {};
export const LandingPages: Story = { args: { tab: "pages" } };
