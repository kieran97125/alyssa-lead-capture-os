"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createDemandSignal, createDemandSignalAsset, updateDemandSignalStatus } from "@/lib/demandSignals/service";
import {
  demandSignalAssetTypes, demandSignalSources, demandSignalStatuses, demandSignalTypes,
  type DemandSignalAssetType, type DemandSignalSource, type DemandSignalStatus, type DemandSignalType,
} from "@/lib/demandSignals/types";

function text(data: FormData, key: string, max = 2000) {
  return String(data.get(key) ?? "").trim().slice(0, max);
}
function isOneOf<T extends string>(value: string, values: readonly T[]): value is T {
  return values.includes(value as T);
}
function feedback(returnTo: string, ok: boolean, message: string) {
  const safe = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/growth-intelligence/demand-signals";
  const url = new URL(safe, "https://launchhub.local");
  url.searchParams.delete("signal_success");
  url.searchParams.delete("signal_error");
  url.searchParams.set(ok ? "signal_success" : "signal_error", message);
  return `${url.pathname}${url.search}`;
}

export async function createDemandSignalAction(data: FormData) {
  const returnTo = text(data, "returnTo", 1000);
  const signalType = text(data, "signalType", 40);
  const sourceType = text(data, "sourceType", 40);
  if (!isOneOf(signalType, demandSignalTypes) || !isOneOf(sourceType, demandSignalSources)) {
    redirect(feedback(returnTo, false, "invalid_signal_type_or_source"));
  }
  const result = await createDemandSignal({
    brandId: text(data, "brandId", 100), signalType: signalType as DemandSignalType,
    exactQuote: text(data, "exactQuote"), normalizedTag: text(data, "normalizedTag", 100),
    summary: text(data, "summary", 500), sourceType: sourceType as DemandSignalSource,
    formId: text(data, "formId", 100) || undefined,
    treatmentId: text(data, "treatmentId", 100) || undefined,
  });
  revalidatePath("/growth-intelligence/demand-signals");
  redirect(feedback(returnTo, result.ok, result.message));
}

export async function updateDemandSignalStatusAction(data: FormData) {
  const returnTo = text(data, "returnTo", 1000);
  const status = text(data, "status", 40);
  if (!isOneOf(status, demandSignalStatuses)) redirect(feedback(returnTo, false, "invalid_status"));
  const result = await updateDemandSignalStatus({
    brandId: text(data, "brandId", 100), signalId: text(data, "signalId", 100), status: status as DemandSignalStatus,
  });
  revalidatePath("/growth-intelligence/demand-signals");
  revalidatePath(`/crm/leads/${text(data, "leadId", 100)}`);
  redirect(feedback(returnTo, result.ok, result.message));
}

export async function createDemandSignalAssetAction(data: FormData) {
  const returnTo = text(data, "returnTo", 1000);
  const assetType = text(data, "assetType", 60);
  if (!isOneOf(assetType, demandSignalAssetTypes)) redirect(feedback(returnTo, false, "invalid_asset_type"));
  const result = await createDemandSignalAsset({
    brandId: text(data, "brandId", 100),
    signalIds: data.getAll("signalIds").map(String).map((item) => item.trim()).filter(Boolean),
    assetType: assetType as DemandSignalAssetType,
    title: text(data, "title", 300),
  });
  revalidatePath("/growth-intelligence/demand-signals");
  redirect(feedback(returnTo, result.ok, result.message));
}
