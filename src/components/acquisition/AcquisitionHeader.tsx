import Link from "next/link";
import { Plus } from "lucide-react";
import { SystemButton } from "@/components/system/SystemButton";

export function AcquisitionHeader({ tab, brand = "" }: { tab: "forms" | "pages"; brand?: string }) {
  const link = (value: string) => `/campaigns?${new URLSearchParams({ tab: value, ...(brand ? { brand } : {}) })}`;
  return <header className="grid gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-system-muted-foreground">推廣管理</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-system-foreground">表格及廣告頁</h1><p className="mt-2 text-sm text-system-muted-foreground">整理優惠、放置位置同收到的登記。</p></div>
      <SystemButton nativeButton={false} render={<Link href={`/campaigns/new${brand ? `?brand=${encodeURIComponent(brand)}` : ""}`} />}><Plus size={17} aria-hidden="true" />新增推廣</SystemButton>
    </div>
    <nav aria-label="推廣類型" className="flex gap-1 border-b border-system-border">
      {[{ value: "forms", name: "登記表格" }, { value: "pages", name: "Landing Pages" }].map(item => <Link key={item.value} href={link(item.value)} aria-current={tab === item.value ? "page" : undefined} className={`border-b-2 px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-system-ring ${tab === item.value ? "border-system-primary text-system-primary" : "border-transparent text-system-muted-foreground hover:text-system-foreground"}`}>{item.name}</Link>)}
    </nav>
  </header>;
}
