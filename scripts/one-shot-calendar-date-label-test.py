from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / "e2e/marketing-command-center.spec.ts"
content = path.read_text(encoding="utf-8")
old = '  await expect(page.getByLabel("日期")).toHaveValue("2026-07-01");'
new = '''  await expect(
    page.getByRole("textbox", { name: "Due／出街日期", exact: true })
  ).toHaveValue("2026-07-01");
  await expect(page.getByLabel("同步工作 Start Day")).toHaveValue(
    "2026-07-01"
  );'''
if content.count(old) != 1:
    raise RuntimeError(f"Expected one legacy Calendar date assertion, found {content.count(old)}")
path.write_text(content.replace(old, new, 1), encoding="utf-8")
print("Calendar test now asserts Due Day and Start Day explicitly.")
