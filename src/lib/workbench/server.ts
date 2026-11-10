import "server-only";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";
import { canUsePrivateWorkbench } from "./access";

export async function getPrivateWorkbenchAccess() {
  const access = await getCurrentInternalAccess();
  const ownerId = process.env.ALYSSA_WORKBENCH_OWNER_MEMBER_ID?.trim();
  return { access, ownerId, allowed: canUsePrivateWorkbench(access, ownerId) };
}
export function workbenchMutationOriginAllowed(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  if (!origin) return site === "same-origin";
  try {
    const actual = new URL(request.url);
    const source = new URL(origin);
    const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    return source.host === actual.host || (!!forwarded && source.host === forwarded);
  } catch { return false; }
}
