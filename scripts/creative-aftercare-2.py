from pathlib import Path

path = Path("src/lib/creative/store.ts")
text = path.read_text(encoding="utf-8")
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
if old not in text:
    if new in text:
        print("Creative Studio access-record typing already patched.")
    else:
        raise SystemExit("Creative Studio access-record typing marker missing")
else:
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("Creative Studio access-record typing patched.")
