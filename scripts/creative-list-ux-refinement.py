from __future__ import annotations

import re
from pathlib import Path
from textwrap import dedent


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    file = Path(path)
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f"Missing marker for {label}")


def regex_replace_once(text: str, pattern: str, replacement: str, label: str) -> str:
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count == 1:
        return next_text
    if replacement.strip() in text:
        return text
    raise SystemExit(f"Missing regex marker for {label}")


HEADER_ACTIONS_COMPONENT = dedent(
    r'''\
    "use client";

    import Link from "next/link";
    import { useRef, useState, type ComponentType, type ReactNode } from "react";
    import {
      AlertTriangle,
      BellRing,
      CalendarCheck2,
      CircleHelp,
      Clock3,
      Plus,
      Settings2,
      X,
    } from "lucide-react";
    import { SubmitButton } from "@/components/alyssa/SubmitButton";
    import { DesktopNotificationControl } from "@/components/command-center/DesktopNotificationControl";
    import { createCreativeDraftAction } from "@/app/creative-jobs/actions";
    import type { BrandSetting } from "@/lib/data/configuration";
    import type {
      CreativeDesignerProfile,
      CreativeTaxonomyItem,
    } from "@/lib/creative/types";
    import {
      creativePriorities,
      creativePriorityLabels,
      creativeWorkloads,
    } from "@/lib/creative/types";
    import styles from "./CreativeJobHeaderActions.module.css";

    type CreativeJobHeaderActionsProps = {
      canCreate: boolean;
      canManageSettings: boolean;
      brands: BrandSetting[];
      designers: CreativeDesignerProfile[];
      taxonomies: CreativeTaxonomyItem[];
      today: string;
      defaultBrandId: string;
    };

    type GuideIcon = ComponentType<{ size?: number; strokeWidth?: number }>;

    function openDialog(ref: React.RefObject<HTMLDialogElement | null>) {
      if (!ref.current?.open) ref.current?.showModal();
    }

    function closeDialog(ref: React.RefObject<HTMLDialogElement | null>) {
      if (ref.current?.open) ref.current.close();
    }

    function closeOnBackdrop(
      event: React.MouseEvent<HTMLDialogElement>,
      ref: React.RefObject<HTMLDialogElement | null>
    ) {
      if (event.target === event.currentTarget) closeDialog(ref);
    }

    function GuideRule({
      icon: Icon,
      title,
      children,
    }: {
      icon: GuideIcon;
      title: string;
      children: ReactNode;
    }) {
      return (
        <div className={styles.guideRule}>
          <span className={styles.guideIcon} aria-hidden="true">
            <Icon size={16} strokeWidth={2} />
          </span>
          <div>
            <strong>{title}</strong>
            <p>{children}</p>
          </div>
        </div>
      );
    }

    export function CreativeJobHeaderActions({
      canCreate,
      canManageSettings,
      brands,
      designers,
      taxonomies,
      today,
      defaultBrandId,
    }: CreativeJobHeaderActionsProps) {
      const createDialogRef = useRef<HTMLDialogElement | null>(null);
      const guideDialogRef = useRef<HTMLDialogElement | null>(null);
      const [designerId, setDesignerId] = useState("");
      const assignmentFieldsRequired = Boolean(designerId);
      const activeDesigners = designers.filter((designer) => designer.isActive);
      const activeTaxonomies = taxonomies.filter((item) => item.isActive);
      const sourceOptions = activeTaxonomies.filter(
        (item) => item.category === "source"
      );
      const usageOptions = activeTaxonomies.filter(
        (item) => item.category === "usage"
      );
      const mediaFormatOptions = activeTaxonomies.filter(
        (item) => item.category === "media_format"
      );
      const resolvedBrandId =
        brands.some((brand) => brand.id === defaultBrandId)
          ? defaultBrandId
          : brands[0]?.id || "";

      return (
        <div className={styles.actions}>
          <button
            type="button"
            className="command-secondary-button"
            onClick={() => openDialog(guideDialogRef)}
            aria-haspopup="dialog"
          >
            <CircleHelp size={15} /> 操作指引
          </button>

          {canManageSettings ? (
            <Link href="/settings/creative" className="command-secondary-button">
              <Settings2 size={15} /> 分類及 Designer
            </Link>
          ) : null}

          {canCreate ? (
            <button
              type="button"
              className="command-primary-button"
              onClick={() => openDialog(createDialogRef)}
              aria-haspopup="dialog"
              disabled={brands.length === 0}
            >
              <Plus size={16} /> 新增設計 Job
            </button>
          ) : null}

          <dialog
            ref={guideDialogRef}
            className={`${styles.dialog} ${styles.guideDialog}`}
            aria-labelledby="creative-job-guide-title"
            onClick={(event) => closeOnBackdrop(event, guideDialogRef)}
          >
            <section className={styles.sheet}>
              <header className={styles.sheetHeader}>
                <div>
                  <p>Creative production</p>
                  <h2 id="creative-job-guide-title">設計工作指引</h2>
                  <span>需要時先打開，唔再長期佔用 Job List 寬度。</span>
                </div>
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={() => closeDialog(guideDialogRef)}
                  aria-label="關閉設計工作指引"
                >
                  <X size={18} />
                </button>
              </header>
              <div className={styles.sheetBody}>
                <div className={styles.guideIntro}>
                  <strong>派 Job 規則</strong>
                  <span>三個日期各自負責一個清晰用途。</span>
                </div>
                <div className={styles.guideRules}>
                  <GuideRule icon={Clock3} title="Start Day">
                    預設香港今日，可改；決定 Job List 顯示及開始提醒。
                  </GuideRule>
                  <GuideRule icon={AlertTriangle} title="Due Day">
                    Designer 交稿截止；控制 24 小時提醒同逾期。
                  </GuideRule>
                  <GuideRule icon={CalendarCheck2} title="Publish Day">
                    只有勾選同步日曆先啟用；決定實際出街日期。
                  </GuideRule>
                </div>
                <div className={styles.notificationHeading}>
                  <BellRing size={17} />
                  <div>
                    <strong>桌面通知</strong>
                    <span>
                      只支援已登入嘅個人受邀帳戶；共用管理員登入唔會綁定私人裝置。
                    </span>
                  </div>
                </div>
                <DesktopNotificationControl />
              </div>
            </section>
          </dialog>

          {canCreate ? (
            <dialog
              ref={createDialogRef}
              className={`${styles.dialog} ${styles.createDialog}`}
              aria-labelledby="creative-job-create-title"
              onClick={(event) => closeOnBackdrop(event, createDialogRef)}
            >
              <form action={createCreativeDraftAction} className={styles.sheet}>
                <header className={styles.sheetHeader}>
                  <div>
                    <p>New creative job</p>
                    <h2 id="creative-job-create-title">新增設計 Job</h2>
                    <span>
                      喺同一個系統內以小視窗填基本資料，建立後再開完整 Brief Workspace。
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.closeButton}
                    onClick={() => closeDialog(createDialogRef)}
                    aria-label="關閉新增設計 Job"
                  >
                    <X size={18} />
                  </button>
                </header>

                <div className={styles.sheetBody}>
                  <div className={styles.formGrid}>
                    <label className={styles.fullField}>
                      <span>Job 名稱</span>
                      <input
                        name="title"
                        maxLength={240}
                        required
                        autoFocus
                        placeholder="例如：IB DEP 9 月 Meta AD 短片"
                      />
                    </label>

                    <label>
                      <span>品牌</span>
                      <select name="brandId" defaultValue={resolvedBrandId} required>
                        {brands.map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Designer</span>
                      <select
                        name="assigneeProfileId"
                        value={designerId}
                        onChange={(event) => setDesignerId(event.target.value)}
                      >
                        <option value="">暫不派發，先儲存草稿</option>
                        {activeDesigners.map((designer) => (
                          <option key={designer.id} value={designer.id}>
                            {designer.displayName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Start Day</span>
                      <input name="startDate" type="date" defaultValue={today} required />
                    </label>

                    <label>
                      <span>
                        Due Day {assignmentFieldsRequired ? <em>派發必填</em> : null}
                      </span>
                      <input
                        name="dueDate"
                        type="date"
                        min={today}
                        required={assignmentFieldsRequired}
                      />
                    </label>

                    <label>
                      <span>優先級</span>
                      <select name="priority" defaultValue="normal">
                        {creativePriorities.map((priority) => (
                          <option key={priority} value={priority}>
                            {creativePriorityLabels[priority]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>工作量</span>
                      <select name="workload" defaultValue="M">
                        {creativeWorkloads.map((workload) => (
                          <option key={workload} value={workload}>
                            {workload}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>
                        Source {assignmentFieldsRequired ? <em>派發必填</em> : null}
                      </span>
                      <select
                        name="sourceTaxonomyId"
                        defaultValue=""
                        required={assignmentFieldsRequired}
                      >
                        <option value="">選擇素材來源</option>
                        {sourceOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>
                        用途 {assignmentFieldsRequired ? <em>派發必填</em> : null}
                      </span>
                      <select
                        name="usageTaxonomyId"
                        defaultValue=""
                        required={assignmentFieldsRequired}
                      >
                        <option value="">選擇使用位置</option>
                        {usageOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>
                        媒體格式 {assignmentFieldsRequired ? <em>派發必填</em> : null}
                      </span>
                      <select
                        name="mediaFormatTaxonomyId"
                        defaultValue=""
                        required={assignmentFieldsRequired}
                      >
                        <option value="">選擇交付格式</option>
                        {mediaFormatOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>數量</span>
                      <input
                        name="quantity"
                        type="number"
                        min={1}
                        max={999}
                        defaultValue={1}
                        required
                      />
                    </label>

                    <label>
                      <span>素材狀態</span>
                      <select name="materialStatus" defaultValue="ready">
                        <option value="ready">素材已準備</option>
                        <option value="waiting">等待素材</option>
                      </select>
                    </label>
                  </div>

                  <div className={styles.assignmentNote}>
                    <strong>建立邏輯</strong>
                    <p>
                      未揀 Designer 會先儲存為草稿；一揀 Designer，系統會要求 Due Day、Source、用途及媒體格式齊全，避免派出資料不足嘅 Job。
                    </p>
                  </div>
                </div>

                <footer className={styles.sheetFooter}>
                  <button
                    type="button"
                    className="command-secondary-button"
                    onClick={() => closeDialog(createDialogRef)}
                  >
                    取消
                  </button>
                  <SubmitButton
                    className="command-primary-button"
                    pendingLabel="建立中…"
                  >
                    <Plus size={16} /> 建立並開啟 Brief
                  </SubmitButton>
                </footer>
              </form>
            </dialog>
          ) : null}
        </div>
      );
    }
    '''
)

