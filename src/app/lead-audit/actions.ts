"use server";

import { redirect } from "next/navigation";

/** Old open tabs may still submit this action; retirement performs no writes. */
export async function reviewLeadAuditChangeAction(_formData: FormData): Promise<never> {
  void _formData;
  redirect("/dashboard");
}
