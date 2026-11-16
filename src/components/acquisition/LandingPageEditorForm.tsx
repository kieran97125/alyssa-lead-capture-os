"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Save, Eye, Upload } from "lucide-react";
import { SystemButton } from "@/components/system/SystemButton";
import { SystemConfirmationDialog } from "@/components/system/SystemConfirmationDialog";

type Result = void | { ok: false; message: string };
type EditorAction = (data: FormData) => Promise<Result>;

function fingerprint(data: FormData) {
  return JSON.stringify([...data.entries()].filter(([key]) => key !== "requestId" && key !== "editorIntent"));
}

export function LandingPageEditorForm({ children, saveAction, previewAction, publishAction, disabled = false, published = false }: {
  children: ReactNode;
  saveAction: EditorAction;
  previewAction: EditorAction;
  publishAction: EditorAction;
  disabled?: boolean;
  published?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const initial = useRef<string | null>(null);
  const attempted = useRef<string | null>(null);
  const requestId = useRef<string | null>(null);
  const submitting = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [state, action, pending] = useActionState(async (_: Result, data: FormData): Promise<Result> => {
    const intent = String(data.get("editorIntent") || "save");
    const handler = intent === "publish" ? publishAction : intent === "preview" ? previewAction : saveAction;
    try {
      // Successful redirects propagate; routine failures return without resetting inputs.
      return await handler(data);
    } catch (cause) {
      if (cause && typeof cause === "object" && "digest" in cause && String(cause.digest).startsWith("NEXT_REDIRECT")) throw cause;
      return { ok: false, message: "暫時未能儲存，請再試一次。" };
    } finally {
      submitting.current = false;
    }
  }, undefined);

  function currentFingerprint() {
    return formRef.current ? fingerprint(new FormData(formRef.current)) : "";
  }

  function checkDirty() {
    queueMicrotask(() => setDirty(initial.current !== currentFingerprint()));
  }

  useEffect(() => {
    initial.current = currentFingerprint();
    const guardUnload = (event: BeforeUnloadEvent) => {
      if (initial.current !== currentFingerprint() && !submitting.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const guardNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || submitting.current || initial.current === currentFingerprint()) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.href, window.location.href);
      if (target.origin !== window.location.origin || (target.pathname === window.location.pathname && target.search === window.location.search)) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveHref(target.href);
    };
    window.addEventListener("beforeunload", guardUnload);
    document.addEventListener("click", guardNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", guardUnload);
      document.removeEventListener("click", guardNavigation, true);
    };
  }, []);

  return <>
    <form ref={formRef} id="landing-page-editor-form" action={action} onChangeCapture={checkDirty} onClickCapture={checkDirty}
      onSubmit={event => {
        event.preventDefault();
        if (pending || disabled || submitting.current) return;
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(event.currentTarget, submitter instanceof HTMLButtonElement ? submitter : undefined);
        const command = `${String(data.get("editorIntent") || "save")}:${fingerprint(data)}`;
        if (attempted.current && attempted.current !== command) requestId.current = crypto.randomUUID();
        requestId.current ??= String(data.get("requestId") || crypto.randomUUID());
        data.set("requestId", requestId.current);
        attempted.current = command;
        setPublishOpen(false);
        submitting.current = true;
        // Manual dispatch preserves uncontrolled fields after a rejected server save.
        startTransition(() => action(data));
      }} className="grid min-w-0 gap-6" data-testid="landing-page-editor-form">
      <fieldset disabled={pending || disabled} className="contents">
        {children}
        <div className="sticky bottom-3 z-20 rounded-[var(--radius-panel)] border border-system-border bg-system-card/95 p-4 shadow-[var(--shadow-overlay)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p aria-live="polite" className="text-sm text-system-muted-foreground">{pending ? "正在儲存，請稍候…" : dirty ? "有未儲存的修改" : "內容已載入"}</p>
            <div className="flex flex-wrap gap-2">
              <SystemButton type="submit" name="editorIntent" value="save" variant="outline" disabled={pending || disabled}><Save size={16} aria-hidden />儲存草稿</SystemButton>
              <SystemButton type="submit" name="editorIntent" value="preview" variant="secondary" disabled={pending || disabled}><Eye size={16} aria-hidden />儲存並預覽</SystemButton>
              <SystemConfirmationDialog triggerLabel={published ? "更新公開頁" : "發布廣告頁"} triggerIcon={<Upload size={16} aria-hidden />} triggerVariant="default" triggerSize="default"
                open={publishOpen} onOpenChange={setPublishOpen}
                title={published ? "更新客人看到的內容？" : "發布這個廣告頁？"} description="會先儲存目前內容，再更新公開頁。請確認優惠、圖片及登記表格正確。"
                confirmControl={<SystemButton type="submit" form="landing-page-editor-form" name="editorIntent" value="publish" disabled={pending || disabled}>{published ? "確認更新" : "確認發布"}</SystemButton>} />
            </div>
          </div>
          {state && !state.ok ? <p role="alert" className="mt-3 text-sm font-semibold text-system-destructive">{state.message} 你輸入的內容仍然保留。</p> : null}
        </div>
      </fieldset>
    </form>
    <SystemConfirmationDialog triggerLabel="離開編輯" showTrigger={false} open={leaveHref !== null} onOpenChange={open => { if (!open) setLeaveHref(null); }}
      title="離開並捨棄未儲存的修改？" description="這個廣告頁有修改尚未儲存。你可以留低繼續編輯，或者離開。" cancelLabel="繼續編輯"
      confirmControl={<SystemButton variant="destructive" onClick={() => { if (leaveHref) { submitting.current = true; window.location.assign(leaveHref); } }}>離開並捨棄修改</SystemButton>} />
  </>;
}
