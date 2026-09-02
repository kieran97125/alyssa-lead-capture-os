from __future__ import annotations

from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one occurrence, found {count}: {old[:120]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


# Preserve an existing inactive treatment when the operator edits an unrelated field.
replace_once(
    "src/components/command-center/CalendarItemEditDialog.tsx",
    '''  const eligibleTreatments = useMemo(\n    () => treatments.filter((treatment) => treatment.brandId === draft.brandId),\n    [draft.brandId, treatments]\n  );''',
    '''  const eligibleTreatments = useMemo(() => {\n    const activeOptions = treatments.filter(\n      (treatment) => treatment.brandId === draft.brandId\n    );\n    const currentTreatmentMissing =\n      item.treatmentId &&\n      item.brandId === draft.brandId &&\n      !activeOptions.some((treatment) => treatment.id === item.treatmentId);\n    return currentTreatmentMissing\n      ? [\n          {\n            id: item.treatmentId as string,\n            brandId: item.brandId,\n            name: `${item.treatmentLabel || "現有療程"}（目前已停用）`,\n          },\n          ...activeOptions,\n        ]\n      : activeOptions;\n  }, [\n    draft.brandId,\n    item.brandId,\n    item.treatmentId,\n    item.treatmentLabel,\n    treatments,\n  ]);''',
)

replace_once(
    "src/components/command-center/CalendarItemEditDialog.tsx",
    '''      treatmentId: treatments.some(\n        (treatment) =>\n          treatment.id === current.treatmentId && treatment.brandId === brandId\n      )\n        ? current.treatmentId\n        : "",''',
    '''      treatmentId:\n        treatments.some(\n          (treatment) =>\n            treatment.id === current.treatmentId && treatment.brandId === brandId\n        ) ||\n        (brandId === item.brandId && current.treatmentId === item.treatmentId)\n          ? current.treatmentId\n          : "",''',
)

replace_once(
    "src/components/command-center/CalendarItemEditDialog.tsx",
    '''    const treatment = treatments.find(\n      (option) =>\n        option.id === draft.treatmentId && option.brandId === draft.brandId\n    );\n    const input: CalendarItemUpdateInput = {''',
    '''    const treatment = eligibleTreatments.find(\n      (option) =>\n        option.id === draft.treatmentId && option.brandId === draft.brandId\n    );\n    const currentInactiveTreatmentSelected =\n      treatment?.id === item.treatmentId &&\n      Boolean(item.treatmentLabel) &&\n      !treatments.some((option) => option.id === item.treatmentId);\n    const selectedTreatmentLabel = currentInactiveTreatmentSelected\n      ? item.treatmentLabel\n      : treatment?.name || null;\n    const input: CalendarItemUpdateInput = {''',
)

replace_once(
    "src/components/command-center/CalendarItemEditDialog.tsx",
    '''          treatmentLabel: treatment?.name || null,''',
    '''          treatmentLabel: selectedTreatmentLabel,''',
)

# Shared interaction uses semantic tokens rather than raw one-off palette values.
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''          color: #8c7280;''',
    '''          color: var(--system-muted-foreground);''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''          border-color: #dbc8d2;\n          background: #fff3f7;\n          color: #5a2348;''',
    '''          border-color: var(--system-border);\n          background: var(--system-accent);\n          color: var(--system-primary);''',
)

# Make the E2E fixture represent the edge case from review: a linked inactive treatment.
replace_once(
    "src/lib/marketing/marketingCalendar.ts",
    '''      treatmentId: null,\n      treatmentLabel: null,\n      title: "DEP Reels 上線",''',
    '''      treatmentId: "90000000-0000-4000-8000-000000000099",\n      treatmentLabel: "歷史療程",\n      title: "DEP Reels 上線",''',
)

# Add real regression acceptance for preserving that inactive link.
test_path = Path("e2e/marketing-calendar-edit.spec.ts")
test_text = test_path.read_text(encoding="utf-8")
marker = '''test("calendar edit dialog desktop visual baseline", async ({ page }) => {'''
new_test = '''test("unrelated edits preserve an inactive treatment link", async ({ page }) => {\n  const { dialog } = await openCalendarEdit(page);\n  const treatment = dialog.getByLabel("影響療程（可選）");\n  await expect(treatment).toHaveValue(\n    "90000000-0000-4000-8000-000000000099"\n  );\n  await expect(\n    treatment.locator('option[value="90000000-0000-4000-8000-000000000099"]')\n  ).toContainText("歷史療程（目前已停用）");\n\n  await dialog.getByLabel("事項名稱").fill("只改名稱並保留療程");\n  await dialog.getByTestId("calendar-edit-save").click();\n  await expect(dialog).toHaveCount(0);\n\n  const updatedTask = page\n    .locator('[data-calendar-task-title="只改名稱並保留療程"]')\n    .first();\n  await updatedTask\n    .getByRole("button", { name: "編輯事項：只改名稱並保留療程" })\n    .click();\n  const reopened = page.getByTestId("calendar-edit-dialog");\n  await expect(reopened.getByLabel("影響療程（可選）")).toHaveValue(\n    "90000000-0000-4000-8000-000000000099"\n  );\n});\n\n'''
if new_test not in test_text:
    if marker not in test_text:
        raise SystemExit("Calendar edit test insertion marker missing")
    test_path.write_text(test_text.replace(marker, new_test + marker, 1), encoding="utf-8")

# Lock the regression and semantic-token requirements into the build contract.
replace_once(
    "scripts/verify-calendar-edit-contract.mjs",
    '''assert.match(dialog, /saveAction/);''',
    '''assert.match(dialog, /saveAction/);\nassert.match(dialog, /currentTreatmentMissing/);\nassert.match(dialog, /currentInactiveTreatmentSelected/);''',
)
replace_once(
    "scripts/verify-calendar-edit-contract.mjs",
    '''assert.match(board, /calendar-task-edit/);''',
    '''assert.match(board, /calendar-task-edit/);\nassert.match(board, /var\\(--system-muted-foreground\\)/);\nassert.match(board, /var\\(--system-accent\\)/);''',
)
replace_once(
    "scripts/verify-calendar-edit-contract.mjs",
    '''assert.match(test, /calendar item can be fully edited/);''',
    '''assert.match(test, /calendar item can be fully edited/);\nassert.match(test, /unrelated edits preserve an inactive treatment link/);''',
)

# Add concrete implementation evidence to the reusable learning record.
learning_path = Path(
    "docs/product-learning/entries/2026-09-02-editable-marketing-calendar-items.md"
)
learning = learning_path.read_text(encoding="utf-8")
old_evidence = '''## Verification\n\n- production build and TypeScript;'''
new_evidence = '''## Source evidence\n\n- Source PR: `kieran97125/alyssa-lead-capture-os#81`\n- Initial verified implementation: `bf6ce79dd8db2cd347f531cf4874b3ad05462004`\n- Authorization and performance hardening are included in the same PR before release.\n\n## Verification\n\n- production build and TypeScript;'''
if old_evidence not in learning:
    raise SystemExit("Product learning evidence marker missing")
learning_path.write_text(learning.replace(old_evidence, new_evidence, 1), encoding="utf-8")

print("Calendar edit review findings fixed.")