HEADER_ACTIONS_CSS = dedent(
    r'''\
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .dialog {
      position: fixed;
      inset: 0 0 0 auto;
      width: min(720px, 100vw);
      height: 100dvh;
      max-width: none;
      max-height: none;
      margin: 0;
      overflow: hidden;
      border: 0;
      border-radius: 1.5rem 0 0 1.5rem;
      background: transparent;
      padding: 0;
      color: #321428;
    }

    .guideDialog {
      width: min(470px, 100vw);
    }

    .dialog::backdrop {
      background: rgba(50, 20, 40, 0.28);
      backdrop-filter: blur(4px);
    }

    .sheet {
      display: flex;
      height: 100%;
      min-height: 0;
      flex-direction: column;
      background: #fffdfc;
      box-shadow: -24px 0 80px rgba(50, 20, 40, 0.2);
      animation: creative-sheet-enter 180ms ease-out;
    }

    .sheetHeader {
      display: flex;
      flex: 0 0 auto;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      border-bottom: 1px solid #ead9cf;
      background: linear-gradient(145deg, #fffaf7, #fff5f8);
      padding: 1.4rem 1.5rem 1.2rem;
    }

    .sheetHeader p,
    .sheetHeader h2,
    .sheetHeader span {
      margin: 0;
    }

    .sheetHeader p {
      color: #9a5d76;
      font-size: 0.66rem;
      font-weight: 850;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .sheetHeader h2 {
      margin-top: 0.32rem;
      color: #321428;
      font-size: 1.45rem;
      font-weight: 900;
      letter-spacing: -0.035em;
    }

    .sheetHeader span {
      display: block;
      max-width: 34rem;
      margin-top: 0.38rem;
      color: #806174;
      font-size: 0.76rem;
      font-weight: 620;
      line-height: 1.55;
    }

    .closeButton {
      display: grid;
      width: 2.35rem;
      height: 2.35rem;
      flex: 0 0 auto;
      place-items: center;
      border: 1px solid #e3d1ca;
      border-radius: 0.8rem;
      background: #fff;
      color: #6d4a5c;
      transition: border-color 150ms ease, background 150ms ease, color 150ms ease;
    }

    .closeButton:hover {
      border-color: #cfaebe;
      background: #fff7fa;
      color: #5a2348;
    }

    .closeButton:focus-visible {
      outline: 3px solid rgba(90, 35, 72, 0.2);
      outline-offset: 2px;
    }

    .sheetBody {
      min-height: 0;
      flex: 1;
      overflow-y: auto;
      padding: 1.35rem 1.5rem 1.75rem;
      overscroll-behavior: contain;
    }

    .sheetFooter {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: flex-end;
      gap: 0.65rem;
      border-top: 1px solid #ead9cf;
      background: rgba(255, 253, 252, 0.96);
      padding: 1rem 1.5rem;
      backdrop-filter: blur(14px);
    }

    .formGrid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.9rem;
    }

    .formGrid label {
      display: grid;
      min-width: 0;
      gap: 0.42rem;
    }

    .formGrid label > span {
      color: #5d3b4d;
      font-size: 0.72rem;
      font-weight: 820;
    }

    .formGrid label > span em {
      margin-left: 0.25rem;
      color: #a43b50;
      font-size: 0.59rem;
      font-style: normal;
    }

    .formGrid input,
    .formGrid select {
      width: 100%;
      min-height: 2.75rem;
      border: 1px solid #dfcdc4;
      border-radius: 0.82rem;
      background: #fff;
      padding: 0.68rem 0.78rem;
      color: #321428;
      font-size: 0.8rem;
      font-weight: 650;
      outline: none;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    .formGrid input:focus,
    .formGrid select:focus {
      border-color: #9a5d76;
      box-shadow: 0 0 0 3px rgba(154, 93, 118, 0.12);
    }

    .fullField {
      grid-column: 1 / -1;
    }

    .assignmentNote,
    .guideIntro,
    .notificationHeading {
      border: 1px solid #ead9cf;
      border-radius: 1rem;
      background: #fffaf7;
      padding: 0.9rem 1rem;
    }

    .assignmentNote {
      margin-top: 1rem;
    }

    .assignmentNote strong,
    .assignmentNote p,
    .guideIntro strong,
    .guideIntro span,
    .notificationHeading strong,
    .notificationHeading span {
      margin: 0;
    }

    .assignmentNote strong,
    .guideIntro strong,
    .notificationHeading strong {
      display: block;
      color: #321428;
      font-size: 0.76rem;
      font-weight: 850;
    }

    .assignmentNote p,
    .guideIntro span,
    .notificationHeading span {
      display: block;
      margin-top: 0.26rem;
      color: #806174;
      font-size: 0.69rem;
      font-weight: 620;
      line-height: 1.55;
    }

    .guideRules {
      display: grid;
      gap: 0.7rem;
      margin-top: 0.85rem;
    }

    .guideRule {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      border: 1px solid #eee0da;
      border-radius: 1rem;
      background: #fff;
      padding: 0.85rem;
    }

    .guideIcon {
      display: grid;
      width: 2.2rem;
      height: 2.2rem;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 0.78rem;
      background: #fff0f5;
      color: #7c365f;
    }

    .guideRule strong,
    .guideRule p {
      margin: 0;
    }

    .guideRule strong {
      color: #321428;
      font-size: 0.75rem;
      font-weight: 850;
    }

    .guideRule p {
      margin-top: 0.2rem;
      color: #806174;
      font-size: 0.68rem;
      font-weight: 620;
      line-height: 1.55;
    }

    .notificationHeading {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
      margin-top: 1rem;
      color: #7c365f;
    }

    @keyframes creative-sheet-enter {
      from {
        opacity: 0.6;
        transform: translateX(2rem);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @media (max-width: 640px) {
      .actions {
        width: 100%;
        justify-content: stretch;
      }

      .actions > button,
      .actions > a {
        flex: 1 1 auto;
      }

      .dialog {
        width: 100vw;
        border-radius: 0;
      }

      .sheetHeader,
      .sheetBody,
      .sheetFooter {
        padding-inline: 1rem;
      }

      .formGrid {
        grid-template-columns: 1fr;
      }

      .fullField {
        grid-column: auto;
      }

      .sheetFooter > * {
        flex: 1 1 0;
      }
    }
    '''
)

