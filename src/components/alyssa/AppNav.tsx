import { AppNavClient } from "@/components/alyssa/AppNavClient";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";

export async function AppNav() {
  const access = await getCurrentInternalAccess();
  return <AppNavClient accessLevel={access.accessLevel} />;
}
