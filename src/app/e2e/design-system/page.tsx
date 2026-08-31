import { notFound } from "next/navigation";
import { DesignSystemSpecimen } from "@/components/system/DesignSystemSpecimen";

export default function DesignSystemFixturePage() {
  const fixtureEnabled = process.env.ALYSSA_E2E_FIXTURES === "1";
  const localDevelopment = process.env.NODE_ENV !== "production";
  if (!fixtureEnabled && !localDevelopment) notFound();
  return <DesignSystemSpecimen />;
}
