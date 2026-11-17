import type { PlatformOverview } from "./workspaces";
export const marketingPlatformFixture: PlatformOverview = {
  workspaces: [
    { id:"fixture-existing",slug:"example-group",name:"示例客戶集團",status:"active",plan:"enterprise",members:3,brands:6,isolation:"pending" },
    { id:"fixture-new",slug:"example-studio",name:"示例工作室",status:"provisioning",plan:"enterprise",members:0,brands:0,isolation:"pending" },
  ],
  cards: [
    {key:"MKT-TENANCY",title:"完整客戶資料隔離",state:"in_progress",acceptance:"跨客戶資料及權限驗收通過後，先會開通新工作區。"},
    {key:"MKT-OMNICHAT",title:"Omnichat 自動收集 Lead",state:"blocked",acceptance:"正核實可接收事件、廣告來源及安全驗證，接駁後減少同事重複入資料。"},
  ],
};
