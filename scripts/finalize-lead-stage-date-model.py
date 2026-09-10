from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


# Make the existing implementation script safe to run from a clean checkout.
impl_path = "scripts/implement-lead-stage-date-model.py"
impl = read(impl_path)
impl = replace_once(
    impl,
    "parser, count = sort_pattern.subn(sort_helper, parser, count=1)",
    "parser, count = sort_pattern.subn(lambda match: match.group(1) + sort_helper[2:], parser, count=1)",
    "escape-safe parser replacement",
)
start_marker = "# User-facing definitions"
end_marker = "# Focused acceptance tests"
start = impl.rfind("# -----------------------------------------------------------------------------", 0, impl.index(start_marker))
end = impl.rfind("# -----------------------------------------------------------------------------", 0, impl.index(end_marker))
if start < 0 or end <= start:
    raise RuntimeError("implementation section boundaries not found")
impl = (
    impl[:start]
    + "# -----------------------------------------------------------------------------\n"
    + "# User-facing definitions are patched by the finalizer.\n"
    + "# -----------------------------------------------------------------------------\n\n"
    + impl[end:]
)
write(impl_path, impl)
subprocess.run([sys.executable, str(ROOT / impl_path)], check=True, cwd=ROOT)

# Align visible Dashboard wording with the current-stage contract.
panel_path = "src/components/command-center/LeadDashboardPanel.tsx"
panel = read(panel_path)
for old, new in [
    (
        "同一品牌及電話只計一次；Lead 按首次查詢日，Book 按首次預約更新日；舊 Lead 維持原有日期。",
        "同一品牌及電話只計一次；Lead 按 Created At；新 Lead 嘅 Book／Show／No Show 按最後更新日期＋目前跟進狀態。",
    ),
    (
        'meta={`${formatPercent(snapshot.totals.bookRate)} · 按預約更新日`}',
        'meta={`${formatPercent(snapshot.totals.bookRate)} · 已進入預約流程`}',
    ),
    (
        "Lead 按同品牌同電話尾 8 位嘅首次查詢日期；新 Lead 嘅 Book 按「最後更新日期」鎖定首次預約日，\n            舊 Lead 冇該日期時繼續按首次查詢日。Show 按確認到店日期；No Show 同本月未 Show 按預約日期。\n            Book 包括已預約、已到店及 No Show；同期間 Book Rate 係事件流量比率，唔係固定 cohort。",
        "Lead 按同品牌同電話尾 8 位嘅 Created At。新 Lead 以「最後更新日期＋目前跟進狀態」判斷：\n            已預約＝Book 未 Show、已完成／已到店＝Show、No Show＝當日 No Show、待跟進＝未 Book。\n            Book 仍包括已預約、Show 及 No Show；舊 Lead 保留原有日期口徑。同期間比率係營運事件流量比率，唔係固定 cohort。",
    ),
]:
    panel = replace_once(panel, old, new, "Dashboard wording")
write(panel_path, panel)

# Replace the obsolete test expectation: C is authoritative, V/W only fallback.
test_path = "e2e/marketing-command-center.spec.ts"
test_source = read(test_path)
pattern = re.compile(
    r'expect\(\s*normalizeLeadSheetStatus\(\{\s*'
    r'followStatus:\s*"待跟進",\s*'
    r'status:\s*"",\s*'
    r'showUp:\s*"No Show",\s*'
    r'\}\)\s*\)\.toBe\("no_show"\);',
    re.MULTILINE,
)
replacement = '''expect(
    normalizeLeadSheetStatus({
      followStatus: "待跟進",
      status: "",
      showUp: "No Show",
    })
  ).toBe("lead");
  expect(
    normalizeLeadSheetStatus({
      followStatus: "",
      status: "",
      showUp: "No Show",
    })
  ).toBe("no_show");'''
test_source, count = pattern.subn(replacement, test_source, count=1)
if count != 1:
    raise RuntimeError(f"legacy status assertion: expected one match, found {count}")
write(test_path, test_source)

print("Finalized current-stage Lead date model and acceptance tests.")
