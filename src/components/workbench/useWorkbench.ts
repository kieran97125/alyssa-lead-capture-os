"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateWorkbenchDocument, type WorkbenchDocument, type WorkbenchRecord } from "@/lib/workbench/model";

export function useWorkbench(initial?: WorkbenchRecord, fixture = false) {
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
  const fixtureKey = `alyssa-workbench-fixture-v1:${initial?.updatedAt ?? "default"}`;

  const load = useCallback(async () => {
    setState("loading"); setError("");
    try {
      if (fixture && initial) {
        const saved = sessionStorage.getItem(fixtureKey);
        const d = saved ? JSON.parse(saved) : initial.document;
        if (validateWorkbenchDocument(d)) { docRef.current = d; setDocument(d); }
        setState("saved"); return;
      }
      const response = await fetch("/api/internal/workbench", { cache: "no-store" });
      const r = await response.json();
      if (!response.ok) throw new Error(r.message ?? "未能載入工作枱。");
      if (!validateWorkbenchDocument(r.document)) throw new Error("工作枱資料格式不符，請稍後重試。");
      docRef.current = r.document; revRef.current = r.revision; conflict.current = false; queue.current = null;
      setDocument(r.document); setRevision(r.revision); setUpdatedAt(r.updatedAt); setState("saved");
      history.current = []; setUndoCount(0);
    } catch (e) { setError(e instanceof Error ? e.message : "載入失敗。"); setState("error"); }
  }, [fixture, initial, fixtureKey]);
  useEffect(() => { void load(); }, [load]);

  const flush = useCallback(async () => {
    if (busy.current || conflict.current || !queue.current) return;
    busy.current = true; setState("saving");
    try {
      while (queue.current) {
        const next = queue.current; queue.current = null;
        try {
          if (fixture) { sessionStorage.setItem(fixtureKey, JSON.stringify(next)); revRef.current++; setRevision(revRef.current); setUpdatedAt(new Date().toISOString()); continue; }
          const response = await fetch("/api/internal/workbench", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ revision: revRef.current, document: next }) });
          const result = await response.json();
          if (!response.ok) {
            if (response.status === 409) { conflict.current = true; setState("conflict"); }
            throw new Error(result.message ?? "儲存失敗。");
          }
          revRef.current = result.revision; setRevision(result.revision); setUpdatedAt(result.updatedAt);
        } catch (e) { queue.current ??= next; throw e; }
      }
      setError(""); setState("saved");
    } catch (e) { setError(e instanceof Error ? e.message : "未能儲存。"); if (!conflict.current) setState("error"); }
    finally { busy.current = false; }
  }, [fixture, fixtureKey]);

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
    if (!conflict.current) setState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 500);
    return true;
  }, [flush]);
  const undo = useCallback(() => {
    const previous = history.current.pop(); if (!previous) return;
    docRef.current = previous; setDocument(previous); queue.current = previous; setUndoCount(history.current.length);
    if (!conflict.current) setState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 100);
  }, [flush]);
  return { document, revision, updatedAt, state, error, mutate, undo, undoCount, load, flush };
}
