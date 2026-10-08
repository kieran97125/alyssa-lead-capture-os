import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DashboardRefreshButton } from './DashboardRefreshButton';
const meta={title:'Dashboard/Lead Sheet update',component:DashboardRefreshButton,
 args:{idleLabel:'跟 Lead Sheet 更新',pendingLabel:'讀取 Lead Sheet 中…'},
 decorators:[Story=><form className="command-refresh-form"><Story /></form>],
} satisfies Meta<typeof DashboardRefreshButton>;
export default meta;
type Story=StoryObj<typeof meta>;
export const AllColleagues:Story={};
export const SourceUnavailable:Story={args:{disabled:true}};
