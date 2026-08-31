import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DesignSystemSpecimen } from "@/components/system/DesignSystemSpecimen";

const meta = {
  title: "System/Foundation/Specimen",
  component: DesignSystemSpecimen,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof DesignSystemSpecimen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Foundation: Story = {};
