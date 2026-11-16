import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WixSetupPanel } from "./WixSetupPanel";

const meta = {
  title: "Acquisition/Wix setup",
  component: WixSetupPanel,
  parameters: { layout: "padded" },
  args: {
    formName: "夏日護理登記",
    embedCode: '<div id="registration"></div>\n<script src="https://public.example.test/embed/alyssa-form.js" data-form-token="example-form" data-target="#registration"></script>',
    wixAttributionBridgeCode: 'const HTML_COMPONENT_ID = "#html1";\n// Website source installation instructions',
    previewUrl: "https://public.example.test/embed/example-form",
    trackingParameters: "utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}",
  },
} satisfies Meta<typeof WixSetupPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NeedsInstallation: Story = {};
export const WebsiteRecorded: Story = { args: { placementUrl: "https://website.example.test/offer" } };
export const PreparingUnavailable: Story = { args: { embedCode: "", wixAttributionBridgeCode: "" } };
export const LongName: Story = { args: { formName: "十一月會員新客推薦限定面部及身體護理登記表格" } };
