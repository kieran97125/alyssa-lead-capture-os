import { AppNav } from "@/components/alyssa/AppNav";
import { EmbedPreviewClient } from "@/components/alyssa/EmbedPreviewClient";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import { getDefaultEmbedCode, getEmbedScriptUrl } from "@/lib/data/appUrl";
import { redirect } from "next/navigation";

export default function EmbedPreviewPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALYSSA_E2E_FIXTURES !== "1"
  ) {
    redirect("/forms");
  }

  const embedScriptUrl = getEmbedScriptUrl();
  const embedCode = getDefaultEmbedCode(
    alyssaDefaultForm.publicFormToken,
    alyssaDefaultForm.id
  );

  return (
    <main className="alyssa-shell">
      <AppNav />
      <EmbedPreviewClient
        embedCode={embedCode}
        embedScriptUrl={embedScriptUrl}
        formId={alyssaDefaultForm.id}
        formToken={alyssaDefaultForm.publicFormToken}
      />
    </main>
  );
}
