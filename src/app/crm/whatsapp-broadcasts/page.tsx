import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function WhatsAppBroadcastsPage() {
  redirect("/crm?tab=leads");
}
