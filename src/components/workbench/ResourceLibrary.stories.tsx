import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ResourceLibrary } from "./ResourceLibrary";
import { createWorkbenchTemplate } from "@/lib/workbench/model";
const meta = { title: "Alyssa/Private Workbench/Connected Files", component: ResourceLibrary, parameters: { layout: "padded" }, args: { nodes: createWorkbenchTemplate().nodes, fixtureMode: true, onCreateJob: () => {} } } satisfies Meta<typeof ResourceLibrary>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Library: Story = {};
export const PlanetFiles: Story = { args: { nodeId: "creative", compact: true, onBrowse: () => {} } };
export const EmptyPlanet: Story = { args: { nodeId: "web", compact: true } };
