"use client";

import { useEffect, useState } from "react";

type LandingPageEditorDirtyStateProps = {
  editorFormId: string;
  publishButtonId: string;
};

export function LandingPageEditorDirtyState({
  editorFormId,
  publishButtonId,
}: LandingPageEditorDirtyStateProps) {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const form = document.getElementById(editorFormId);
    if (!form) return;

    const markDirty = () => setIsDirty(true);
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);

    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
    };
  }, [editorFormId]);

  useEffect(() => {
    const button = document.getElementById(
      publishButtonId
    ) as HTMLButtonElement | null;
    if (!button || !isDirty) return;

    button.disabled = true;
    button.dataset.unsavedChanges = "true";
  }, [isDirty, publishButtonId]);

  if (!isDirty) return null;

  return (
    <p className="mt-3 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
      有未保存內容。請先保存草稿，然後再發布公開頁。
    </p>
  );
}
