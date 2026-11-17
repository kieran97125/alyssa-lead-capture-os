import { notFound } from "next/navigation";
import { PlatformOverview } from "@/components/platform/PlatformOverview";
import { marketingPlatformFixture } from "@/lib/platform/fixture";
export const dynamic="force-dynamic";
export default function MarketingPlatformFixture(){
  if(process.env.ALYSSA_E2E_FIXTURES!=="1"&&process.env.NODE_ENV==="production")notFound();
  return <PlatformOverview data={marketingPlatformFixture} email="operator@example.test" canProvision/>;
}
