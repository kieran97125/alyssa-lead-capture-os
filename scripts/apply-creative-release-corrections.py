from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


studio_path = "src/components/creative/CreativeJobStudio.tsx"
studio = read(studio_path)
studio = replace_once(
    studio,
    'import { useMemo, useState } from "react";',
    'import { useEffect, useMemo, useState } from "react";',
    "CreativeJobStudio react import",
)

draft_effect_anchor = "  const fixtureMode = props.fixtureMode === true;\n"
if studio.count(draft_effect_anchor) != 1:
    raise RuntimeError(
        "CreativeJobStudio draft persistence effect: "
        f"expected one anchor, found {studio.count(draft_effect_anchor)}"
    )
studio = studio.replace(
    draft_effect_anchor,
    draft_effect_anchor
    + '''  const settingsDraftStorageKey = `creative-job-settings-draft:${props.job.id}`;

  useEffect(() => {
    try {
      if (feedback?.status === "error") {
        const savedDraft = window.sessionStorage.getItem(
          settingsDraftStorageKey
        );
        if (savedDraft) {
          const parsed = JSON.parse(
            savedDraft
          ) as Partial<CreativeJobSettingsDraft>;
          setDraft((current) => ({ ...current, ...parsed }));
        }
      } else {
        window.sessionStorage.removeItem(settingsDraftStorageKey);
      }
    } catch {
      // Session storage is an optional handoff for failed validation only.
    }

    if (feedback) {
      const url = new URL(window.location.href);
      url.searchParams.delete("creative_status");
      url.searchParams.delete("creative_message");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`
      );
    }
  }, [feedback, settingsDraftStorageKey]);

''',
    1,
)

old_submit = '''            onSubmit={
              fixtureMode
                ? (event) => {
                    event.preventDefault();
                    setFixtureFeedback({
                      status: "success",
                      message: "設計工作已儲存；畫面設定保持不變。",
                    });
                  }
                : undefined
            }
            data-testid="creative-job-settings-form"'''
new_submit = '''            onSubmit={(event) => {
              if (fixtureMode) {
                event.preventDefault();
                setFixtureFeedback({
                  status: "success",
                  message: "設計工作已儲存；畫面設定保持不變。",
                });
                return;
              }
              try {
                window.sessionStorage.setItem(
                  settingsDraftStorageKey,
                  JSON.stringify(draft)
                );
              } catch {
                // Server validation remains authoritative when storage is unavailable.
              }
            }}
            data-testid="creative-job-settings-form"'''
studio = replace_once(
    studio,
    old_submit,
    new_submit,
    "CreativeJobStudio form submit handoff",
)
write(studio_path, studio)


editor_path = "src/components/creative/CreativeBriefEditor.tsx"
editor = read(editor_path)
editor = replace_once(
    editor,
    '''            title="文字顏色"
            aria-label="文字顏色"
          >''',
    '''            title="文字顏色"
          >''',
    "CreativeBriefEditor colour label",
)
write(editor_path, editor)


fixture_path = "src/components/creative/CreativeProductionFixture.tsx"
fixture = read(fixture_path)
fixture = replace_once(
    fixture,
    '''"use client";

import {''',
    '''"use client";

import { useEffect, useState } from "react";
import {''',
    "Creative fixture hydration import",
)
fixture = replace_once(
    fixture,
    '''export function CreativeProductionFixture() {
  return (
    <main className="min-h-screen bg-[#fbf7f5] p-4 text-[#321428] sm:p-8">''',
    '''export function CreativeProductionFixture() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <main className="min-h-screen bg-[#fbf7f5] p-4 text-[#321428] sm:p-8">
      <span
        className="sr-only"
        data-testid="creative-fixture-ready"
        data-ready={hydrated ? "true" : "false"}
      >
        Creative fixture ready
      </span>''',
    "Creative fixture hydration marker",
)
write(fixture_path, fixture)


