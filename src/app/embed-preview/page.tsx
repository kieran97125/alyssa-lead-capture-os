import { AppNav } from "@/components/alyssa/AppNav";
import { EmbedPreviewClient } from "@/components/alyssa/EmbedPreviewClient";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import { getDefaultEmbedCode, getEmbedScriptUrl } from "@/lib/data/appUrl";

export default function EmbedPreviewPage() {
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
