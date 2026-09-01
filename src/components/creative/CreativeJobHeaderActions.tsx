    "use client";

    import Link from "next/link";
    import {
  useRef,
  useState,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
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

    function openDialog(ref: RefObject<HTMLDialogElement | null>) {
      if (!ref.current?.open) ref.current?.showModal();
    }

    function closeDialog(ref: RefObject<HTMLDialogElement | null>) {
      if (ref.current?.open) ref.current.close();
    }

    function closeOnBackdrop(
      event: MouseEvent<HTMLDialogElement>,
      ref: RefObject<HTMLDialogElement | null>
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
