import { headers } from "next/headers";
import {
  authenticateInternalAccess,
  canAccessModule,
  canPerformAction,
  type InternalAction,
  type InternalAccessContext,
  type InternalModule,
} from "@/lib/security/internalAccess";

export async function getCurrentInternalAccess(): Promise<InternalAccessContext> {
  const headerStore = await headers();
  const result = authenticateInternalAccess(headerStore.get("authorization"));

  if (result.ok) return result.context;

  return {
    username: "",
    role: "lead_viewer",
    source: "local_dev_fallback",
  };
}

export async function requireModuleAccess(module: InternalModule) {
  const headerStore = await headers();
  const result = authenticateInternalAccess(headerStore.get("authorization"));

  return {
    access: result.ok ? result.context : null,
    allowed: result.ok ? canAccessModule(result.context.role, module) : false,
  };
}

export async function requireActionAccess(action: InternalAction) {
  const headerStore = await headers();
  const result = authenticateInternalAccess(headerStore.get("authorization"));

  return {
    access: result.ok ? result.context : null,
    allowed: result.ok ? canPerformAction(result.context.role, action) : false,
  };
}
