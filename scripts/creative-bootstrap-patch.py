from __future__ import annotations

import json
from pathlib import Path


def require_replace(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    actual = text.count(old)
    if actual < count:
        raise SystemExit(
            f"{path}: expected at least {count} occurrence(s), found {actual}: {old[:120]!r}"
        )
    file.write_text(text.replace(old, new, count), encoding="utf-8")


def patch_permissions() -> None:
    path = Path("src/lib/security/workspacePermissions.ts")
    text = path.read_text(encoding="utf-8")
    if '"creative_jobs"' in text:
        return
    text = text.replace('  "calendar",\n', '  "calendar",\n  "creative_jobs",\n', 1)
    text = text.replace(
        '    "calendar",\n    "launchhub",',
        '    "calendar",\n    "creative_jobs",\n    "launchhub",',
        3,
    )
    text = text.replace(
        '  designer: ["dashboard", "calendar", "launchhub"],',
        '  designer: ["dashboard", "calendar", "creative_jobs", "launchhub"],',
        1,
    )
    marker = '  if (pathname.startsWith("/tasks")) return "calendar";\n'
    if marker not in text:
        raise SystemExit("workspacePermissions task path marker missing")
    text = text.replace(
        marker,
        marker
        + '  if (\n'
        + '    pathname.startsWith("/creative-jobs") ||\n'
        + '    pathname.startsWith("/api/creative-jobs")\n'
        + '  ) return "creative_jobs";\n',
        1,
    )
    path.write_text(text, encoding="utf-8")


def patch_internal_access() -> None:
    path = Path("src/lib/security/internalAccess.ts")
    text = path.read_text(encoding="utf-8")
    if '| "creative_jobs"' not in text:
        marker = '  | "calendar"\n'
        if marker not in text:
            raise SystemExit("InternalModule calendar marker missing")
        text = text.replace(marker, marker + '  | "creative_jobs"\n', 1)
        path.write_text(text, encoding="utf-8")


def patch_nav_client() -> None:
    path = Path("src/components/alyssa/AppNavClient.tsx")
    text = path.read_text(encoding="utf-8")
    if "Palette," not in text:
        marker = "  MessageCircleMore,\n"
        if marker not in text:
            raise SystemExit("AppNavClient icon marker missing")
        text = text.replace(marker, marker + "  Palette,\n", 1)

    if 'label: "工作協作"' not in text:
        calendar_item = '      { href: "/calendar", label: "營銷日曆", icon: CalendarDays, module: "calendar" },\n'
        task_item = '      { href: "/tasks", label: "工作事項", icon: ListTodo, module: "calendar" },\n'
        if calendar_item not in text or task_item not in text:
            raise SystemExit("AppNavClient calendar/task items missing")
        text = text.replace(calendar_item, "", 1).replace(task_item, "", 1)
        marker = '  {\n    label: "客戶營運",\n'
        if marker not in text:
            raise SystemExit("AppNavClient customer group marker missing")
        group = (
            '  {\n'
            '    label: "工作協作",\n'
            '    items: [\n'
            '      { href: "/calendar", label: "營銷日曆", icon: CalendarDays, module: "calendar" },\n'
            '      { href: "/tasks", label: "工作事項", icon: ListTodo, module: "calendar" },\n'
            '      { href: "/creative-jobs", label: "設計工作", icon: Palette, module: "creative_jobs" },\n'
            '    ],\n'
            '  },\n'
        )
        text = text.replace(marker, group + marker, 1)

    if "creativeNotificationCount" not in text:
        replacements = [
            (
                "  workNotificationCount,\n}: {",
                "  workNotificationCount,\n  creativeNotificationCount,\n}: {",
            ),
            (
                "  workNotificationCount: number;\n}) {",
                "  workNotificationCount: number;\n  creativeNotificationCount: number;\n}) {",
            ),
            (
                "  workNotificationCount = 0,\n}: {",
                "  workNotificationCount = 0,\n  creativeNotificationCount = 0,\n}: {",
            ),
            (
                "  workNotificationCount?: number;\n}) {",
                "  workNotificationCount?: number;\n  creativeNotificationCount?: number;\n}) {",
            ),
            (
                "          workNotificationCount={workNotificationCount}\n",
                "          workNotificationCount={workNotificationCount}\n          creativeNotificationCount={creativeNotificationCount}\n",
            ),
        ]
        for old, new in replacements:
            if old not in text:
                raise SystemExit(f"AppNavClient prop marker missing: {old!r}")
            text = text.replace(old, new, 1)

        badge_marker = (
            '        if (item.href === "/tasks" && workNotificationCount > 0) {\n'
            "          return { ...item, badge: String(workNotificationCount) };\n"
            "        }\n"
            "        return item;\n"
        )
        if badge_marker not in text:
            raise SystemExit("AppNavClient task badge marker missing")
        text = text.replace(
            badge_marker,
            badge_marker.replace(
                "        return item;\n",
                '        if (item.href === "/creative-jobs" && creativeNotificationCount > 0) {\n'
                "          return { ...item, badge: String(creativeNotificationCount) };\n"
                "        }\n"
                "        return item;\n",
            ),
            1,
        )
    path.write_text(text, encoding="utf-8")


def patch_nav_server() -> None:
    path = Path("src/components/alyssa/AppNav.tsx")
    text = path.read_text(encoding="utf-8")
    if "getUnreadCreativeNotificationCount" in text:
        return
    text = text.replace(
        'import { getUnreadWorkNotificationCount } from "@/lib/marketing/workTasks";\n',
        'import { getUnreadWorkNotificationCount } from "@/lib/marketing/workTasks";\n'
        'import { getUnreadCreativeNotificationCount } from "@/lib/creative/store";\n',
        1,
    )
    for old, new in [
        (
            "  workNotificationCount: providedWorkNotificationCount,\n}: {",
            "  workNotificationCount: providedWorkNotificationCount,\n  creativeNotificationCount: providedCreativeNotificationCount,\n}: {",
        ),
        (
            "  workNotificationCount?: number;\n} = {}) {",
            "  workNotificationCount?: number;\n  creativeNotificationCount?: number;\n} = {}) {",
        ),
    ]:
        if old not in text:
            raise SystemExit(f"AppNav server prop marker missing: {old!r}")
        text = text.replace(old, new, 1)
    calendar_block = (
        "  const canSeeCalendar =\n"
        "    isMaster ||\n"
        '    access.source !== "supabase_auth" ||\n'
        '    hasWorkspaceModulePermission(permissionContext, "calendar");\n'
    )
    if calendar_block not in text:
        raise SystemExit("AppNav server calendar block missing")
    text = text.replace(
        calendar_block,
        calendar_block
        + "  const canSeeCreative =\n"
        + "    isMaster ||\n"
        + '    access.source !== "supabase_auth" ||\n'
        + '    hasWorkspaceModulePermission(permissionContext, "creative_jobs");\n',
        1,
    )
    text = text.replace(
        "  const [leadAuditAlertCount, workNotificationCount] = await Promise.all([",
        "  const [leadAuditAlertCount, workNotificationCount, creativeNotificationCount] = await Promise.all([",
        1,
    )
    promise_marker = (
        "    providedWorkNotificationCount ??\n"
        "      (canSeeCalendar ? getUnreadWorkNotificationCount() : 0),\n"
        "  ]);\n"
    )
    if promise_marker not in text:
        raise SystemExit("AppNav server Promise.all marker missing")
    text = text.replace(
        promise_marker,
        "    providedWorkNotificationCount ??\n"
        "      (canSeeCalendar ? getUnreadWorkNotificationCount() : 0),\n"
        "    providedCreativeNotificationCount ??\n"
        "      (canSeeCreative ? getUnreadCreativeNotificationCount() : 0),\n"
        "  ]);\n",
        1,
    )
    pass_marker = "      workNotificationCount={workNotificationCount}\n"
    if pass_marker not in text:
        raise SystemExit("AppNav server component prop marker missing")
    text = text.replace(
        pass_marker,
        pass_marker + "      creativeNotificationCount={creativeNotificationCount}\n",
        1,
    )
    path.write_text(text, encoding="utf-8")


def patch_team_settings() -> None:
    path = Path("src/app/settings/team/page.tsx")
    text = path.read_text(encoding="utf-8")
    if '["creative_jobs", "設計工作"]' not in text:
        marker = '  ["calendar", "營銷日曆"],\n'
        if marker not in text:
            raise SystemExit("Team settings calendar module marker missing")
        text = text.replace(marker, marker + '  ["creative_jobs", "設計工作"],\n', 1)
        path.write_text(text, encoding="utf-8")


def patch_actions() -> None:
    path = Path("src/app/creative-jobs/actions.ts")
    text = path.read_text(encoding="utf-8")
    if "isCreativeOperationsRole," not in text:
        marker = "  isCreativeDesignerRole,\n"
        if marker not in text:
            raise SystemExit("Creative actions role import marker missing")
        text = text.replace(marker, marker + "  isCreativeOperationsRole,\n", 1)
    text = text.replace(
        '  if (!canEditCreativeJobMetadata(access, { brandId: "" })) {',
        "  if (!isCreativeOperationsRole(access)) {",
        1,
    )
    before_update = text.split("export async function updateCreativeJobAction", 1)[0]
    if "Campaign 目的" not in before_update:
        marker = (
            "      requester_email:\n"
            "        access.email ||\n"
            '        (access.accessLevel === "master" ? "master" : "shared_admin"),\n'
        )
        if marker not in text:
            raise SystemExit("Creative draft payload marker missing")
        brief = '''      brief_document: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Campaign 目的" }] },
          { type: "paragraph", content: [{ type: "text", text: "寫低今次內容／廣告要解決嘅問題，同埋成功標準。" }] },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Deliverables／輸出要求" }] },
          { type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "列明數量、尺寸、片長、平台、字幕、VO 同版本要求" }] }] }] },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "畫面及 Reference" }] },
          { type: "paragraph", content: [{ type: "text", text: "可直接 Ctrl + V 貼 Screenshot，或者由右邊素材庫插入圖片及 Google Drive 連結。" }] },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "必須遵守／不可出現" }] },
          { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "價錢、CTA、Logo、合規字眼及品牌要求" }] }] }] },
        ],
      },
      brief_plain_text: "Campaign 目的\\nDeliverables／輸出要求\\n畫面及 Reference\\n必須遵守／不可出現",
'''
        text = text.replace(marker, marker + brief, 1)
    path.write_text(text, encoding="utf-8")


def patch_studio_import() -> None:
    path = Path("src/components/creative/CreativeJobStudio.tsx")
    text = path.read_text(encoding="utf-8")
    text = text.replace("  restoreCreativeBriefVersionAction,\n", "", 1)
    if 'from "@/app/creative-jobs/versionActions"' not in text:
        marker = '} from "@/app/creative-jobs/actions";\n'
        if marker not in text:
            raise SystemExit("CreativeJobStudio actions import marker missing")
        text = text.replace(
            marker,
            marker
            + 'import { restoreCreativeBriefVersionAction } from "@/app/creative-jobs/versionActions";\n',
            1,
        )
    text = text.replace("  type FormEvent,\n", "", 1)
    path.write_text(text, encoding="utf-8")


def patch_editor() -> None:
    path = Path("src/components/creative/CreativeBriefEditor.tsx")
    text = path.read_text(encoding="utf-8")
    if "type ReactNode" not in text:
        marker = '  useState,\n} from "react";'
        if marker not in text:
            raise SystemExit("CreativeBriefEditor React import marker missing")
        text = text.replace(
            marker,
            '  useState,\n  type ReactNode,\n} from "react";',
            1,
        )
    text = text.replace("        resize: false,\n", "", 1)
    text = text.replace("  children: React.ReactNode;", "  children: ReactNode;", 1)
    path.write_text(text, encoding="utf-8")


def patch_page_types() -> None:
    path = Path("src/app/creative-jobs/page.tsx")
    text = path.read_text(encoding="utf-8")
    if "type ReactNode" not in text:
        text = text.replace(
            'import Link from "next/link";\n',
            'import Link from "next/link";\nimport type { ReactNode } from "react";\n',
            1,
        )
    text = text.replace("children: React.ReactNode;", "children: ReactNode;", 1)
    path.write_text(text, encoding="utf-8")

    test_path = Path("e2e/creative-production.spec.ts")
    test_text = test_path.read_text(encoding="utf-8")
    test_text = test_text.replace(
        'import { expect, test } from "@playwright/test";',
        'import { expect, test, type Page } from "@playwright/test";',
        1,
    )
    test_text = test_text.replace(
        "async function openFixture(page: Parameters<typeof test>[0] extends never ? never : any) {",
        "async function openFixture(page: Page) {",
        1,
    )
    test_path.write_text(test_text, encoding="utf-8")

    store_path = Path("src/lib/creative/store.ts")
    store_text = store_path.read_text(encoding="utf-8")
    store_text = store_text.replace(
        '.not("status", "in", \'("completed","cancelled")\');',
        '.not("status", "in", "(completed,cancelled)");',
        1,
    )
    store_path.write_text(store_text, encoding="utf-8")


def patch_edge_push() -> None:
    path = Path("supabase/functions/marketing-web-push-dispatch/index.ts")
    text = path.read_text(encoding="utf-8")
    if "creative_job_id" in text:
        return
    text = text.replace(
        "  calendar_item_id: string | null;\n};",
        "  calendar_item_id: string | null;\n  creative_job_id: string | null;\n  action_url: string | null;\n};",
        1,
    )
    text = text.replace(
        '    "calendar_published",\n',
        '    "calendar_published",\n'
        '    "creative_assigned",\n'
        '    "creative_priority_changed",\n'
        '    "creative_due_soon",\n'
        '    "creative_overdue",\n'
        '    "creative_revision",\n',
        1,
    )
    text = text.replace(
        '"id,notification_type,title,body,task_id,calendar_item_id"',
        '"id,notification_type,title,body,task_id,calendar_item_id,creative_job_id,action_url"',
        1,
    )
    text = text.replace(
        '    let url = "/tasks";\n    if (notification.task_id) {',
        '    let url = notification.action_url || "/tasks";\n    if (!notification.action_url && notification.task_id) {',
        1,
    )
    text = text.replace(
        "    } else if (notification.calendar_item_id) {",
        "    } else if (!notification.action_url && notification.calendar_item_id) {",
        1,
    )
    text = text.replace(
        '      requireInteraction: notification.notification_type === "task_overdue",',
        '      requireInteraction: ["task_overdue", "creative_overdue"].includes(notification.notification_type),',
        1,
    )
    path.write_text(text, encoding="utf-8")


def patch_migration_restore() -> None:
    path = Path("supabase/migrations/20260901020000_creative_production_studio.sql")
    text = path.read_text(encoding="utf-8")
    if "restore_creative_brief_version" in text:
        return
    marker = "create or replace function public.queue_creative_job_reminders()"
    if marker not in text:
        raise SystemExit("Creative reminder function marker missing")
    function_sql = r'''
create or replace function public.restore_creative_brief_version(
  p_job_id uuid,
  p_source_version_id uuid,
  p_new_version_no integer,
  p_actor_member_id uuid,
  p_actor_email text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_job public.creative_jobs%rowtype;
  source_version public.creative_job_brief_versions%rowtype;
begin
  select * into current_job
  from public.creative_jobs
  where id = p_job_id and deleted_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'creative_job_not_found';
  end if;

  select * into source_version
  from public.creative_job_brief_versions
  where id = p_source_version_id and job_id = p_job_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'creative_brief_version_not_found';
  end if;

  insert into public.creative_job_brief_versions (
    job_id, version_no, document, plain_text, reason,
    created_by_member_id, created_by_email
  ) values (
    p_job_id, p_new_version_no, current_job.brief_document,
    current_job.brief_plain_text, 'manual', p_actor_member_id, p_actor_email
  );

  update public.creative_jobs
  set brief_document = source_version.document,
      brief_plain_text = source_version.plain_text,
      updated_at = now()
  where id = p_job_id;

  insert into public.creative_job_brief_versions (
    job_id, version_no, document, plain_text, reason,
    created_by_member_id, created_by_email
  ) values (
    p_job_id, p_new_version_no + 1, source_version.document,
    source_version.plain_text, 'restore', p_actor_member_id, p_actor_email
  );
end;
$$;

revoke all on function public.restore_creative_brief_version(
  uuid, uuid, integer, uuid, text
) from public, anon, authenticated;
grant execute on function public.restore_creative_brief_version(
  uuid, uuid, integer, uuid, text
) to service_role;

'''
    path.write_text(text.replace(marker, function_sql + marker, 1), encoding="utf-8")


def patch_package() -> None:
    path = Path("package.json")
    package = json.loads(path.read_text(encoding="utf-8"))
    scripts = package.setdefault("scripts", {})
    scripts["verify:creative-production-contract"] = (
        "node scripts/verify-creative-production-contract.mjs"
    )
    scripts["test:creative"] = "playwright test e2e/creative-production.spec.ts"
    verify = "npm run verify:creative-production-contract"
    build = scripts.get("build", "")
    if verify not in build:
        marker = "npm run verify:design-system-contract && next build"
        if marker not in build:
            raise SystemExit("package build design-system marker missing")
        build = build.replace(
            marker,
            "npm run verify:design-system-contract && " + verify + " && next build",
            1,
        )
        scripts["build"] = build
    path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    patch_permissions()
    patch_internal_access()
    patch_nav_client()
    patch_nav_server()
    patch_team_settings()
    patch_actions()
    patch_studio_import()
    patch_editor()
    patch_page_types()
    patch_edge_push()
    patch_migration_restore()
    patch_package()
    print("Creative Production Studio source patches completed.")


if __name__ == "__main__":
    main()
