from pathlib import Path


def replace_exact(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    actual = text.count(old)
    if actual < count:
        raise SystemExit(
            f"{path}: expected at least {count} occurrence(s), found {actual}: {old[:160]!r}"
        )
    file.write_text(text.replace(old, new, count), encoding="utf-8")


def append_once(path: str, marker: str, block: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if marker in text:
        return
    file.write_text(text.rstrip() + "\n\n" + block.strip() + "\n", encoding="utf-8")


# Preserve the human creator name alongside the existing requester identity.
replace_exact(
    "src/lib/creative/types.ts",
    "  requesterMemberId: string | null;\n  requesterEmail: string | null;",
    "  requesterMemberId: string | null;\n  requesterName: string | null;\n  requesterEmail: string | null;",
)

replace_exact(
    "src/lib/creative/store.ts",
    "  const assigneeMember = assigneeMemberId\n    ? lookups.members.get(assigneeMemberId)\n    : null;\n  return {",
    "  const assigneeMember = assigneeMemberId\n    ? lookups.members.get(assigneeMemberId)\n    : null;\n  const requesterMemberId = asNullableString(row.requester_member_id);\n  const requesterMember = requesterMemberId\n    ? lookups.members.get(requesterMemberId)\n    : null;\n  return {",
)
replace_exact(
    "src/lib/creative/store.ts",
    "    requesterMemberId: asNullableString(row.requester_member_id),\n    requesterEmail: asNullableString(row.requester_email),",
    "    requesterMemberId,\n    requesterName: requesterMember\n      ? asNullableString(requesterMember.full_name)\n      : null,\n    requesterEmail:\n      asNullableString(row.requester_email) ||\n      (requesterMember ? asNullableString(requesterMember.email) : null),",
)

# Compact list controls and show creator provenance in the production Job List.
replace_exact(
    "src/app/creative-jobs/page.tsx",
    "function viewHref(current: Record<string, string>, view: string) {",
    "function requesterDisplayName(name: string | null, email: string | null) {\n  if (name?.trim()) return name.trim();\n  const localPart = email?.split(\"@\")[0]?.trim();\n  if (!localPart) return \"系統匯入\";\n  return localPart\n    .split(/[._-]+/)\n    .filter(Boolean)\n    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))\n    .join(\" \”);\n}\n\nfunction viewHref(current: Record<string, string>, view: string) {",
)
# Correct the accidental smart quote in the generated helper before TypeScript sees it.
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '.join(" \”);',
    '.join(" ");',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '<div className="flex flex-wrap items-center justify-end gap-2">',
    '<div className="flex flex-wrap items-center justify-end gap-1.5">',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className="command-secondary-button"\n                >\n                  <Settings2 size={15} /> 分類及 Designer',
    'className="command-secondary-button !min-h-8 !rounded-lg !px-2.5 !py-1.5 !text-[10px]"\n                >\n                  <Settings2 size={13} /> 分類及 Designer',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className="command-secondary-button list-none [&::-webkit-details-marker]:hidden">\n                  <BellRing size={15} /> 通知設定',
    'className="command-secondary-button !min-h-8 !rounded-lg !px-2.5 !py-1.5 !text-[10px] list-none [&::-webkit-details-marker]:hidden">\n                  <BellRing size={13} /> 通知設定',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className="grid gap-3 md:grid-cols-3 xl:grid-cols-6"',
    'className="grid gap-2 md:grid-cols-3 xl:grid-cols-6"',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className={`rounded-2xl border p-4 transition ${',
    'className={`rounded-xl border px-3 py-2.5 transition ${',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '"border-[#7c365f] bg-[#5a2348] text-white shadow-[0_12px_30px_rgba(90,35,72,0.16)]"',
    '"border-[#7c365f] bg-[#5a2348] text-white shadow-[0_8px_20px_rgba(90,35,72,0.14)]"',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '<Icon size={17} />',
    '<Icon size={15} />',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '<strong className="text-xl">{view.count}</strong>',
    '<strong className="text-lg leading-none">{view.count}</strong>',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className={`mt-3 block text-[11px] font-black ${',
    'className={`mt-2 block text-[10px] font-black ${',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className="flex flex-col gap-4 border-b border-[#ead9cf] p-4 xl:flex-row xl:items-end xl:justify-between"',
    'className="flex flex-col gap-3 border-b border-[#ead9cf] p-3 xl:flex-row xl:items-end xl:justify-between"',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '<h2 className="mt-1 text-lg font-black">',
    '<h2 className="mt-1 text-base font-black">',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '<p className="mt-1 text-[11px] font-semibold text-[#806174]">\n                      先按 Start Day；同日再按緊急／優先，最後按 Due Day。',
    '<p className="mt-1 text-[10px] font-semibold text-[#806174]">\n                      先按 Start Day；同日再按緊急／優先，最後按 Due Day。',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className="flex w-full flex-wrap items-end gap-2 xl:w-auto xl:justify-end"',
    'className="flex w-full flex-wrap items-end gap-1.5 xl:w-auto xl:justify-end"',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#5a2348] px-3 text-[10px] font-black text-white"',
    'className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#5a2348] px-2.5 text-[9px] font-black text-white"',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '<Filter size={13} /> 套用',
    '<Filter size={12} /> 套用',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className="hidden grid-cols-[minmax(240px,1.45fr)_minmax(150px,0.85fr)_minmax(260px,1.35fr)_minmax(240px,1.2fr)_minmax(110px,0.55fr)] gap-4 border-b border-[#eee3dd] bg-[#fbf9f7] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.06em] text-[#806174] xl:grid"',
    'className="hidden grid-cols-[minmax(220px,1.35fr)_minmax(150px,0.82fr)_minmax(220px,1.1fr)_minmax(205px,1fr)_minmax(86px,0.4fr)] gap-3 border-b border-[#eee3dd] bg-[#fbf9f7] px-3 py-2 text-[8px] font-black uppercase tracking-[0.06em] text-[#806174] xl:grid"',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    "                      const overdue =\n                        Boolean(job.dueDate) &&\n                        job.dueDate! < snapshot.today &&\n                        ![\"completed\", \"cancelled\"].includes(job.status);\n                      return (",
    "                      const overdue =\n                        Boolean(job.dueDate) &&\n                        job.dueDate! < snapshot.today &&\n                        ![\"completed\", \"cancelled\"].includes(job.status);\n                      const requester = requesterDisplayName(\n                        job.requesterName,\n                        job.requesterEmail\n                      );\n                      return (",
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className="grid min-w-0 grid-cols-1 gap-4 px-4 py-4 pr-14 text-[11px] font-semibold transition hover:bg-[#fff9fb] md:grid-cols-2 xl:grid-cols-[minmax(240px,1.45fr)_minmax(150px,0.85fr)_minmax(260px,1.35fr)_minmax(240px,1.2fr)_minmax(110px,0.55fr)] xl:items-center"',
    'data-testid="creative-job-row"\n                            className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-2 px-3 py-2.5 pr-11 text-[10px] font-semibold transition hover:bg-[#fff9fb] md:grid-cols-2 xl:grid-cols-[minmax(220px,1.35fr)_minmax(150px,0.82fr)_minmax(220px,1.1fr)_minmax(205px,1fr)_minmax(86px,0.4fr)] xl:items-center"',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '''                          <div className="min-w-0">\n                            <div className="flex min-w-0 items-center gap-2">\n                              <strong className="min-w-0 flex-1 truncate text-sm text-[#321428]">\n                                {job.title}\n                              </strong>\n                              <PriorityBadge value={job.priority} />\n                            </div>\n                            <small className="mt-1.5 block text-[9px] font-bold text-[#927987]">\n                              {job.quantity} 件 · {job.workload} workload\n                              {job.materialStatus === "waiting"\n                                ? " · 等素材"\n                                : ""}\n                            </small>\n                          </div>''',
    '''                          <div className="min-w-0">\n                            <div className="flex min-w-0 items-center gap-1.5">\n                              <strong className="min-w-0 flex-1 truncate text-[12px] leading-4 text-[#321428]">\n                                {job.title}\n                              </strong>\n                              <PriorityBadge value={job.priority} />\n                            </div>\n                            <small className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] font-bold leading-3 text-[#927987]">\n                              <span>{job.quantity} 件 · {job.workload}</span>\n                              <span\n                                className="inline-flex min-w-0 items-center gap-1 truncate"\n                                title={job.requesterEmail || requester}\n                              >\n                                <UserRound className="shrink-0" size={9} />\n                                建立者：<span className="truncate">{requester}</span>\n                              </span>\n                              {job.materialStatus === "waiting" ? (\n                                <span>等素材</span>\n                              ) : null}\n                            </small>\n                          </div>''',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className="grid min-w-0 gap-2"',
    'className="grid min-w-0 gap-1"',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className="grid min-w-0 gap-1.5"',
    'className="grid min-w-0 gap-1"',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className="grid min-w-0 grid-cols-3 gap-2"',
    'className="grid min-w-0 grid-cols-3 gap-1.5"',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className="absolute right-3 top-3 xl:top-1/2 xl:-translate-y-1/2"',
    'className="absolute right-2 top-2 xl:top-1/2 xl:-translate-y-1/2"',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '<label className="grid min-w-[118px] flex-1 gap-1 sm:flex-none">',
    '<label className="grid min-w-[104px] flex-1 gap-0.5 sm:flex-none">',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '<span className="text-[9px] font-black text-[#806174]">{label}</span>',
    '<span className="text-[8px] font-black text-[#806174]">{label}</span>',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className="h-9 min-w-0 rounded-xl border border-[#dfcdc4] bg-white px-2.5 text-[10px] font-bold text-[#4d2d40]"',
    'className="h-8 min-w-0 rounded-lg border border-[#dfcdc4] bg-white px-2 text-[9px] font-bold text-[#4d2d40]"',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '<div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] items-center gap-2">',
    '<div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] items-center gap-1.5">',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '<span className="text-[8px] font-black uppercase tracking-[0.05em] text-[#9a818d]">',
    '<span className="text-[7px] font-black uppercase tracking-[0.05em] text-[#9a818d]">',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className={`flex min-w-0 items-center gap-1 truncate ${',
    'className={`flex min-w-0 items-center gap-1 truncate text-[10px] leading-3 ${',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '<span className="min-w-0 rounded-xl bg-[#f8f4f2] px-2 py-2">',
    '<span className="min-w-0 rounded-lg bg-[#f8f4f2] px-2 py-1.5">',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    '<small className="block text-[8px] font-black uppercase tracking-[0.05em] text-[#9a818d]">',
    '<small className="block text-[7px] font-black uppercase tracking-[0.05em] text-[#9a818d]">',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className={`mt-1 flex min-w-0 items-center gap-1 truncate text-[9px] ${',
    'className={`mt-0.5 flex min-w-0 items-center gap-1 truncate text-[8px] leading-3 ${',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className={`inline-flex shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${styles[value]}`}',
    'className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black ${styles[value]}`}',
)
replace_exact(
    "src/app/creative-jobs/page.tsx",
    'className={`inline-flex rounded-full px-2.5 py-1.5 text-[9px] font-black ${',
    'className={`inline-flex rounded-full px-2 py-1 text-[8px] font-black ${',
)

# Make the main page actions and row deletion control proportionate to the new density.
replace_exact(
    "src/components/creative/CreativeJobCreateDialog.tsx",
    '<Dialog.Trigger className="command-primary-button">\n        <Plus size={16} /> 新增設計 Job',
    '<Dialog.Trigger\n        data-testid="creative-job-create-trigger"\n        className="command-primary-button !min-h-8 !rounded-lg !px-3 !py-1.5 !text-[10px]"\n      >\n        <Plus size={14} /> 新增設計 Job',
)
replace_exact(
    "src/components/creative/CreativeJobDeleteControl.tsx",
    'triggerIcon={<Trash2 size={listPlacement ? 14 : 15} aria-hidden="true" />}\n      triggerVariant="destructive"\n      triggerSize={listPlacement ? "icon-lg" : "lg"}\n      triggerClassName={listPlacement ? "shadow-[var(--shadow-control)]" : undefined}',
    'triggerIcon={<Trash2 size={listPlacement ? 12 : 15} aria-hidden="true" />}\n      triggerVariant="destructive"\n      triggerSize={listPlacement ? "icon-sm" : "lg"}\n      triggerClassName={listPlacement ? "shadow-sm" : undefined}',
)

# Surface creator provenance in the Job detail header as well.
replace_exact(
    "src/components/creative/CreativeJobStudio.tsx",
    '''          <div className="flex items-center gap-2 text-[10px] font-bold text-[#806174]">\n            <Clock3 size={13} /> 最後更新 {prettyDateTime(props.job.updatedAt)}\n          </div>''',
    '''          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[10px] font-bold text-[#806174]">\n            <span\n              className="inline-flex items-center gap-1"\n              title={props.job.requesterEmail || undefined}\n            >\n              <UserRound size={13} /> 建立者 {props.job.requesterName || props.job.requesterEmail || "系統匯入"}\n            </span>\n            <span className="inline-flex items-center gap-1">\n              <Clock3 size={13} /> 最後更新 {prettyDateTime(props.job.updatedAt)}\n            </span>\n          </div>''',
)

# Keep the deterministic fixture visually aligned with production.
replace_exact(
    "src/components/creative/CreativeProductionFixture.tsx",
    'className="hidden grid-cols-[minmax(240px,1.45fr)_minmax(150px,0.85fr)_minmax(260px,1.35fr)_minmax(240px,1.2fr)_minmax(110px,0.55fr)] gap-4 border-b border-[#eadfd9] bg-[#fbf9f7] px-4 py-3 text-[10px] font-black xl:grid"',
    'className="hidden grid-cols-[minmax(220px,1.35fr)_minmax(150px,0.82fr)_minmax(220px,1.1fr)_minmax(205px,1fr)_minmax(86px,0.4fr)] gap-3 border-b border-[#eadfd9] bg-[#fbf9f7] px-3 py-2 text-[8px] font-black xl:grid"',
)
replace_exact(
    "src/components/creative/CreativeProductionFixture.tsx",
    '<div className="grid min-w-0 grid-cols-1 gap-4 px-4 py-4 pr-14 text-[11px] font-semibold md:grid-cols-2 xl:grid-cols-[minmax(240px,1.45fr)_minmax(150px,0.85fr)_minmax(260px,1.35fr)_minmax(240px,1.2fr)_minmax(110px,0.55fr)] xl:items-center">',
    '<div data-testid="creative-job-row" className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-2 px-3 py-2.5 pr-11 text-[10px] font-semibold md:grid-cols-2 xl:grid-cols-[minmax(220px,1.35fr)_minmax(150px,0.82fr)_minmax(220px,1.1fr)_minmax(205px,1fr)_minmax(86px,0.4fr)] xl:items-center">',
)
replace_exact(
    "src/components/creative/CreativeProductionFixture.tsx",
    '''            <div className="min-w-0">\n              <strong className="block truncate text-sm">\n                GOS KOL 脫毛廣告片\n              </strong>\n              <span className="mt-1 block text-[9px] text-[#927987]">\n                3 件 · M workload · 優先\n              </span>\n            </div>''',
    '''            <div className="min-w-0">\n              <strong className="block truncate text-[12px] leading-4">\n                GOS KOL 脫毛廣告片\n              </strong>\n              <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[8px] leading-3 text-[#927987]">\n                <span>3 件 · M · 優先</span>\n                <span>建立者：Kieran Kwok</span>\n              </span>\n            </div>''',
)
replace_exact(
    "src/components/creative/CreativeProductionFixture.tsx",
    '<div className="grid gap-1.5">',
    '<div className="grid gap-1">',
    count=1,
)
replace_exact(
    "src/components/creative/CreativeProductionFixture.tsx",
    '<div className="grid min-w-0 gap-1.5">',
    '<div className="grid min-w-0 gap-1">',
)
replace_exact(
    "src/components/creative/CreativeProductionFixture.tsx",
    '<div className="grid grid-cols-3 gap-2">',
    '<div className="grid grid-cols-3 gap-1.5">',
)
replace_exact(
    "src/components/creative/CreativeProductionFixture.tsx",
    'className="rounded-xl bg-[#f8f4f2] p-2"',
    'className="rounded-lg bg-[#f8f4f2] px-2 py-1.5 text-[8px] leading-3"',
    count=3,
)
replace_exact(
    "src/components/creative/CreativeProductionFixture.tsx",
    'className="w-fit rounded-full bg-[#f5f1ef] px-2 py-1 text-[9px] font-black"',
    'className="w-fit rounded-full bg-[#f5f1ef] px-2 py-1 text-[8px] font-black"',
)
replace_exact(
    "src/components/creative/CreativeProductionFixture.tsx",
    'className="absolute right-3 top-3 xl:top-1/2 xl:-translate-y-1/2"',
    'className="absolute right-2 top-2 xl:top-1/2 xl:-translate-y-1/2"',
)

# Add direct acceptance for creator provenance and compact control/row sizing.
replace_exact(
    "e2e/creative-production.spec.ts",
    '  await expect(list).toContainText("Video");\n  const fitsWithoutHorizontalScroll',
    '  await expect(list).toContainText("Video");\n  await expect(list).toContainText("建立者：Kieran Kwok");\n  const fitsWithoutHorizontalScroll',
)
replace_exact(
    "e2e/creative-production.spec.ts",
    '''test("new Creative Job opens in a focused dialog and keeps date guidance contextual", async ({\n  page,\n}) => {''',
    '''test("Creative Job list keeps compact desktop density and proportionate controls", async ({\n  page,\n}) => {\n  await page.setViewportSize({ width: 1440, height: 900 });\n  await openFixture(page);\n\n  const list = page.getByTestId("creative-job-list-fixture");\n  const row = list.getByTestId("creative-job-row");\n  await expect(row).toContainText("建立者：Kieran Kwok");\n\n  const rowBox = await row.boundingBox();\n  expect(rowBox?.height ?? 999).toBeLessThanOrEqual(86);\n\n  const createBox = await page.getByTestId("creative-job-create-trigger").boundingBox();\n  expect(createBox?.height ?? 999).toBeLessThanOrEqual(34);\n\n  const deleteBox = await list\n    .getByTestId("creative-job-list-delete-button")\n    .boundingBox();\n  expect(deleteBox?.height ?? 999).toBeLessThanOrEqual(30);\n  expect(deleteBox?.width ?? 999).toBeLessThanOrEqual(30);\n\n  await page.evaluate(async () => {\n    await document.fonts.ready;\n  });\n  await expect(list).toHaveScreenshot("creative-job-list-compact-desktop.png", {\n    animations: "disabled",\n    caret: "hide",\n  });\n});\n\ntest("new Creative Job opens in a focused dialog and keeps date guidance contextual", async ({\n  page,\n}) => {''',
)

# Turn the UI choice into a contract so future changes cannot silently remove provenance or density.
replace_exact(
    "scripts/verify-creative-production-contract.mjs",
    'const store = read("src/lib/creative/store.ts");',
    'const store = read("src/lib/creative/store.ts");\nconst creativeTypes = read("src/lib/creative/types.ts");',
)
replace_exact(
    "scripts/verify-creative-production-contract.mjs",
    'assert.match(store, /assignee_member_id/);',
    'assert.match(store, /assignee_member_id/);\nassert.match(store, /requesterName/);\nassert.match(creativeTypes, /requesterName: string \\| null/);',
)
replace_exact(
    "scripts/verify-creative-production-contract.mjs",
    'assert.match(listPage, /Designer/);',
    'assert.match(listPage, /Designer/);\nassert.match(listPage, /建立者：/);\nassert.match(listPage, /creative-job-row/);',
)
replace_exact(
    "scripts/verify-creative-production-contract.mjs",
    'assert.match(deleteControl, /creative-job-delete-button/);',
    'assert.match(deleteControl, /creative-job-delete-button/);\nassert.match(deleteControl, /icon-sm/);\nassert.match(studio, /建立者/);',
)

append_once(
    "docs/design-system/CHANGELOG.md",
    "## 2026-09-03 — Compact Creative Job list and creator provenance",
    """
## 2026-09-03 — Compact Creative Job list and creator provenance

- Reduced Creative Job summary-card, toolbar, filter, row, date-tile, status and destructive-control density for faster operational scanning.
- Added the human Job creator to every list row and the Job detail header using the persisted requester member identity, with email/system fallbacks.
- Kept the existing no-horizontal-scroll responsive layout and full-size form controls inside the detailed Brief workspace.
- Added deterministic list visual acceptance plus explicit maximum row/action dimensions.
- Rollback: revert the source PR; no database migration or stored-data rewrite is required.
""",
)

learning = Path(
    "docs/product-learning/entries/2026-09-03-creative-job-density-requester-provenance.md"
)
if not learning.exists():
    learning.write_text(
        """# Creative Job density and requester provenance

## Problem

The operational Job List used generous card and control sizing after the first Creative Production release. With real imported work, rows became visually heavy and managers could not immediately see who created each Job. The requester identity already existed in the database but was not projected as a human name.

## Decision

Creative Job rows use a compact desktop information hierarchy: title and priority first, creator provenance in the supporting line, then brand/designer, production taxonomy, schedule and status. Requester member ID is resolved through the workspace member directory and exposed as `requesterName`; email and system-import labels remain fallbacks. The same provenance appears in the Job detail header.

Toolbar filters, quick views, action buttons, schedule tiles, badges and row delete controls use a smaller but still keyboard-focusable density. The long-form Job editor and creation form keep larger input targets because they are data-entry surfaces rather than scanning surfaces.

## Guardrails

- Creator means the persisted requester/creator of the Job, not the current Designer.
- Existing requester ID and email remain the audit source of truth; display name is a projection.
- Missing requester identity displays a transparent system-import fallback rather than guessing a colleague.
- Compact desktop rows must not reintroduce horizontal scrolling.
- Mobile remains stacked and readable.
- No database migration or historical rewrite is required.

## Classification

- **Core**: creator provenance, separation of creator and assignee, compact operational-list density.
- **Configurable**: exact density tokens, labels and responsive breakpoints.
- **Needs evidence**: future requester filtering or workload reporting should be added only when operations require it.

## Verification

- Production build and Creative Production contract.
- Deterministic compact-list visual baseline.
- Maximum row, create-action and delete-action dimensions.
- Existing create, delete, rich Brief, navigation and mobile acceptance.
- Design/accessibility and full product regression.

## Rollback

Revert the source PR. Stored Jobs, requester identity, Brief versions, assets and audit records remain unchanged.
""",
        encoding="utf-8",
    )

print("Applied compact Creative Job list and requester provenance implementation.")
