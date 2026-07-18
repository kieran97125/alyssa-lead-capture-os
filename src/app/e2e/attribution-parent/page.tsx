import { notFound } from "next/navigation";
import { AttributionParentFixture } from "./AttributionParentFixture";

export const dynamic = "force-dynamic";

export default function AttributionParentFixturePage() {
  if (process.env.ALYSSA_E2E_FIXTURES !== "1") notFound();
  return <AttributionParentFixture />;
}
