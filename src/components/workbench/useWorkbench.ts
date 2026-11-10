"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateWorkbenchDocument, type WorkbenchDocument, type WorkbenchRecord } from "@/lib/workbench/model";

export function useWorkbench(initial?: WorkbenchRecord, fixture = false, ownerScope?: string) {
  const [document, setDocument] = useState<WorkbenchDocument | null>(initial?.document ?? null);
  const [revision, setRevision] = useState(initial?.revision ?? 0);
  const [updatedAt, setUpdatedAt] = useState(initial?.updatedAt ?? "");
  const [state, setState] = useState<"loading" | "saved" | "pending" | "saving" | "error" | "conflict">(initial ? "saved" : "loading");
  const [error, setError] = useState("");
  const [undoCount, setUndoCount] = useState(0);
  const docRef = useRef(document); const revRef = useRef(revision);
  const queue = useRef<WorkbenchDocument | null>(null); const busy = useRef(false);
  const conflict = useRef(false); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const history = useRef<WorkbenchDocument[]>([]);
  const mounted = useRef(false); const writer = useRef<string | null>(null);
  if (!writer.current) writer.current = crypto.randomUUID();
  const fixtureKey = `alyssa-workbench-fixture-v1:${initial?.updatedAt ?? "default"}`;
  const draftKey = fixture ? `${fixtureKey}:pending` : ownerScope ? `alyssa-workbench-pending-v1:${ownerScope}` : null;
  // Synchronous, tab-local recovery precedes the debounce. It survives Next Link
  // unmounts and failed requests, without writing a second shared task system.
  const retainDraft = useCallback((next: WorkbenchDocument | null, acknowledge = false) => {
    if (!draftKey) return;
    try {
      // A response from an unmounted instance must not clear a newer editor's draft.
      if (acknowledge) {
        const current = sessionStorage.getItem(draftKey);
        if (current && JSON.parse(current).writer !== writer.current) return;
      }
      if (next) sessionStorage.setItem(draftKey, JSON.stringify({ revision: revRef.current, document: next, writer: writer.current }));
      else sessionStorage.removeItem(draftKey);
    } catch { setError("瀏覽器未能暫存。請等候儲存完成，或先匯出目前內容再離開。"); }
  }, [draftKey]);

  const flush = useCallback(async () => {
    if (busy.current || conflict.current || !queue.current) return;
    busy.current = true; setState("saving");
    try {
      while (queue.current) {
        const next = queue.current; queue.current = null;
        try {
          if (fixture) { sessionStorage.setItem(fixtureKey, JSON.stringify(next)); revRef.current++; setRevision(revRef.current); setUpdatedAt(new Date().toISOString()); retainDraft(queue.current, true); continue; }
          const response = await fetch("/api/internal/workbench", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ revision: revRef.current, document: next }) });
          const result = await response.json();
          if (!response.ok) {
            if (response.status === 409) { conflict.current = true; setState("conflict"); }
            throw new Error(result.message ?? "儲存失敗。");
          }
          revRef.current = result.revision; setRevision(result.revision); setUpdatedAt(result.updatedAt);
          retainDraft(queue.current, true);
        } catch (e) { queue.current ??= next; throw e; }
      }
      setError(""); setState("saved");
    } catch (e) { setError(e instanceof Error ? e.message : "未能儲存。"); if (!conflict.current) setState("error"); }
    finally { busy.current = false; }
  }, [fixture, fixtureKey, retainDraft]);

  const load = useCallback(async (recoverDraft = true) => {
    setState("loading"); setError("");
    try {
      let r: WorkbenchRecord;
      if (fixture && initial) {
        const saved = sessionStorage.getItem(fixtureKey);
        r = { ...initial, document: saved ? JSON.parse(saved) : initial.document };
      } else {
        const response = await fetch("/api/internal/workbench", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "未能載入工作枱。");
        r = result;
      }
      if (!mounted.current) return;
      if (!validateWorkbenchDocument(r.document)) throw new Error("工作枱資料格式不符，請稍後重試。");
      let pending: { revision: number; document: WorkbenchDocument } | null = null;
      if (recoverDraft && draftKey) {
        try {
          const raw = sessionStorage.getItem(draftKey); const candidate = raw ? JSON.parse(raw) : null;
          if (candidate && Number.isSafeInteger(candidate.revision) && candidate.revision > 0 && validateWorkbenchDocument(candidate.document)) pending = candidate;
        } catch { /* A malformed local draft must not prevent loading the saved workspace. */ }
      }
      revRef.current = r.revision; conflict.current = false; queue.current = null;
      setRevision(r.revision); setUpdatedAt(r.updatedAt); history.current = []; setUndoCount(0);
      if (pending && JSON.stringify(pending.document) !== JSON.stringify(r.document)) {
        docRef.current = pending.document; setDocument(pending.document); queue.current = pending.document;
        if (!fixture && pending.revision !== r.revision) {
          // Keep the original base even if the user continues editing a conflict.
          revRef.current = pending.revision; setRevision(pending.revision); retainDraft(pending.document);
          conflict.current = true; setState("conflict");
          setError("已恢復本視窗未儲存嘅改動，但系統版本已更新。請先匯出目前內容，再重新載入核對。");
        } else {
          retainDraft(pending.document);
          setState("pending"); timer.current = setTimeout(() => { void flush(); }, 500);
        }
      } else {
        docRef.current = r.document; setDocument(r.document); retainDraft(null); setState("saved");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "載入失敗。"); setState("error"); }
  }, [fixture, initial, fixtureKey, draftKey, flush, retainDraft]);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load]);

  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (queue.current || busy.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", guard);
    return () => { window.removeEventListener("beforeunload", guard); if (timer.current) clearTimeout(timer.current); };
  }, []);
  const mutate = useCallback((edit: (draft: WorkbenchDocument) => void, label: string) => {
    if (!docRef.current) return false;
    const previous = docRef.current; const draft = structuredClone(previous);
    edit(draft);
    if (!validateWorkbenchDocument(draft)) { setError("改動格式未通過檢查。"); return false; }
    if (JSON.stringify(draft) === JSON.stringify(previous)) return true;
    draft.activity = [{ id: crypto.randomUUID(), label, at: new Date().toISOString() }, ...draft.activity].slice(0, 100);
    history.current = [...history.current.slice(-19), previous]; setUndoCount(history.current.length);
    docRef.current = draft; setDocument(draft); queue.current = draft;
    retainDraft(draft);
    if (!conflict.current) setState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 500);
    return true;
  }, [flush, retainDraft]);
  const undo = useCallback(() => {
    const previous = history.current.pop(); if (!previous) return;
    docRef.current = previous; setDocument(previous); queue.current = previous; setUndoCount(history.current.length);
    retainDraft(previous);
    if (!conflict.current) setState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 100);
  }, [flush, retainDraft]);
  return { document, revision, updatedAt, state, error, mutate, undo, undoCount, load: () => load(false), flush };
}
