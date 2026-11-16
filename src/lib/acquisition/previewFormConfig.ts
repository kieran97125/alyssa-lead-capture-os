import type { ConfigurationData, FormSetting } from "@/lib/data/configuration";
import type { PublicFormConfigSuccess } from "@/lib/data/publicFormConfig";

/** Builds an inert preview from an already authorized management read. No public fetch or writes. */
export function buildPreviewFormConfig(config: ConfigurationData, form: FormSetting): PublicFormConfigSuccess {
  const brand = config.brands.find(item => item.id === form.brandId);
  const treatments = config.treatments.filter(item => item.brandId === form.brandId && item.status === "active");
  const treatment = treatments.find(item => item.id === form.defaultTreatmentId);
  if (!brand || !treatment) throw new Error("preview_configuration_unavailable");
  const packageLinks = config.formPackages.filter(item => item.formId === form.id && item.isActive)
    .sort((left, right) => left.displayOrder - right.displayOrder);
  const packageIds = form.packageSelectionMode === "customer_choice" && packageLinks.length
    ? packageLinks.map(item => item.packageId) : form.defaultPackageId ? [form.defaultPackageId] : [];
  const treatmentIds = new Set(treatments.map(item => item.id));
  const packages = [...new Set(packageIds)].flatMap(id => {
    const item = config.packages.find(item => item.id === id && item.status === "active" && treatmentIds.has(item.treatmentId));
    return item ? [{ ...item }] : [];
  });
  const branchLinks = config.formBranches.filter(item => item.formId === form.id && item.isActive)
    .sort((left, right) => left.displayOrder - right.displayOrder);
  const activeBranches = config.branches.filter(item => item.brandId === form.brandId && item.status === "active");
  const branchIds = branchLinks.length ? branchLinks.map(item => item.branchId)
    : form.defaultBranchId ? [form.defaultBranchId] : activeBranches.map(item => item.id);
  const branches = [...new Set(branchIds)].flatMap((id, index) => {
    const item = activeBranches.find(item => item.id === id);
    const isDefault = branchLinks.length ? Boolean(branchLinks.find(link => link.branchId === id)?.isDefault)
      : form.defaultBranchId ? id === form.defaultBranchId : index === 0;
    return item ? [{ ...item, is_default: isDefault }] : [];
  });
  if (!packages.length || !branches.length) throw new Error("preview_configuration_unavailable");
  const selectedTreatmentIds = new Set(packages.map(item => item.treatmentId));
  return {
    ok: true,
    form: { ...form, public_form_token: form.publicFormToken, allowed_domains: form.allowedDomains,
      default_treatment_id: form.defaultTreatmentId, default_package_id: form.defaultPackageId,
      default_branch_id: form.defaultBranchId, package_selection_mode: form.packageSelectionMode,
      conversion_mode: form.conversionMode, success_redirect_url: form.successRedirectUrl },
    brand: { ...brand },
    treatments: treatments.filter(item => selectedTreatmentIds.has(item.id)).map(item => ({ ...item })),
    packages,
    branches,
  };
}
