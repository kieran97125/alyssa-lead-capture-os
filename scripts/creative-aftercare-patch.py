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

print("Creative Studio TypeScript and navigation aftercare patches completed.")
