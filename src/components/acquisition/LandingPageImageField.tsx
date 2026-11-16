"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { SystemButton } from "@/components/system/SystemButton";
import { SystemDetails } from "@/components/system/SystemDetails";
import { safePlacementUrl } from "@/lib/acquisition/managementDisplay";
import { acquisitionFieldClass } from "./managedFormUi";

export function LandingPageImageField({ label, name, value, guidance }: {
  label: string; name: string; value: string; guidance: string;
}) {
  const [url, setUrl] = useState(value);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const source = safePlacementUrl(url);
  return <div className="grid min-w-0 gap-3 rounded-[var(--radius-card)] border border-system-border p-4">
    <div><h3 className="text-sm font-semibold">{label}</h3><p className="mt-1 text-xs leading-5 text-system-muted-foreground">{guidance}</p></div>
    <div className="grid aspect-video overflow-hidden rounded-[var(--radius-control)] bg-system-muted">
      {source && failedUrl !== source ? (
        // Staff may use an existing image host; this preview must not proxy private URLs through the optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} alt={`${label}預覽`} className="h-full w-full object-contain" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(source)} />
      ) : <div className="grid place-content-center justify-items-center gap-2 p-4 text-xs text-system-muted-foreground"><ImageIcon size={24} aria-hidden="true" /><span>{source ? "暫時未能顯示，請檢查圖片連結。" : "未加入圖片"}</span></div>}
    </div>
    <SystemDetails title={url ? "更換圖片" : "加入圖片"}><label className="text-sm font-medium">圖片連結<input type="url" name={name} aria-label={`${label}連結`} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" className={acquisitionFieldClass} /></label><p className="mt-2 text-xs text-system-muted-foreground">貼上已上載圖片的完整連結。</p>{url ? <SystemButton variant="outline" density="compact" className="mt-3" type="button" onClick={() => setUrl("")}>移除圖片</SystemButton> : null}</SystemDetails>
  </div>;
}
