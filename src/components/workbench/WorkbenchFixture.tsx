"use client";
import { createWorkbenchTemplate, type WorkbenchRecord } from "@/lib/workbench/model";
import { Workbench } from "./Workbench";

const template = createWorkbenchTemplate();
template.jobs = [{ id: "fixture-job", nodeId: "creative", relatedNodeIds: ["gos"], title: "跟進本周 Creative 素材", description: "確認交片日、修改版本同負責人。", status: "todo", priority: "high", focusDate: "2026-11-10", dueDate: "2026-11-12", assignee: "跟進同事", briefUrl: "/creative-jobs", notes: "", checklist: [{ id: "check-brief", label: "確認 Brief", done: false }, { id: "check-date", label: "確認交片日期", done: true }], source: "驗收資料", archived: false },
  { id: "fixture-system", nodeId: "systems", relatedNodeIds: ["ib", "gos", "sk"], title: "核對品牌數據同步", description: "沿用正式資料來源。", status: "waiting", priority: "normal", focusDate: "", dueDate: "", assignee: "", briefUrl: "", notes: "", checklist: [], source: "驗收資料", archived: false }];
export const populatedWorkbenchFixture: WorkbenchRecord = { document: template, revision: 1, updatedAt: "2026-11-10T01:00:00.000Z" };
export const emptyWorkbenchFixture: WorkbenchRecord = { document: createWorkbenchTemplate(), revision: 1, updatedAt: "2026-11-10T00:00:00.000Z" };
export function WorkbenchFixture({ empty = false, remotePersistence = false }: { empty?: boolean; remotePersistence?: boolean }) { return <Workbench initialRecord={remotePersistence ? undefined : empty ? emptyWorkbenchFixture : populatedWorkbenchFixture} fixtureMode={!remotePersistence} fixtureToday="2026-11-10" ownerScope={remotePersistence ? "e2e-workbench-owner" : undefined} />; }
