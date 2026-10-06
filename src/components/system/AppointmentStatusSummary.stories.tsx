import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppointmentStatusSummary } from "./AppointmentStatusSummary";

const meta = { title: "System/AppointmentStatusSummary", component: AppointmentStatusSummary,
  parameters: { layout: "padded" }, tags: ["autodocs"] } satisfies Meta<typeof AppointmentStatusSummary>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Current: Story = { args: { summary: { available: true, cancellations: 2, reschedules: 1, undated: 0,
  rows: [{ key: "example", account: "Example Account", brand: "Example Brand", treatment: "Example Treatment", cancellations: 2, reschedules: 1 }] } } };
export const Empty: Story = { args: { summary: { available: true, cancellations: 0, reschedules: 0, undated: 0, rows: [] } } };
export const AwaitingRefresh: Story = { args: { summary: { available: false, cancellations: 0, reschedules: 0, undated: 0, rows: [] } } };
export const MissingSchedule: Story = { args: { summary: { ...Current.args.summary, undated: 2 } } };
