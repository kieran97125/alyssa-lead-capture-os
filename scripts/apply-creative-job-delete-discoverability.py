from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing patch marker: {label}")
    return text.replace(old, new, 1)


# Make delete immediately discoverable from the Job List without turning the
# whole destructive action into an easy accidental click.
page_path = "src/app/creative-jobs/page.tsx"
page = read(page_path)
page = replace_once(
    page,
    "  Sparkles,\n  UserRound,\n",
    "  Sparkles,\n  Trash2,\n  UserRound,\n",
    "Trash icon import",
)
page = replace_once(
    page,
    'import { AppNav } from "@/components/alyssa/AppNav";\nimport { SubmitButton } from "@/components/alyssa/SubmitButton";\n',
    'import { AppNav } from "@/components/alyssa/AppNav";\nimport { ConfirmSubmitButton } from "@/components/alyssa/ConfirmSubmitButton";\nimport { SubmitButton } from "@/components/alyssa/SubmitButton";\n',
    "Confirm delete button import",
)
page = replace_once(
    page,
    'import { CreativeJobCreateDialog } from "@/components/creative/CreativeJobCreateDialog";\n',
    'import { CreativeJobCreateDialog } from "@/components/creative/CreativeJobCreateDialog";\nimport { deleteCreativeJobAction } from "@/app/creative-jobs/actions";\n',
    "delete action import",
)
page = replace_once(
    page,
    '''                      return (
                        <Link
                          key={job.id}
                          href={`/creative-jobs/${job.id}`}
''',
    '''                      return (
                        <div key={job.id} className="relative">
                          <Link
                            href={`/creative-jobs/${job.id}`}
''',
    "Job row wrapper",
)
page = replace_once(
    page,
    'className="grid min-w-0 grid-cols-1 gap-4 border-b border-[#f0e7e2] px-4 py-4 text-[11px] font-semibold transition last:border-b-0 hover:bg-[#fff9fb] md:grid-cols-2 xl:grid-cols-[minmax(240px,1.45fr)_minmax(150px,0.85fr)_minmax(260px,1.35fr)_minmax(240px,1.2fr)_minmax(110px,0.55fr)] xl:items-center"',
    'className="grid min-w-0 grid-cols-1 gap-4 border-b border-[#f0e7e2] px-4 py-4 pr-14 text-[11px] font-semibold transition last:border-b-0 hover:bg-[#fff9fb] md:grid-cols-2 xl:grid-cols-[minmax(240px,1.45fr)_minmax(150px,0.85fr)_minmax(260px,1.35fr)_minmax(240px,1.2fr)_minmax(110px,0.55fr)] xl:items-center"',
    "Job row delete space",
)
page = replace_once(
    page,
    '''                          <div className="flex items-center xl:justify-start">
                            <StatusBadge status={job.status} />
                          </div>
                        </Link>
                      );
''',
    '''                          <div className="flex items-center xl:justify-start">
                            <StatusBadge status={job.status} />
                          </div>
                          </Link>
                          {snapshot.canCreate ? (
                            <form
                              action={deleteCreativeJobAction}
                              className="absolute right-3 top-3 xl:top-1/2 xl:-translate-y-1/2"
                            >
                              <input type="hidden" name="jobId" value={job.id} />
                              <ConfirmSubmitButton
                                data-testid="creative-job-list-delete-button"
                                aria-label={`刪除 ${job.title}`}
                                title={`刪除 ${job.title}`}
                                className="h-9 w-9 rounded-xl border border-[#e5c5c8] bg-white p-0 text-[#a43b50] shadow-sm transition hover:border-[#d59aa2] hover:bg-[#fff4f4]"
                                pendingLabel="…"
                                confirmMessage={`確定刪除「${job.title}」？刪除後會即時由 Job List 消失；系統 Audit 仍會保留記錄。`}
                              >
                                <Trash2 size={14} />
                              </ConfirmSubmitButton>
                            </form>
                          ) : null}
                        </div>
                      );
''',
    "Job row delete action",
)
write(page_path, page)


# Put the destructive action in the sticky Job header, where operators expect
# it, rather than hiding it below a long settings panel under the word archive.
studio_path = "src/components/creative/CreativeJobStudio.tsx"
studio = read(studio_path)
studio = replace_once(
    studio,
    '''          {props.canManageSettings ? (
''',
    '''          {props.canEditMetadata ? (
            <form action={deleteCreativeJobAction}>
              <input type="hidden" name="jobId" value={props.job.id} />
              <ConfirmSubmitButton
                data-testid="creative-job-delete-button"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e5c5c8] bg-white px-3 text-xs font-black text-[#a43b50] transition hover:border-[#d59aa2] hover:bg-[#fff4f4]"
                pendingLabel="刪除中…"
                confirmMessage={`確定刪除「${props.job.title}」？刪除後會即時由 Job List 消失；系統 Audit 仍會保留記錄。`}
              >
                <Trash2 size={15} /> 刪除 Job
              </ConfirmSubmitButton>
            </form>
          ) : null}
          {props.canManageSettings ? (
''',
    "Sticky header delete action",
)
old_bottom_pattern = re.compile(
    r'''\n          \{props\.canEditMetadata \? \(\n            <form action=\{deleteCreativeJobAction\}>[\s\S]*?<Trash2 size=\{14\} /> 封存呢張 Job[\s\S]*?</form>\n          \) : null\}\n        </aside>'''
)
studio, count = old_bottom_pattern.subn("\n        </aside>", studio, count=1)
if count != 1:
    raise SystemExit("Missing patch marker: buried archive action")
write(studio_path, studio)


# Keep safe soft-delete semantics, but use the wording operators asked for.
actions_path = "src/app/creative-jobs/actions.ts"
actions = read(actions_path)
actions = replace_once(
    actions,
    'redirectWithMessage("/creative-jobs", true, "設計工作已移至系統封存。" );',
    'redirectWithMessage(\n    "/creative-jobs",\n    true,\n    "設計工作已從 Job List 刪除；系統 Audit 記錄仍然保留。"\n  );',
    "delete success wording",
)
write(actions_path, actions)


# Lock the UX contract so the action cannot silently disappear again.
contract_path = "scripts/verify-creative-production-contract.mjs"
contract = read(contract_path)
contract = replace_once(
    contract,
    '''assert.match(listPage, /Designer/);
''',
    '''assert.match(listPage, /Designer/);
assert.match(listPage, /deleteCreativeJobAction/);
assert.match(listPage, /creative-job-list-delete-button/);
assert.match(studio, /creative-job-delete-button/);
assert.match(studio, /刪除 Job/);
assert.match(actions, /設計工作已從 Job List 刪除/);
''',
    "delete UX contract",
)
write(contract_path, contract)

print("Creative Job delete controls are now visible and contract-protected.")
