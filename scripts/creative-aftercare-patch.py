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

print("Creative Studio TypeScript aftercare patches completed.")
