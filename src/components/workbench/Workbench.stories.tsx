import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WorkbenchFixture } from "./WorkbenchFixture";
const meta = { title: "Alyssa/Private Workbench", component: WorkbenchFixture, parameters: { layout: "padded" }, tags: ["autodocs"] } satisfies Meta<typeof WorkbenchFixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WorkGalaxy: Story = { args: { empty: false } };
export const EmptyJobs: Story = { args: { empty: true } };
export const DenseGalaxy: Story = { args: { dense: true } };