SIDEBAR_CSS = dedent(
    r'''\
    .sidebarHost {
      transition: width 180ms ease, transform 180ms ease, box-shadow 180ms ease;
    }

    .sidebarHost :global(.command-brand) {
      position: relative;
    }

    .collapseButton {
      position: absolute;
      top: 1.62rem;
      right: -0.78rem;
      z-index: 4;
      display: grid;
      width: 1.7rem;
      height: 1.7rem;
      place-items: center;
      border: 1px solid #dfcdc4;
      border-radius: 999px;
      background: #fff;
      color: #6d4a5c;
      box-shadow: 0 8px 20px rgba(50, 20, 40, 0.14);
      transition: transform 150ms ease, border-color 150ms ease, color 150ms ease;
    }

    .collapseButton:hover {
      transform: translateY(-1px);
      border-color: #b98da2;
      color: #5a2348;
    }

    .collapseButton:focus-visible {
      outline: 3px solid rgba(90, 35, 72, 0.2);
      outline-offset: 2px;
    }

    :global(.alyssa-shell),
    :global(.system-page-loading) {
      transition: padding-left 180ms ease;
    }

    @media (min-width: 1025px) {
      :global(html.command-sidebar-collapsed) {
        --command-sidebar-width: 76px;
      }

      :global(html.command-sidebar-collapsed .command-brand) {
        padding-inline: 0.7rem;
      }

      :global(html.command-sidebar-collapsed .command-brand-link) {
        justify-content: center;
      }

      :global(html.command-sidebar-collapsed .command-brand-link > .min-w-0),
      :global(html.command-sidebar-collapsed .command-nav-group > p),
      :global(html.command-sidebar-collapsed .command-nav-item > span:not(.command-nav-badge):not(.intent-link-status)),
      :global(html.command-sidebar-collapsed .command-nav-item > .ml-auto),
      :global(html.command-sidebar-collapsed .command-account-card > .min-w-0),
      :global(html.command-sidebar-collapsed .command-account-card > svg),
      :global(html.command-sidebar-collapsed .command-logout-button > span) {
        display: none;
      }

      :global(html.command-sidebar-collapsed .command-navigation) {
        padding-inline: 0.5rem;
      }

      :global(html.command-sidebar-collapsed .command-nav-group + .command-nav-group) {
        margin-top: 0.55rem;
      }

      :global(html.command-sidebar-collapsed .command-nav-item) {
        position: relative;
        justify-content: center;
        gap: 0;
        padding-inline: 0.55rem;
      }

      :global(html.command-sidebar-collapsed .command-nav-item:hover) {
        transform: none;
      }

      :global(html.command-sidebar-collapsed .command-nav-badge) {
        position: absolute;
        top: 0.22rem;
        right: 0.18rem;
        min-width: 1rem;
        margin: 0;
        padding: 0.08rem 0.25rem;
        text-align: center;
      }

      :global(html.command-sidebar-collapsed .command-sidebar-footer) {
        padding: 0.5rem;
      }

      :global(html.command-sidebar-collapsed .command-account-card) {
        justify-content: center;
        padding-inline: 0.45rem;
      }

      :global(html.command-sidebar-collapsed .command-logout-button) {
        padding-inline: 0.45rem;
      }
    }

    @media (max-width: 1024px) {
      .collapseButton {
        display: none;
      }
    }
    '''
)