e2e_path = "e2e/creative-production.spec.ts"
e2e = read(e2e_path)
e2e = replace_once(
    e2e,
    '''  await expect(page.getByRole("heading", { name: "設計工作" })).toBeVisible();
}''',
    '''  await expect(page.getByRole("heading", { name: "設計工作" })).toBeVisible();
  await expect(page.getByTestId("creative-fixture-ready")).toHaveAttribute(
    "data-ready",
    "true"
  );
}''',
    "Creative e2e hydration wait",
)
e2e = replace_once(
    e2e,
    '''  const row = list.getByTestId("creative-job-row");
  await expect(row).toContainText("建立者：Kieran Kwok");

  const rowBox = await row.boundingBox();''',
    '''  const row = list.getByTestId("creative-job-row");
  await expect(row).toBeVisible();
  await expect(row).toContainText("建立者：Kieran Kwok");
  await row.scrollIntoViewIfNeeded();

  const rowBox = await row.boundingBox();''',
    "Creative e2e compact row visibility",
)
e2e = replace_once(
    e2e,
    '''  await openFixture(page);
  await page.getByRole("button", { name: "新增設計 Job" }).click();

  const dialog = page.getByTestId("creative-job-create-dialog");''',
    '''  await openFixture(page);
  const trigger = page.getByTestId("creative-job-create-trigger");
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByTestId("creative-job-create-dialog");''',
    "Creative e2e create dialog scope",
)
e2e = replace_once(
    e2e,
    '''  await openFixture(page);
  await expect(page.getByTestId("creative-job-delete-button")).toBeVisible();
  await expect(page.getByTestId("creative-job-list-delete-button")).toBeVisible();''',
    '''  await openFixture(page);
  const studio = page.getByTestId("creative-rich-brief-fixture");
  await expect(
    studio.getByTestId("creative-job-delete-button")
  ).toBeVisible();
  await expect(page.getByTestId("creative-job-list-delete-button")).toBeVisible();''',
    "Creative e2e delete scope",
)
e2e = replace_once(
    e2e,
    '''  const form = page.getByTestId("creative-job-settings-form");
  const title = form.getByLabel("Job 名稱");''',
    '''  const studio = page.getByTestId("creative-rich-brief-fixture");
  const form = studio.getByTestId("creative-job-settings-form");
  const title = form.getByLabel("Job 名稱");''',
    "Creative e2e settings form scope",
)
e2e = replace_once(
    e2e,
    '''  const workspace = page.getByTestId("creative-brief-workspace");
  await workspace.getByRole("button", { name: "粗體" }).click();''',
    '''  const workspace = studio.getByTestId("creative-brief-workspace");
  await workspace.getByRole("button", { name: "粗體" }).click();''',
    "Creative e2e settings workspace scope",
)
e2e = replace_once(
    e2e,
    '''  await expect(workspace.getByLabel("文字顏色")).toBeVisible();
  await expect(workspace.getByRole("button", { name: "還原文字顏色" })).toBeVisible();''',
    '''  await expect(
    workspace.getByTestId("brief-text-color-control")
  ).toBeVisible();
  await expect(
    workspace.getByRole("button", { name: "還原文字顏色", exact: true })
  ).toBeVisible();''',
    "Creative e2e colour control scope",
)
write(e2e_path, e2e)


contract_path = "scripts/verify-creative-production-contract.mjs"
contract = read(contract_path)
anchor = "assert.match(studio, /creative-job-settings-feedback/);"
if anchor not in contract:
    raise RuntimeError("Creative contract settings feedback anchor missing")
contract = contract.replace(
    anchor,
    anchor
    + "\nassert.match(studio, /creative-job-settings-draft:/);"
    + "\nassert.match(studio, /sessionStorage\\.setItem/);"
    + "\nassert.match(studio, /sessionStorage\\.getItem/);",
    1,
)
write(contract_path, contract)

print("Applied Creative release corrections and stable draft handoff.")
