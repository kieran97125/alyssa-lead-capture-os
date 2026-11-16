import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LeadDeliveryStatusPanel } from "./LeadDeliveryStatusPanel";

const checkedAt = "2026-11-16T03:00:00.000Z";
const meta = {
  title: "Capture/Delivery status",
  component: LeadDeliveryStatusPanel,
  parameters: { layout: "padded" },
  args: { summary: { available: true, counts: { pending: 4, retry: 2, processing: 1, delivered: 1280, blocked: 0, uncertain: 0, skipped: 2 }, total: 1289, checkedAt } },
} satisfies Meta<typeof LeadDeliveryStatusPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Empty: Story = { args: { summary: { available: true, counts: { pending: 0, retry: 0, processing: 0, delivered: 0, blocked: 0, uncertain: 0, skipped: 0 }, total: 0, checkedAt } } };
export const ReadUnavailable: Story = { args: { summary: { available: false, reason: "read_failed" } } };
export const ConfigurationRequired: Story = { args: { summary: { available: false, reason: "not_configured" } } };
export const NeedsReview: Story = { args: { summary: { available: true, counts: { pending: 1, retry: 0, processing: 0, delivered: 10, blocked: 2, uncertain: 3, skipped: 0 }, total: 16, checkedAt }, recoveryAccess: { allowed: true }, recheckAction: async () => undefined } };
export const RecoveryRequiresMember: Story = { args: { ...NeedsReview.args, recoveryAccess: { allowed: false, reason: "member_required" }, recheckAction: undefined } };
export const RecoveryScheduled: Story = { args: { ...NeedsReview.args, feedback: { status: "scheduled", count: 3 } } };
export const RecoveryFailed: Story = { args: { ...NeedsReview.args, feedback: { status: "failed" } } };