NEW_CREATE_ACTION = dedent(
    r'''\
    export async function createCreativeDraftAction(formData: FormData) {
      const access = await requireCreativeAction();
      if (!isCreativeOperationsRole(access)) {
        redirectWithMessage(
          "/creative-jobs",
          false,
          "只有 Marketer、Manager、Admin 或系統擁有人可以新增設計工作。"
        );
      }

      const today = getHongKongToday();
      const title = readString(formData, "title") || "未命名設計工作";
      const startDate = readString(formData, "startDate") || today;
      const dueDate = readString(formData, "dueDate");
      const priority = readString(formData, "priority") || "normal";
      const workload = readString(formData, "workload") || "M";
      const quantity = Number(readString(formData, "quantity") || 1);
      const sourceTaxonomyId = readString(formData, "sourceTaxonomyId");
      const usageTaxonomyId = readString(formData, "usageTaxonomyId");
      const mediaFormatTaxonomyId = readString(
        formData,
        "mediaFormatTaxonomyId"
      );
      const assigneeProfileId = readString(formData, "assigneeProfileId");
      const materialStatus =
        readString(formData, "materialStatus") === "waiting"
          ? "waiting"
          : "ready";

      if (
        !title ||
        title.length > 240 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
        (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) ||
        !creativePriorities.includes(priority as never) ||
        !creativeWorkloads.includes(workload as never) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 999
      ) {
        redirectWithMessage(
          "/creative-jobs",
          false,
          "請檢查 Job 名稱、日期、優先級、工作量同數量。"
        );
      }
      if (dueDate && dueDate < startDate) {
        redirectWithMessage(
          "/creative-jobs",
          false,
          "Due Day 唔可以早過 Start Day。"
        );
      }

      const config = await getConfigurationData();
      const requestedBrandId = readString(formData, "brandId");
      const brand =
        config.brands.find((item) => item.id === requestedBrandId) ??
        config.brands[0];
      if (!brand) {
        redirectWithMessage(
          "/creative-jobs",
          false,
          "你目前未獲授權管理任何品牌。"
        );
      }

      const supabase = createSupabaseAdminClient();
      const taxonomyIds = [
        sourceTaxonomyId,
        usageTaxonomyId,
        mediaFormatTaxonomyId,
      ].filter(Boolean);
      const taxonomyResult = taxonomyIds.length
        ? await supabase
            .from("creative_taxonomy_items")
            .select("id,category,name,is_active")
            .in("id", taxonomyIds)
        : { data: [], error: null };
      if (taxonomyResult.error) {
        redirectWithMessage(
          "/creative-jobs",
          false,
          "未能讀取設計分類。"
        );
      }
      const taxonomyMap = new Map(
        (taxonomyResult.data ?? []).map((item) => [String(item.id), item])
      );
      const expectedCategories = [
        [sourceTaxonomyId, "source"],
        [usageTaxonomyId, "usage"],
        [mediaFormatTaxonomyId, "media_format"],
      ] as const;
      if (
        expectedCategories.some(
          ([id, category]) =>
            id &&
            (!taxonomyMap.has(id) ||
              taxonomyMap.get(id)?.category !== category ||
              taxonomyMap.get(id)?.is_active !== true)
        )
      ) {
        redirectWithMessage(
          "/creative-jobs",
          false,
          "Source、用途或媒體格式選項無效。"
        );
      }

      if (assigneeProfileId) {
        if (title === "未命名設計工作") {
          redirectWithMessage(
            "/creative-jobs",
            false,
            "派 Job 前請先填寫清晰 Job 名稱。"
          );
        }
        if (!dueDate) {
          redirectWithMessage(
            "/creative-jobs",
            false,
            "派 Job 畀 Designer 前必須設定 Due Day。"
          );
        }
        if (!sourceTaxonomyId || !usageTaxonomyId || !mediaFormatTaxonomyId) {
          redirectWithMessage(
            "/creative-jobs",
            false,
            "派 Job 前必須分別選擇 Source、用途同媒體格式。"
          );
        }
      }

      let assigneeMemberId = "";
      let assigneeEmail = "";
      let assigneeProfileName = "";
      if (assigneeProfileId) {
        const { data: profile } = await supabase
          .from("creative_designer_profiles")
          .select("id,display_name,linked_member_id,is_active")
          .eq("id", assigneeProfileId)
          .maybeSingle();
        if (!profile || profile.is_active !== true) {
          redirectWithMessage(
            "/creative-jobs",
            false,
            "所選 Designer 已停用或不存在。"
          );
        }
        assigneeProfileName = String(profile.display_name);
        assigneeMemberId =
          typeof profile.linked_member_id === "string"
            ? profile.linked_member_id
            : "";
        if (assigneeMemberId) {
          const { data: member } = await supabase
            .from("workspace_members")
            .select("email,status")
            .eq("id", assigneeMemberId)
            .maybeSingle();
          if (member?.status === "active" || member?.status === "invited") {
            assigneeEmail = String(member.email || "");
          } else {
            assigneeMemberId = "";
          }
        }
      }

      const status = assigneeProfileId
        ? materialStatus === "waiting"
          ? "waiting_assets"
          : "assigned"
        : "draft";
      const { data, error } = await supabase
        .from("creative_jobs")
        .insert({
          brand_id: brand.id,
          title,
          status,
          priority,
          workload,
          start_date: startDate,
          due_date: dueDate || null,
          source_taxonomy_id: sourceTaxonomyId || null,
          usage_taxonomy_id: usageTaxonomyId || null,
          media_format_taxonomy_id: mediaFormatTaxonomyId || null,
          assignee_profile_id: assigneeProfileId || null,
          assignee_member_id: assigneeMemberId || null,
          material_status: materialStatus,
          quantity,
          requester_member_id: access.memberId ?? null,
          requester_email:
            access.email ||
            (access.accessLevel === "master" ? "master" : "shared_admin"),
          brief_document: {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "Campaign 目的" }],
              },
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "寫低今次內容／廣告要解決嘅問題，同埋成功標準。",
                  },
                ],
              },
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "Deliverables／輸出要求" }],
              },
              {
                type: "taskList",
                content: [
                  {
                    type: "taskItem",
                    attrs: { checked: false },
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          {
                            type: "text",
                            text: "列明數量、尺寸、片長、平台、字幕、VO 同版本要求",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "畫面及 Reference" }],
              },
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "可直接 Ctrl + V 貼 Screenshot，或者由右邊素材庫插入圖片及 Google Drive 連結。",
                  },
                ],
              },
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "必須遵守／不可出現" }],
              },
              {
                type: "bulletList",
                content: [
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          {
                            type: "text",
                            text: "價錢、CTA、Logo、合規字眼及品牌要求",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          brief_plain_text:
            "Campaign 目的\nDeliverables／輸出要求\n畫面及 Reference\n必須遵守／不可出現",
        })
        .select("id")
        .single();
      if (error || !data?.id) {
        console.warn("creative_job_draft_create_failed", {
          code: error?.code,
          message: error?.message,
        });
        redirectWithMessage(
          "/creative-jobs",
          false,
          "未能建立設計工作，請重新載入後再試。"
        );
      }

      await writeCreativeAudit({
        jobId: data.id,
        access,
        action: "creative_job.created",
        after: {
          brandId: brand.id,
          title,
          status,
          priority,
          workload,
          startDate,
          dueDate: dueDate || null,
          sourceTaxonomyId: sourceTaxonomyId || null,
          usageTaxonomyId: usageTaxonomyId || null,
          mediaFormatTaxonomyId: mediaFormatTaxonomyId || null,
          assigneeProfileId: assigneeProfileId || null,
        },
      });

      if (assigneeMemberId) {
        await queueCreativeNotification({
          recipientMemberId: assigneeMemberId,
          recipientEmail: assigneeEmail,
          brandId: brand.id,
          jobId: data.id,
          type: "creative_assigned",
          title:
            priority === "urgent"
              ? "緊急設計工作已派畀你"
              : "新設計工作已派畀你",
          body: `${title}${assigneeProfileName ? ` · ${assigneeProfileName}` : ""}`,
          dedupeKey: `creative_assigned:${data.id}:${assigneeMemberId}:${Date.now()}`,
        });
      }

      revalidateCreative(data.id);
      redirectWithMessage(
        `/creative-jobs/${data.id}`,
        true,
        assigneeProfileId && !assigneeMemberId
          ? "設計工作已建立；Designer 尚未連結個人帳戶，所以暫時唔會收到桌面通知。"
          : assigneeProfileId
            ? "設計工作已建立並派發。"
            : "設計工作草稿已建立。"
      );
    }
    '''
)


