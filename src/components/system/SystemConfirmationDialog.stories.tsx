import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Trash2 } from "lucide-react";
import { SystemButton } from "@/components/system/SystemButton";
import { SystemConfirmationDialog } from "@/components/system/SystemConfirmationDialog";

function ConfirmationSpecimen({
  defaultOpen = false,
  iconOnly = false,
}: {
  defaultOpen?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <SystemConfirmationDialog
      defaultOpen={defaultOpen}
      triggerLabel="刪除 Job"
      triggerIcon={<Trash2 aria-hidden="true" />}
      triggerVariant="destructive"
      triggerSize={iconOnly ? "icon-lg" : "lg"}
      triggerAriaLabel={iconOnly ? "刪除 GOS KOL 脫毛廣告片" : undefined}
      iconOnly={iconOnly}
      title="刪除「GOS KOL 脫毛廣告片」？"
      description="呢張 Job 會即時由 Job List 移除，未來提醒會停止；系統 Audit 仍會保留操作記錄，方便追溯。"
      popupTestId="storybook-confirmation-dialog"
      confirmControl={
        <SystemButton variant="destructive" density="default">
          <Trash2 aria-hidden="true" />
          確認刪除
        </SystemButton>
      }
    />
  );
}

const meta = {
  title: "System/Overlays/SystemConfirmationDialog",
  component: ConfirmationSpecimen,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof ConfirmationSpecimen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ClosedDanger: Story = {};

export const IconTrigger: Story = {
  args: { iconOnly: true },
};

export const OpenDanger: Story = {
  args: { defaultOpen: true },
};
