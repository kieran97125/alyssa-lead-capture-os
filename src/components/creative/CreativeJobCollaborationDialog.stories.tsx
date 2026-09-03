import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreativeJobCollaborationDialog } from "@/components/creative/CreativeJobCollaborationDialog";

const meta = {
  title: "Creative/Creative Job Collaboration Dialog",
  component: CreativeJobCollaborationDialog,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: {
    jobId: "storybook-job",
    returnPath: "/creative-jobs/storybook-job",
    canContribute: true,
    fixtureMode: true,
    defaultOpen: true,
    assets: [
      {
        id: "storybook-final",
        jobId: "storybook-job",
        assetKind: "link",
        purpose: "final",
        label: "Final V1 Review Link",
        externalUrl: "https://example.com/final-v1",
        storagePath: null,
        mimeType: null,
        fileSize: null,
        createdByEmail: "designer@example.test",
        createdAt: "2026-09-03T05:10:00.000Z",
        url: "https://example.com/final-v1",
      },
      {
        id: "storybook-brief-only",
        jobId: "storybook-job",
        assetKind: "upload",
        purpose: "brief",
        label: "Brief Screenshot Only",
        externalUrl: null,
        storagePath: "creative-jobs/storybook-job/brief.png",
        mimeType: "image/png",
        fileSize: 1024,
        createdByEmail: "marketer@example.test",
        createdAt: "2026-09-03T05:05:00.000Z",
        url: "/api/creative-jobs/storybook-job/assets/storybook-brief-only",
      },
    ],
    comments: [
      {
        id: "storybook-comment",
        authorMemberId: "storybook-designer",
        authorName: "Designer",
        authorEmail: "designer@example.test",
        body: "已提交 Final V1，請確認字幕同 CTA。",
        createdAt: "2026-09-03T05:15:00.000Z",
      },
    ],
  },
} satisfies Meta<typeof CreativeJobCollaborationDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenDeliverables: Story = {};