NEW_JOB_LIST = dedent(
    r'''\
                      <div data-testid="creative-job-list" className="min-w-0">
                        <div className="hidden grid-cols-[minmax(210px,1.5fr)_minmax(125px,.78fr)_minmax(140px,.85fr)_minmax(180px,1fr)_72px_96px] gap-x-3 border-b border-[#eee3dd] bg-[#fbf9f7] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.06em] text-[#806174] xl:grid">
                          <span>Job／Source</span>
                          <span>品牌／Designer</span>
                          <span>用途／格式</span>
                          <span>Start／Due／Publish</span>
                          <span>優先</span>
                          <span>狀態</span>
                        </div>
                        <div className="divide-y divide-[#f0e7e2]">
                          {snapshot.jobs.map((job) => {
                            const overdue =
                              Boolean(job.dueDate) &&
                              job.dueDate! < snapshot.today &&
                              !["completed", "cancelled"].includes(job.status);
                            return (
                              <Link
                                key={job.id}
                                href={`/creative-jobs/${job.id}`}
                                className="grid min-w-0 gap-3 px-4 py-4 text-[11px] font-semibold transition hover:bg-[#fff9fb] xl:grid-cols-[minmax(210px,1.5fr)_minmax(125px,.78fr)_minmax(140px,.85fr)_minmax(180px,1fr)_72px_96px] xl:items-center xl:gap-x-3"
                              >
                                <span className="min-w-0">
                                  <strong className="block truncate text-xs text-[#321428]">
                                    {job.title}
                                  </strong>
                                  <small className="mt-1 block text-[9px] font-bold text-[#927987]">
                                    {job.quantity} 件 · {job.workload} workload
                                    {job.materialStatus === "waiting"
                                      ? " · 等素材"
                                      : ""}
                                  </small>
                                  <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-[#f7f1f4] px-2 py-1 text-[9px] font-bold text-[#806174]">
                                    <span className="shrink-0 text-[#9a5d76]">Source</span>
                                    <span className="truncate">{job.sourceName || "未設定"}</span>
                                  </span>
                                </span>

                                <span className="min-w-0">
                                  <small className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-[#a88d99] xl:hidden">
                                    品牌／Designer
                                  </small>
                                  <strong className="block truncate text-[11px] text-[#6d4a5c]">
                                    {job.brandName}
                                  </strong>
                                  <span className="mt-1 block truncate text-[10px] text-[#806174]">
                                    {job.assigneeProfileName || "未派 Designer"}
                                  </span>
                                </span>

                                <span className="min-w-0">
                                  <small className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-[#a88d99] xl:hidden">
                                    用途／媒體格式
                                  </small>
                                  <strong className="block truncate text-[11px] text-[#4d2d40]">
                                    {job.usageName || "未設定用途"}
                                  </strong>
                                  <span className="mt-1 block truncate text-[10px] text-[#806174]">
                                    {job.mediaFormatName || "未設定格式"}
                                  </span>
                                </span>

                                <span className="min-w-0">
                                  <small className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-[#a88d99] xl:hidden">
                                    排期
                                  </small>
                                  <span className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#6d4a5c]">
                                    <span>
                                      <b className="text-[#9a5d76]">Start</b>{" "}
                                      {prettyDate(job.startDate)}
                                    </span>
                                    <span aria-hidden="true" className="text-[#b9a8b1]">
                                      →
                                    </span>
                                    <span className={overdue ? "font-black text-[#a43b50]" : ""}>
                                      <b>Due</b> {prettyDate(job.dueDate)}
                                    </span>
                                  </span>
                                  <span className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-[#927987]">
                                    {job.syncCalendar ? (
                                      <>
                                        <CalendarCheck2 size={11} /> Publish {prettyDate(job.publishDate)}
                                      </>
                                    ) : (
                                      "未同步日曆"
                                    )}
                                  </span>
                                </span>

                                <span>
                                  <small className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-[#a88d99] xl:hidden">
                                    優先級
                                  </small>
                                  <PriorityBadge value={job.priority} />
                                </span>

                                <span>
                                  <small className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-[#a88d99] xl:hidden">
                                    狀態
                                  </small>
                                  <StatusBadge status={job.status} />
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
    '''
)


