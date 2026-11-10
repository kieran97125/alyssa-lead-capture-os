import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import { Workbench } from "@/components/workbench/Workbench";
import { getPrivateWorkbenchAccess } from "@/lib/workbench/server";
import styles from "@/components/workbench/Workbench.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "我的工作星圖 · Alyssa Growth OS", robots: { index: false, follow: false } };
export default async function WorkbenchPage() {
  const { allowed, access, ownerId } = await getPrivateWorkbenchAccess();
  if (!allowed) notFound();
  return <main className="alyssa-shell"><AppNav access={access} /><div className={styles.routeFrame}><Workbench ownerScope={ownerId} /></div></main>;
}
