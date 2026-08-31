from pathlib import Path


def replace_all(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text and new not in text:
        raise SystemExit(f"{path}: marker missing: {old!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


path = "src/lib/creative/store.ts"
replace_all(
    path,
    "mapJob(row as RawRow,",
    "mapJob(row as unknown as RawRow,",
)

file = Path(path)
text = file.read_text(encoding="utf-8")
old = '''  if (error || !data) return { access, job: null };
  const subject = {
    brandId: String(data.brand_id),
    assigneeMemberId:
      typeof data.assignee_member_id === "string"
        ? data.assignee_member_id
        : null,
  };
  return {
    access,
    job: canViewCreativeJob(access, subject) ? (data as RawRow) : null,
  };
'''
new = '''  const rawData = data as unknown as RawRow | null;
  if (error || !rawData) return { access, job: null };
  const subject = {
    brandId: String(rawData.brand_id),
    assigneeMemberId:
      typeof rawData.assignee_member_id === "string"
        ? rawData.assignee_member_id
        : null,
  };
  return {
    access,
    job: canViewCreativeJob(access, subject) ? rawData : null,
  };
'''
if old in text:
    file.write_text(text.replace(old, new, 1), encoding="utf-8")
elif new not in text:
    raise SystemExit("Creative Studio access-record typing marker missing")


def patch_navigation_test(path: str, anchor: str) -> None:
    file = Path(path)
    source = file.read_text(encoding="utf-8")
    source = source.replace("toHaveCount(14);", "toHaveCount(15);", 1)
    assertion = '''  await expect(
    page
      .getByRole("navigation", { name: "主要功能" })
      .getByRole("link", { name: "設計工作" })
  ).toBeVisible();
'''
    if 'getByRole("link", { name: "設計工作" })' not in source:
        if anchor not in source:
            raise SystemExit(f"{path}: navigation assertion anchor missing")
        source = source.replace(anchor, assertion + anchor, 1)
    if "toHaveCount(15);" not in source:
        raise SystemExit(f"{path}: navigation count was not updated")
    file.write_text(source, encoding="utf-8")


patch_navigation_test(
    "e2e/marketing-command-center.spec.ts",
    '''  await expect(
    navigation.getByRole("link", { name: "Dashboard" })
  ).toBeVisible();
''',
)
patch_navigation_test(
    "e2e/settings-management.spec.ts",
    '''  await expect(
    page
      .getByRole("navigation", { name: "主要功能" })
      .getByRole("link", { name: "每日總覽" })
  ).toBeVisible();
''',
)


# Job List is owned by Start Day first. Priority only reorders jobs that start
# on the same day, then Due Day breaks the remaining tie.
store_path = Path("src/lib/creative/store.ts")
store = store_path.read_text(encoding="utf-8")
old_sort = '''function sortJobs(rows: CreativeJobRow[]) {
  const priorityWeight = { urgent: 0, priority: 1, normal: 2 } as const;
  return [...rows].sort((left, right) => {
    const priority =
      priorityWeight[left.priority] - priorityWeight[right.priority];
    if (priority !== 0) return priority;
    const start = left.startDate.localeCompare(right.startDate);
    if (start !== 0) return start;
    return (left.dueDate || "9999-12-31").localeCompare(
      right.dueDate || "9999-12-31"
    );
  });
}
'''
new_sort = '''function sortJobs(rows: CreativeJobRow[]) {
  const priorityWeight = { urgent: 0, priority: 1, normal: 2 } as const;
  return [...rows].sort((left, right) => {
    const start = left.startDate.localeCompare(right.startDate);
    if (start !== 0) return start;
    const priority =
      priorityWeight[left.priority] - priorityWeight[right.priority];
    if (priority !== 0) return priority;
    return (left.dueDate || "9999-12-31").localeCompare(
      right.dueDate || "9999-12-31"
    );
  });
}
'''
if old_sort in store:
    store = store.replace(old_sort, new_sort, 1)
elif new_sort not in store:
    raise SystemExit("Creative Job sort contract marker missing")

open_filter = '''  if (!filters.status && !filters.view) {
    query = query.not("status", "in", "(completed,cancelled)");
  }

'''
filter_marker = '''  const today = getHongKongToday();
  if (filters.view === "waiting") {
'''
if open_filter not in store:
    if filter_marker not in store:
        raise SystemExit("Creative Job default view marker missing")
    store = store.replace(
        filter_marker,
        '''  const today = getHongKongToday();
  if (!filters.status && !filters.view) {
    query = query.not("status", "in", "(completed,cancelled)");
  }
  if (filters.view === "waiting") {
''',
        1,
    )
store_path.write_text(store, encoding="utf-8")


# A Job can stay as a draft while incomplete. Once a Designer is selected, the
# operating fields required to start real work must be complete.
actions_path = Path("src/app/creative-jobs/actions.ts")
actions = actions_path.read_text(encoding="utf-8")
assignment_guard = '''  if (assigneeProfileId) {
    if (title === "未命名設計工作") {
      redirectWithMessage(returnPath, false, "派 Job 前請先填寫清晰 Job 名稱。" );
    }
    if (!dueDate) {
      redirectWithMessage(returnPath, false, "派 Job 畀 Designer 前必須設定 Due Day。" );
    }
    if (!sourceTaxonomyId || !usageTaxonomyId || !mediaFormatTaxonomyId) {
      redirectWithMessage(
        returnPath,
        false,
        "派 Job 前必須分別選擇 Source、用途同媒體格式。"
      );
    }
  }

'''
assignment_marker = '''  let assigneeMemberId = "";
  let assigneeEmail = "";
'''
if assignment_guard not in actions:
    if assignment_marker not in actions:
        raise SystemExit("Creative assignment validation marker missing")
    actions = actions.replace(
        assignment_marker,
        assignment_guard + assignment_marker,
        1,
    )
actions_path.write_text(actions, encoding="utf-8")


migration_path = Path(
    "supabase/migrations/20260901020000_creative_production_studio.sql"
)
migration = migration_path.read_text(encoding="utf-8")
constraint_sql = '''alter table public.workspace_member_module_permissions
  drop constraint if exists workspace_member_module_permissions_key_check;
alter table public.workspace_member_module_permissions
  add constraint workspace_member_module_permissions_key_check
  check (module_key in (
    'dashboard', 'kpis', 'calendar', 'creative_jobs', 'launchhub', 'leads',
    'crm', 'performance', 'data_sources', 'settings', 'system_audit',
    'lead_audit'
  ));

'''
if constraint_sql not in migration:
    marker = "-- Existing members with explicit module lists need the new module written into\n"
    if marker not in migration:
        raise SystemExit("Creative migration permission marker missing")
    migration = migration.replace(marker, constraint_sql + marker, 1)

migration = migration.replace(
    "where member.workspace_role in ('owner', 'admin', 'manager', 'marketer', 'designer')\n",
    "where member.workspace_role in ('owner', 'admin', 'manager', 'marketer', 'designer')\n  and member.status <> 'removed'\n",
    1,
)

old_unsync = '''    if found and existing_calendar.published_at is null then
      delete from public.marketing_calendar_items where id = next_calendar_id;
      next_calendar_id := null;
    end if;
'''
new_unsync = '''    if found and existing_calendar.published_at is not null then
      raise exception using errcode = '55000', message = 'creative_calendar_already_published';
    elsif found then
      delete from public.marketing_calendar_items where id = next_calendar_id;
      next_calendar_id := null;
    end if;
'''
if old_unsync in migration:
    migration = migration.replace(old_unsync, new_unsync, 1)
elif new_unsync not in migration:
    raise SystemExit("Creative published-calendar detach guard marker missing")
migration_path.write_text(migration, encoding="utf-8")


# Keep the release contract explicit so later refactors cannot quietly reverse
# Start Day ownership or reintroduce unsafe calendar detachment.
contract_path = Path("scripts/verify-creative-production-contract.mjs")
contract = contract_path.read_text(encoding="utf-8")
contract_assertions = '''const sortContract = store.match(/function sortJobs[\\s\\S]*?\\n}\\n/)?.[0] ?? "";
assert.ok(
  sortContract.indexOf("const start =") < sortContract.indexOf("const priority ="),
  "Creative Job List must sort by Start Day before priority"
);
assert.match(store, /if \\(!filters\\.status && !filters\\.view\\)/);
assert.match(actions, /派 Job 畀 Designer 前必須設定 Due Day/);
assert.match(actions, /Source、用途同媒體格式/);
assert.match(migration, /workspace_member_module_permissions_key_check/);
assert.match(migration, /creative_calendar_already_published/);
'''
if "Creative Job List must sort by Start Day before priority" not in contract:
    marker = 'assert.match(store, /assignee_member_id/);\n'
    if marker not in contract:
        raise SystemExit("Creative contract store marker missing")
    contract = contract.replace(marker, marker + contract_assertions, 1)
contract_path.write_text(contract, encoding="utf-8")

print(
    "Creative Studio ordering, assignment completeness, navigation and database aftercare completed."
)
