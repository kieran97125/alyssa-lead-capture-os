"use client";

import { Trash2, TriangleAlert, X } from "lucide-react";
import { useRef } from "react";
import { SubmitButton } from "@/components/alyssa/SubmitButton";

type DeleteDataSourceButtonProps = {
  dataSourceId: string;
  displayName: string;
  action: (formData: FormData) => Promise<void>;
};

export function DeleteDataSourceButton({
  dataSourceId,
  displayName,
  action,
}: DeleteDataSourceButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openDialog() {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        className="source-delete-button"
        onClick={openDialog}
        aria-label={`刪除 ${displayName}`}
      >
        <Trash2 size={13} />
        刪除
      </button>

      <dialog
        ref={dialogRef}
        className="source-delete-dialog"
        aria-labelledby={`delete-source-title-${dataSourceId}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <form action={action} className="source-delete-dialog-card">
          <input type="hidden" name="dataSourceId" value={dataSourceId} />
          <header>
            <span>
              <TriangleAlert size={19} />
            </span>
            <button
              type="button"
              onClick={closeDialog}
              aria-label="關閉刪除確認"
            >
              <X size={17} />
            </button>
          </header>
          <div>
            <p>Delete data source</p>
            <h2 id={`delete-source-title-${dataSourceId}`}>確認刪除資料來源？</h2>
            <strong>{displayName}</strong>
            <span>
              來源設定及由佢同步產生嘅彙總會一併刪除；呢個動作唔可以喺畫面復原。
            </span>
          </div>
          <footer>
            <button type="button" onClick={closeDialog}>
              取消
            </button>
            <SubmitButton pendingLabel="刪除中…">
              <Trash2 size={14} />
              確認刪除
            </SubmitButton>
          </footer>
        </form>
      </dialog>
    </>
  );
}
