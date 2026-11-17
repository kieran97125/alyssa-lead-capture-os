import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SystemSubmitButton } from "./SystemSubmitButton";
const meta = { title: "System/Actions/Submit", component: SystemSubmitButton, args: { children: "寄出安全登入連結" } } satisfies Meta<typeof SystemSubmitButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