FIXTURE_LIST = dedent(
    r'''\
        <div className="mt-4 flex justify-end">
          <CreativeJobHeaderActions
            canCreate
            canManageSettings={false}
            today="2026-09-01"
            defaultBrandId="fixture-brand"
            brands={[
              {
                id: "fixture-brand",
                name: "GOS",
                slug: "gos",
                primaryColor: "#f27a23",
                secondaryColor: "#fff7ed",
                whatsappNumber: null,
                defaultThankYouUrl: null,
              },
            ]}
            designers={[
              {
                id: "fixture-designer",
                displayName: "Amber",
                linkedMemberId: null,
                linkedMemberName: null,
                linkedMemberEmail: null,
                isActive: true,
                sortOrder: 10,
              },
            ]}
            taxonomies={[
              {
                id: "fixture-source",
                category: "source",
                name: "KOL 拍攝",
                isActive: true,
                sortOrder: 10,
              },
              {
                id: "fixture-usage",
                category: "usage",
                name: "Meta AD",
                isActive: true,
                sortOrder: 10,
              },
              {
                id: "fixture-format",
                category: "media_format",
                name: "Video",
                isActive: true,
                sortOrder: 10,
              },
            ]}
          />
        </div>

        <section
          className="mt-6 overflow-hidden rounded-2xl border border-[#e8dcd5] bg-white"
          data-testid="creative-job-list-fixture"
        >
          <div className="hidden grid-cols-[1.5fr_.78fr_.85fr_1fr_72px_96px] gap-3 border-b border-[#eadfd9] bg-[#fbf9f7] px-4 py-3 text-[10px] font-black xl:grid">
            <span>Job／Source</span>
            <span>品牌／Designer</span>
            <span>用途／格式</span>
            <span>Start／Due／Publish</span>
            <span>優先</span>
            <span>狀態</span>
          </div>
          <div className="grid min-w-0 gap-3 px-4 py-4 text-[11px] font-semibold xl:grid-cols-[1.5fr_.78fr_.85fr_1fr_72px_96px] xl:items-center">
            <span className="min-w-0">
              <strong className="block truncate">GOS KOL 脫毛廣告片</strong>
              <small className="mt-1 block">1 件 · M workload</small>
              <span className="mt-2 block truncate">Source · KOL 拍攝</span>
            </span>
            <span>
              <strong className="block">GOS</strong>
              <span className="block">Amber</span>
            </span>
            <span>
              <strong className="block">Meta AD</strong>
              <span className="block">Video</span>
            </span>
            <span>
              <strong className="block">Start 1/9 → Due 4/9</strong>
              <span className="block">Publish 6/9</span>
            </span>
            <span>優先</span>
            <span>製作中</span>
          </div>
        </section>
    '''
)


def patch_header_actions() -> None:
    write(
        "src/components/creative/CreativeJobHeaderActions.tsx",
        HEADER_ACTIONS_COMPONENT,
    )
    write(
        "src/components/creative/CreativeJobHeaderActions.module.css",
        HEADER_ACTIONS_CSS,
    )


def patch_create_action() -> None:
    path = "src/app/creative-jobs/actions.ts"
    text = read(path)
    pattern = (
        r"export async function createCreativeDraftAction\(formData: FormData\) \{"
        r"[\s\S]*?\n\}\n\nexport async function updateCreativeJobAction"
    )
    replacement = NEW_CREATE_ACTION.rstrip() + "\n\nexport async function updateCreativeJobAction"
    text, count = re.subn(pattern, replacement, text, count=1)
    if count != 1 and "設計工作已建立並派發" not in text:
        raise SystemExit("Unable to replace createCreativeDraftAction")
    write(path, text)


def patch_list_page() -> None:
    path = "src/app/creative-jobs/page.tsx"
    text = read(path)
    text = text.replace('import type { ReactNode } from "react";\n', "", 1)
    for line in [
        "  ListFilter,\n",
        "  Plus,\n",
        "  Settings2,\n",
        "  UserRound,\n",
    ]:
        text = text.replace(line, "", 1)
    text = text.replace(
        'import { DesktopNotificationControl } from "@/components/command-center/DesktopNotificationControl";\n',
        'import { CreativeJobHeaderActions } from "@/components/creative/CreativeJobHeaderActions";\n',
        1,
    )
    text = text.replace('import { createCreativeDraftAction } from "./actions";\n', "", 1)

    header_pattern = re.compile(
        r'''            <div className="flex flex-wrap items-center gap-2">[\s\S]*?            </div>\n          </header>'''
    )
    header_replacement = dedent(
        '''\
                <CreativeJobHeaderActions
                  canCreate={snapshot.canCreate}
                  canManageSettings={snapshot.canManageSettings}
                  brands={snapshot.brands}
                  designers={snapshot.designers}
                  taxonomies={snapshot.taxonomies}
                  today={snapshot.today}
                  defaultBrandId={filters.brandId || snapshot.brands[0]?.id || ""}
                />
              </header>'''
    )
    text, count = header_pattern.subn(header_replacement, text, count=1)
    if count != 1 and "<CreativeJobHeaderActions" not in text:
        raise SystemExit("Unable to replace Creative Jobs header actions")

    text = text.replace(
        "同日工作先按緊急／優先排序，再按 Start Day 及 Due Day 排列。",
        "先按 Start Day；同日再按緊急／優先排序，最後按 Due Day。",
        1,
    )
    text = text.replace(
        '<section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">\n                <div className="min-w-0">',
        '<section className="mt-4">\n                <div className="min-w-0">',
        1,
    )

    list_pattern = re.compile(
        r'''                    \{snapshot\.jobs\.length \? \(\n                      <div className="overflow-x-auto">[\s\S]*?                      </div>\n                    \) : \('''
    )
    list_replacement = (
        "                    {snapshot.jobs.length ? (\n"
        + NEW_JOB_LIST.rstrip()
        + "\n                    ) : ("
    )
    text, count = list_pattern.subn(list_replacement, text, count=1)
    if count != 1 and 'data-testid="creative-job-list"' not in text:
        raise SystemExit("Unable to replace horizontally scrolling Job List")

    aside_pattern = re.compile(
        r'''\n                <aside className="grid h-fit gap-4 xl:sticky xl:top-5">[\s\S]*?\n                </aside>'''
    )
    text, count = aside_pattern.subn("", text, count=1)
    if count != 1 and "派 Job 規則" in text:
        raise SystemExit("Unable to remove persistent Creative Jobs help rail")

    text = re.sub(r"\nfunction Rule\([\s\S]*\Z", "\n", text, count=1)
    write(path, text)


