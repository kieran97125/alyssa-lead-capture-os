"use client";

import { useEffect, useState } from "react";

type LandingPageEditorDirtyStateProps = {
  editorFormId: string;
  publishButtonId: string;
};

export function LandingPageEditorDirtyState({
  editorFormId,
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

  if (!isDirty) return null;

  return (
    <p className="mt-3 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
      有未保存修改。按「保存草稿」會保存草稿；按「發布公開頁」會直接發布目前畫面上的內容。
    </p>
  );
}
