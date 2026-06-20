export type CrmWriteMode = {
  enabled: boolean;
  actionsEnabled: boolean;
  label: string;
  disabledReason: string | null;
};

export function getCrmWriteMode(): CrmWriteMode {
  const enabled = process.env.CRM_WRITE_ENABLED?.trim().toLowerCase() === "true";

  return {
    enabled,
    actionsEnabled: false,
    label: enabled ? "CRM write flag enabled" : "CRM writes disabled",
    disabledReason: enabled
      ? "CRM_WRITE_ENABLED is true, but CRM tables and server actions are not active in this safe foundation build."
      : "CS actions are not enabled yet. Set CRM_WRITE_ENABLED=true only after CRM tables and server actions are deployed.",
  };
}
