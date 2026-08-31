"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import FileHandler from "@tiptap/extension-file-handler";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Check,
  Cloud,
  CloudOff,
  Eraser,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Save,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from "lucide-react";
import type { CreativeAsset } from "@/lib/creative/types";
import styles from "./CreativeBriefEditor.module.css";

export type CreativeBriefEditorHandle = {
  insertAsset: (asset: CreativeAsset) => void;
  focus: () => void;
  saveVersion: () => Promise<void>;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type UploadedAssetResponse = {
  ok?: boolean;
  asset?: CreativeAsset;
  error?: string;
};

const allowedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

function isImageAsset(asset: CreativeAsset) {
  return Boolean(
    asset.mimeType?.startsWith("image/") ||
      /\.(?:jpe?g|png|webp|gif)(?:\?.*)?$/i.test(asset.url)
  );
}

function saveStateCopy(state: SaveState, savedAt: string | null) {
  if (state === "dirty") return "有未儲存改動";
  if (state === "saving") return "自動儲存中…";
  if (state === "error") return "儲存失敗，請再試";
  if (state === "saved") {
    return savedAt ? `已儲存 ${savedAt}` : "已儲存";
  }
  return "修改會自動儲存";
}

export const CreativeBriefEditor = forwardRef<
  CreativeBriefEditorHandle,
  {
    jobId: string;
    initialDocument: Record<string, unknown>;
    editable: boolean;
    onAssetCreated?: (asset: CreativeAsset) => void;
    persistenceEnabled?: boolean;
  }
>(function CreativeBriefEditor(
  {
    jobId,
    initialDocument,
    editable,
    onAssetCreated,
    persistenceEnabled = true,
  },
  ref
) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDocumentRef = useRef<JSONContent>(
    initialDocument as JSONContent
  );
  const latestPlainTextRef = useRef("");

  const saveBrief = useCallback(
    async (createVersion = false) => {
      if (!persistenceEnabled || !editable) {
        setSaveState("saved");
        setSavedAt(
          new Intl.DateTimeFormat("zh-HK", {
            timeZone: "Asia/Hong_Kong",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date())
        );
        return;
      }
      setSaveState("saving");
      try {
        const response = await fetch(`/api/creative-jobs/${jobId}/brief`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: latestDocumentRef.current,
            plainText: latestPlainTextRef.current,
            createVersion,
          }),
        });
        if (!response.ok) throw new Error("brief_save_failed");
        setSaveState("saved");
        setSavedAt(
          new Intl.DateTimeFormat("zh-HK", {
            timeZone: "Asia/Hong_Kong",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date())
        );
      } catch {
        setSaveState("error");
      }
    },
    [editable, jobId, persistenceEnabled]
  );

  const scheduleSave = useCallback(() => {
    if (!editable) return;
    setSaveState("dirty");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveBrief(false);
    }, 850);
  }, [editable, saveBrief]);

  const uploadImage = useCallback(
    async (file: File) => {
      if (!allowedImageTypes.includes(file.type)) {
        throw new Error("unsupported_image");
      }
      if (file.size > 25 * 1024 * 1024) {
        throw new Error("image_too_large");
      }
      const formData = new FormData();
      formData.set("file", file);
      formData.set("purpose", "brief");
      formData.set("label", file.name || "Brief image");
      const response = await fetch(`/api/creative-jobs/${jobId}/assets`, {
        method: "POST",
        body: formData,
      });
      const result = (await response
        .json()
        .catch(() => ({}))) as UploadedAssetResponse;
      if (!response.ok || !result.asset) {
        throw new Error(result.error || "upload_failed");
      }
      onAssetCreated?.(result.asset);
      return result.asset;
    },
    [jobId, onAssetCreated]
  );

  const insertFiles = useCallback(
    async (
      currentEditor: NonNullable<ReturnType<typeof useEditor>>,
      files: File[],
      position?: number
    ) => {
      const images = files.filter((file) => allowedImageTypes.includes(file.type));
      if (images.length === 0) return;
      setUploading(true);
      try {
        let offset = position;
        for (const file of images) {
          const asset = await uploadImage(file);
          const node = {
            type: "image",
            attrs: {
              src: asset.url,
              alt: asset.label,
              title: asset.label,
            },
          };
          if (typeof offset === "number") {
            currentEditor.commands.insertContentAt(offset, node);
            offset += 1;
          } else {
            currentEditor.chain().focus().setImage(node.attrs).run();
          }
        }
      } finally {
        setUploading(false);
      }
    },
    [uploadImage]
  );

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: !editable,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          loading: "lazy",
          referrerpolicy: "no-referrer",
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder:
          "由呢度開始寫完整 Brief。可以貼長文、標題、Checklist、Google Drive 連結，亦可以直接 Ctrl + V 貼圖或拖圖片入嚟。",
      }),
      FileHandler.configure({
        allowedMimeTypes: allowedImageTypes,
        onDrop: (currentEditor, files, position) => {
          void insertFiles(currentEditor, files, position);
        },
        onPaste: (currentEditor, files) => {
          void insertFiles(currentEditor, files);
        },
      }),
    ],
    [editable, insertFiles]
  );

  const editor = useEditor({
    extensions,
    content: initialDocument as JSONContent,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "Creative Brief Workspace",
        spellcheck: "true",
      },
    },
    onCreate: ({ editor: currentEditor }) => {
      latestDocumentRef.current = currentEditor.getJSON();
      latestPlainTextRef.current = currentEditor.getText({ blockSeparator: "\n" });
    },
    onUpdate: ({ editor: currentEditor }) => {
      latestDocumentRef.current = currentEditor.getJSON();
      latestPlainTextRef.current = currentEditor.getText({ blockSeparator: "\n" });
      scheduleSave();
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  const insertAsset = useCallback(
    (asset: CreativeAsset) => {
      if (!editor || !editable) return;
      if (isImageAsset(asset)) {
        editor
          .chain()
          .focus()
          .setImage({ src: asset.url, alt: asset.label, title: asset.label })
          .run();
        return;
      }
      editor
        .chain()
        .focus()
        .insertContent({
          type: "paragraph",
          content: [
            {
              type: "text",
              text: `📎 ${asset.label}`,
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: asset.url,
                    target: "_blank",
                    rel: "noopener noreferrer nofollow",
                  },
                },
              ],
            },
          ],
        })
        .run();
    },
    [editable, editor]
  );

  useImperativeHandle(
    ref,
    () => ({
      insertAsset,
      focus: () => editor?.commands.focus(),
      saveVersion: () => saveBrief(true),
    }),
    [editor, insertAsset, saveBrief]
  );

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("貼上完整連結", previous || "https://");
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    try {
      const parsed = new URL(href.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) return;
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: parsed.toString(), target: "_blank" })
        .run();
    } catch {
      window.alert("請輸入完整有效連結，例如 https://drive.google.com/...");
    }
  }

  async function handleFileInput(files: FileList | null) {
    if (!editor || !files?.length) return;
    await insertFiles(editor, Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!editor) {
    return (
      <div className={styles.shell} aria-busy="true">
        <div className={styles.toolbar}>載入 Brief Workspace…</div>
      </div>
    );
  }

  return (
    <div className={styles.shell} data-testid="creative-brief-workspace">
      {editable ? (
        <div className={styles.toolbar} role="toolbar" aria-label="Brief 編輯工具">
          <div className={styles.toolbarGroup}>
            <ToolbarButton
              label="標題 2"
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="標題 3"
              active={editor.isActive("heading", { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              <Heading3 size={15} />
            </ToolbarButton>
          </div>
          <div className={styles.toolbarGroup}>
            <ToolbarButton
              label="粗體"
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="斜體"
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="底線"
              active={editor.isActive("underline")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="清除格式"
              onClick={() =>
                editor.chain().focus().unsetAllMarks().clearNodes().run()
              }
            >
              <Eraser size={15} />
            </ToolbarButton>
          </div>
          <div className={styles.toolbarGroup}>
            <ToolbarButton
              label="項目列表"
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="編號列表"
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="Checklist"
              active={editor.isActive("taskList")}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
            >
              <ListChecks size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="重點引用"
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="分隔線"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
            >
              <Minus size={15} />
            </ToolbarButton>
          </div>
          <div className={styles.toolbarGroup}>
            <ToolbarButton
              label="加入連結"
              active={editor.isActive("link")}
              onClick={setLink}
            >
              <Link2 size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="移除連結"
              disabled={!editor.isActive("link")}
              onClick={() => editor.chain().focus().unsetLink().run()}
            >
              <Unlink size={15} />
            </ToolbarButton>
            <ToolbarButton
              label={uploading ? "上載中…" : "貼入圖片"}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={15} />
            </ToolbarButton>
            <input
              ref={fileInputRef}
              type="file"
              accept={allowedImageTypes.join(",")}
              multiple
              hidden
              onChange={(event) => void handleFileInput(event.target.files)}
            />
          </div>
          <div className={styles.toolbarGroup}>
            <ToolbarButton
              label="復原"
              disabled={!editor.can().chain().focus().undo().run()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="重做"
              disabled={!editor.can().chain().focus().redo().run()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="儲存版本"
              onClick={() => void saveBrief(true)}
            >
              <Save size={15} />
            </ToolbarButton>
          </div>
          <span className={styles.saveStatus} data-state={saveState} aria-live="polite">
            {saveState === "error" ? (
              <CloudOff size={14} />
            ) : saveState === "saved" ? (
              <Check size={14} />
            ) : (
              <Cloud size={14} />
            )}
            {uploading ? "圖片上載中…" : saveStateCopy(saveState, savedAt)}
          </span>
        </div>
      ) : (
        <div className={styles.readOnlyBanner}>
          Marketer Brief 為唯讀；Designer 可以喺右邊素材庫交 Draft／Final，同埋留言提出問題。
        </div>
      )}

      <div className={styles.editorViewport}>
        <div className={styles.editorCanvas}>
          <EditorContent editor={editor} />
        </div>
        {editable ? (
          <div className={styles.dropHint}>
            <ImagePlus size={14} />
            可直接 Ctrl + V 貼 Screenshot，或將圖片拖入 Brief 任意位置；圖片會安全儲存到 Job 素材庫。
          </div>
        ) : null}
      </div>
    </div>
  );
});

function ToolbarButton({
  children,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.toolButton}
      aria-label={label}
      title={label}
      data-active={active ? "true" : "false"}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
