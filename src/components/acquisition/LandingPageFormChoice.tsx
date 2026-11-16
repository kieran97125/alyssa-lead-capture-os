"use client";

import Link from "next/link";
import { useState } from "react";
import { acquisitionFieldClass } from "./managedFormUi";

export type LandingPageFormOption = { id: string; name: string; summary: string; active: boolean };

export function LandingPageFormChoice({ options, initialFormId }: { options: LandingPageFormOption[]; initialFormId: string }) {
  const [formId, setFormId] = useState(initialFormId);
  const selected = options.find(option => option.id === formId);
  return <div className="grid gap-3"><label className="text-sm font-medium">使用哪張表格？<select name="connectedFormId" aria-label="使用哪張表格？" value={formId} onChange={event => setFormId(event.target.value)} required className={acquisitionFieldClass}><option value="" disabled>請選擇表格</option>{options.map(option => <option key={option.id} value={option.id}>{option.name}{option.active ? "" : "（已停用）"}</option>)}</select></label>
    {selected ? <><p className="text-sm leading-6 text-system-muted-foreground" data-testid="selected-form-offer">{selected.summary}</p>{!selected.active ? <p role="status" className="text-sm text-system-destructive">這張表格已停用，請選擇正在接收登記的表格。</p> : null}<Link href={`/forms/${selected.id}`} className="w-fit text-sm font-semibold text-system-primary underline underline-offset-4">管理這張表格</Link></> : <p className="text-sm text-system-muted-foreground">請先選擇這個廣告頁使用的登記表格。</p>}
  </div>;
}