def patch_sidebar() -> None:
    path = "src/components/alyssa/AppNavClient.tsx"
    text = read(path)
    text = replace_once(
        text,
        'import { useState, type ComponentType } from "react";',
        'import { useEffect, useState, type ComponentType } from "react";',
        "sidebar React hooks",
    )
    text = replace_once(
        text,
        "  Palette,\n  Settings2,",
        "  Palette,\n  PanelLeftClose,\n  PanelLeftOpen,\n  Settings2,",
        "sidebar collapse icons",
    )
    text = replace_once(
        text,
        'import { IntentPrefetchLink } from "@/components/alyssa/IntentPrefetchLink";\n',
        'import { IntentPrefetchLink } from "@/components/alyssa/IntentPrefetchLink";\nimport styles from "./AppNavClient.module.css";\n',
        "sidebar CSS module import",
    )

    nav_item_pattern = r"function NavItem\([\s\S]*?\n\}\n\nfunction SidebarContent"
    nav_item_replacement = dedent(
        '''\
        function NavItem({
          item,
          pathname,
          onNavigate,
          collapsed,
        }: {
          item: NavigationItem;
          pathname: string;
          onNavigate: () => void;
          collapsed: boolean;
        }) {
          const active = isActive(pathname, item);
          const IconComponent = item.icon;

          return (
            <IntentPrefetchLink
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              className={`command-nav-item ${active ? "is-active" : ""}`}
            >
              <IconComponent size={18} strokeWidth={active ? 2.4 : 1.9} />
              <span>{item.label}</span>
              {item.badge ? <span className="command-nav-badge">{item.badge}</span> : null}
              {active ? <ChevronRight className="ml-auto" size={15} /> : null}
            </IntentPrefetchLink>
          );
        }

        function SidebarContent'''
    )
    text, count = re.subn(
        nav_item_pattern,
        nav_item_replacement,
        text,
        count=1,
        flags=re.S,
    )
    if count != 1 and "collapsed: boolean;" not in text:
        raise SystemExit("Unable to replace NavItem for collapsed sidebar")

    text = replace_once(
        text,
        "  creativeNotificationCount,\n}: {",
        "  creativeNotificationCount,\n  collapsed,\n  onToggleCollapse,\n}: {",
        "SidebarContent parameters",
    )
    text = replace_once(
        text,
        "  creativeNotificationCount: number;\n}) {",
        "  creativeNotificationCount: number;\n  collapsed: boolean;\n  onToggleCollapse: () => void;\n}) {",
        "SidebarContent parameter types",
    )

    old_brand = dedent(
        '''\
          <div className="command-brand">
            <IntentPrefetchLink
              href="/dashboard"
              onClick={onNavigate}
              className="command-brand-link"
            >
              <span className="command-brand-mark" aria-hidden="true">
                GO
              </span>
              <span className="min-w-0">
                <span className="command-brand-eyebrow">Alyssa Growth OS</span>
                <span className="command-brand-title">營運中心</span>
              </span>
            </IntentPrefetchLink>
          </div>'''
    )
    new_brand = dedent(
        '''\
          <div className="command-brand">
            <IntentPrefetchLink
              href="/dashboard"
              onClick={onNavigate}
              className="command-brand-link"
              aria-label={collapsed ? "Alyssa Growth OS 營運中心" : undefined}
              title={collapsed ? "Alyssa Growth OS 營運中心" : undefined}
            >
              <span className="command-brand-mark" aria-hidden="true">
                GO
              </span>
              <span className="min-w-0">
                <span className="command-brand-eyebrow">Alyssa Growth OS</span>
                <span className="command-brand-title">營運中心</span>
              </span>
            </IntentPrefetchLink>
            <button
              type="button"
              className={styles.collapseButton}
              onClick={onToggleCollapse}
              aria-label={collapsed ? "展開主功能欄" : "收起主功能欄"}
              title={collapsed ? "展開主功能欄" : "收起主功能欄"}
            >
              {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </button>
          </div>'''
    )
    text = replace_once(text, old_brand, new_brand, "sidebar brand and collapse button")
    text = replace_once(
        text,
        "                  onNavigate={onNavigate}\n                />",
        "                  onNavigate={onNavigate}\n                  collapsed={collapsed}\n                />",
        "collapsed NavItem prop",
    )

    text = replace_once(
        text,
        "  const pathname = usePathname();\n  const [open, setOpen] = useState(false);",
        dedent(
            '''\
              const pathname = usePathname();
              const [open, setOpen] = useState(false);
              const [collapsed, setCollapsed] = useState(false);

              useEffect(() => {
                if (window.localStorage.getItem("alyssa-command-sidebar-collapsed") === "1") {
                  setCollapsed(true);
                }
              }, []);

              useEffect(() => {
                document.documentElement.classList.toggle(
                  "command-sidebar-collapsed",
                  collapsed
                );
                window.localStorage.setItem(
                  "alyssa-command-sidebar-collapsed",
                  collapsed ? "1" : "0"
                );
              }, [collapsed]);'''
        ).rstrip(),
        "desktop sidebar collapse state",
    )
    text = replace_once(
        text,
        '<aside className={`command-sidebar ${open ? "is-open" : ""}`}>',
        '<aside\n        className={`${styles.sidebarHost} command-sidebar ${open ? "is-open" : ""}`}\n        data-collapsed={collapsed ? "true" : "false"}\n      >',
        "sidebar host class",
    )
    text = replace_once(
        text,
        "          creativeNotificationCount={creativeNotificationCount}\n        />",
        "          creativeNotificationCount={creativeNotificationCount}\n          collapsed={collapsed}\n          onToggleCollapse={() => setCollapsed((current) => !current)}\n        />",
        "sidebar collapse props",
    )
    write(path, text)
    write("src/components/alyssa/AppNavClient.module.css", SIDEBAR_CSS)


