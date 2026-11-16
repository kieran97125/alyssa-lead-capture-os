import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Retired bookmarks retain ordinary workspace authentication. */
export default function RetiredLeadAuditPage() {
  redirect("/dashboard");
}
