"use client";

import dynamic from "next/dynamic";
import { Component, useId, useState, type ReactNode } from "react";
import { Expand, Minimize2, Maximize2, Orbit, Network, RotateCcw, Focus } from "lucide-react";
import type { Connection as FlowConnection } from "@xyflow/react";
import type { WorkbenchDocument } from "@/lib/workbench/model";
import type { SpacePoint } from "@/lib/workbench/spatial";
import { SystemButton } from "@/components/system/SystemButton";
import styles from "./Workbench.module.css";

const FlatCanvas = dynamic(() => import("./FlatGalaxyCanvas"), { ssr: false });
const SpatialCanvas = dynamic(() => import("./SpatialGalaxyCanvas"), { ssr: false });
export type GalaxyCanvasProps = {
  document: WorkbenchDocument; selectedId: string; relatedOnly: boolean;
  onSelect: (id: string) => void; onMove: (id: string, x: number, y: number) => void;
  onMoveSpatial: (id: string, point: SpacePoint) => void; onArrange: () => void;
  onConnect: (connection: FlowConnection) => void; onEdge: (id: string) => void;
  onAdd: (position?: { x: number; y: number }) => void;
  focused: boolean; onToggleFocus: () => void;
};

class SceneBoundary extends Component<{ children: ReactNode; onUnavailable: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function GalaxyCanvas(props: GalaxyCanvasProps) {
  const jumpId = useId();
  const [mode, setMode] = useState<"spatial" | "flat">("spatial");
  const [allLines, setAllLines] = useState(false); const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false); const [cameraRequest, setCameraRequest] = useState({ action: "fit", serial: 0 });
  const command = (action: string) => setCameraRequest(current => ({ action, serial: current.serial + 1 }));
  const switchMode = (next: "spatial" | "flat") => { setReady(false); setMode(next); };
  const active = props.document.nodes.filter(n => !n.archived);
  return <div className={`${styles.canvas} ${mode === "spatial" ? styles.spatialCanvas : styles.flatCanvas}`} data-testid="work-galaxy" data-mode={mode} data-ready={mode === "flat" || ready ? "true" : "false"}>
    <div className={styles.spaceBackdrop} aria-hidden="true" />
    {mode === "spatial" ? <SceneBoundary onUnavailable={() => { setUnavailable(true); switchMode("flat"); }}>
      <SpatialCanvas document={props.document} selectedId={props.selectedId} relatedOnly={props.relatedOnly} allLines={allLines}
        onSelect={props.onSelect} onMove={props.onMoveSpatial} onEdge={props.onEdge} onReady={() => setReady(true)} cameraRequest={cameraRequest} />
    </SceneBoundary> : <FlatCanvas {...props} fitRequest={cameraRequest.serial} />}
    <div className={styles.sceneIdentity}><span className={styles.sceneEyebrow}><i /> ALYSSA WORK GALAXY <span>／ PRIVATE ORBIT</span></span>
      <strong>每一件工作，都有佢嘅軌道。</strong><span>{active.length} 個星球 · {props.document.edges.filter(e => !e.archived).length} 條工作關係</span></div>
    <div className={styles.sceneActions}>
      <SystemButton density="compact" variant="outline" aria-label="顯示整個網絡" title="顯示整個網絡" onClick={() => command("fit")}><Maximize2 size={15} /></SystemButton>
      {mode === "spatial" ? <SystemButton density="compact" variant="outline" aria-label="聚焦選中星球" title="聚焦選中星球" onClick={() => command("selected")}><Focus size={15} /></SystemButton> : null}
      <SystemButton density="compact" variant="outline" aria-label={props.focused ? "離開專注模式" : "專注模式"} title={props.focused ? "離開專注模式（Esc）" : "全畫面專注模式"} onClick={props.onToggleFocus}>{props.focused ? <Minimize2 size={15} /> : <Expand size={15} />}<span>{props.focused ? "收起" : "專注模式"}</span></SystemButton>
    </div>
    <div className={styles.sceneJump}><label htmlFor={jumpId}>快速前往</label><select id={jumpId} aria-label="選擇工作星球" value={props.selectedId} onChange={e => props.onSelect(e.target.value)}>{active.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></div>
    {unavailable ? <p className={styles.sceneFallback} role="status">此裝置未能開啟 3D，已保留完整 2D 編排。</p> : null}
    <div className={styles.sceneBottom}>
      <div className={styles.sceneMode}><SystemButton density="compact" variant={mode === "spatial" ? "default" : "ghost"} aria-pressed={mode === "spatial"} onClick={() => switchMode("spatial")}><Orbit size={14} />3D 星際</SystemButton><SystemButton density="compact" variant={mode === "flat" ? "default" : "ghost"} aria-pressed={mode === "flat"} onClick={() => switchMode("flat")}><Network size={14} />2D 編排</SystemButton></div>
      {mode === "spatial" ? <label className={styles.sceneLineToggle}><input type="checkbox" checked={allLines} onChange={e => setAllLines(e.target.checked)} />全部連線</label> : null}
      <SystemButton density="compact" variant="ghost" onClick={() => { props.onArrange(); command("fit"); }} title="重新整理星球位置，可復原"><RotateCcw size={13} /><span>整理星系</span></SystemButton>
    </div>
    <p className={styles.sceneInstructions}>{mode === "spatial" ? "拖動空白轉動視角 · 滾輪縮放 · 拖動星球調位 · 點選查看工作" : "拖動星球調位 · 拉圓點建立關係 · 右鍵空白位新增"}</p>
  </div>;
}