def patch_fixture() -> None:
    path = "src/components/creative/CreativeProductionFixture.tsx"
    text = read(path)
    text = replace_once(
        text,
        'import { useRef } from "react";\n',
        'import { useRef } from "react";\nimport { CreativeJobHeaderActions } from "@/components/creative/CreativeJobHeaderActions";\n',
        "fixture header actions import",
    )
    pattern = re.compile(
        r'''        <section className="mt-6 overflow-hidden rounded-2xl border border\[#e8dcd5\] bg-white" data-testid="creative-job-list-fixture">[\s\S]*?        </section>\n\n        <section className="mt-6" data-testid="creative-rich-brief-fixture">'''
    )
    replacement = (
        FIXTURE_LIST.rstrip()
        + '\n\n        <section className="mt-6" data-testid="creative-rich-brief-fixture">'
    )
    text, count = pattern.subn(replacement, text, count=1)
    if count != 1 and "CreativeJobHeaderActions" not in text.split("export function", 1)[1]:
        raise SystemExit("Unable to replace Creative Production fixture list")
    write(path, text)


def patch_tests() -> None:
    path = "e2e/creative-production.spec.ts"
    text = read(path)
    if "fits the available width without horizontal scrolling" not in text:
        marker = dedent(
            '''\
            test("rich Brief supports long-form editing, headings and checklist content", async ({
              page,
            }) => {'''
        )
        additions = dedent(
            '''\
            test("creative Job List fits the available width without horizontal scrolling", async ({
              page,
            }) => {
              await page.setViewportSize({ width: 1280, height: 900 });
              await openFixture(page);
              const list = page.getByTestId("creative-job-list-fixture");
              const widths = await list.evaluate((element) => ({
                client: element.clientWidth,
                scroll: element.scrollWidth,
              }));
              expect(widths.scroll).toBeLessThanOrEqual(widths.client);
            });

            test("new Job and operating guidance open as in-app sheets", async ({ page }) => {
              await openFixture(page);
              const originalUrl = page.url();

              await page.getByRole("button", { name: "新增設計 Job" }).click();
              const createDialog = page.getByRole("dialog", { name: "新增設計 Job" });
              await expect(createDialog).toBeVisible();
              await expect(createDialog.getByLabel("Job 名稱")).toBeVisible();
              await expect(createDialog.getByLabel("Designer")).toBeVisible();
              expect(page.url()).toBe(originalUrl);
              await createDialog
                .getByRole("button", { name: "關閉新增設計 Job" })
                .click();
              await expect(createDialog).toBeHidden();

              await page.getByRole("button", { name: "操作指引" }).click();
              const guideDialog = page.getByRole("dialog", {
                name: "設計工作指引",
              });
              await expect(guideDialog).toBeVisible();
              await expect(guideDialog).toContainText("Start Day");
              await expect(guideDialog).toContainText("Due Day");
              await expect(guideDialog).toContainText("Publish Day");
              await expect(
                guideDialog.getByTestId("desktop-notification-control")
              ).toBeVisible();
            });

            test("desktop primary navigation can collapse and restore", async ({ page }) => {
              await page.addInitScript(() => {
                window.localStorage.removeItem("alyssa-command-sidebar-collapsed");
              });
              await page.setViewportSize({ width: 1440, height: 900 });
              await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

              const sidebar = page.locator(".command-sidebar");
              const before = await sidebar.evaluate((element) => element.clientWidth);
              await page.getByRole("button", { name: "收起主功能欄" }).click();
              await expect(page.locator("html")).toHaveClass(/command-sidebar-collapsed/);
              await expect(page.getByRole("button", { name: "展開主功能欄" })).toBeVisible();
              const after = await sidebar.evaluate((element) => element.clientWidth);
              expect(after).toBeLessThan(before);

              await page.getByRole("button", { name: "展開主功能欄" }).click();
              await expect(page.locator("html")).not.toHaveClass(/command-sidebar-collapsed/);
            });

            test("rich Brief supports long-form editing, headings and checklist content", async ({
              page,
            }) => {'''
        )
        if marker not in text:
            raise SystemExit("Creative test insertion marker missing")
        text = text.replace(marker, additions, 1)
    write(path, text)


def patch_contract() -> None:
    path = "scripts/verify-creative-production-contract.mjs"
    text = read(path)
    text = replace_once(
        text,
        'const listPage = read("src/app/creative-jobs/page.tsx");\n',
        'const listPage = read("src/app/creative-jobs/page.tsx");\nconst headerActions = read("src/components/creative/CreativeJobHeaderActions.tsx");\nconst sidebarCss = read("src/components/alyssa/AppNavClient.module.css");\n',
        "creative UX contract reads",
    )
    marker = 'assert.match(listPage, /Designer/);\n'
    additions = dedent(
        '''\
        assert.match(listPage, /Designer/);
        assert.doesNotMatch(listPage, /overflow-x-auto/);
        assert.doesNotMatch(listPage, /min-w-\[1320px\]/);
        assert.match(listPage, /data-testid="creative-job-list"/);
        assert.match(headerActions, /showModal\(\)/);
        assert.match(headerActions, /新增設計 Job/);
        assert.match(headerActions, /操作指引/);
        assert.match(headerActions, /DesktopNotificationControl/);
        assert.match(actions, /設計工作已建立並派發/);
        assert.match(nav, /command-sidebar-collapsed/);
        assert.match(nav, /收起主功能欄/);
        assert.match(sidebarCss, /--command-sidebar-width: 76px/);
        '''
    )
    text = replace_once(text, marker, additions, "creative UX contract assertions")
    write(path, text)


def cleanup_bootstrap_files() -> None:
    for path in [
        "scripts/creative-list-ux-refinement.py",
        ".github/workflows/one-shot-creative-list-ux-refinement.yml",
    ]:
        file = Path(path)
        if file.exists():
            file.unlink()


patch_header_actions()
patch_create_action()
patch_list_page()
patch_sidebar()
patch_fixture()
patch_tests()
patch_contract()
cleanup_bootstrap_files()
print("Creative Jobs list, guidance, create sheet and collapsible navigation refined.")
