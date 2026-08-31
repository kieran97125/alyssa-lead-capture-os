import { notFound } from "next/navigation";
import { CreativeProductionFixture } from "@/components/creative/CreativeProductionFixture";

export default function CreativeProductionFixturePage() {
  const fixtureEnabled = process.env.ALYSSA_E2E_FIXTURES === "1";
  const localDevelopment = process.env.NODE_ENV !== "production";
  if (!fixtureEnabled && !localDevelopment) notFound();
  return <CreativeProductionFixture />;
}
