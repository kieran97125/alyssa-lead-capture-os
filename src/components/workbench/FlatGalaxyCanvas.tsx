"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { ReactFlow, Background, Controls, MiniMap, Handle, Position, applyNodeChanges, useNodesState,
  type Node, type NodeProps, type ReactFlowInstance, type Connection as FlowConnection, type NodeChange } from "@xyflow/react";
import { Orbit, Gem, Layers3, FolderKanban, Users, Link2 } from "lucide-react";
import type { Planet, WorkbenchDocument } from "@/lib/workbench/model";
import "@xyflow/react/dist/style.css";
import styles from "./Workbench.module.css";

type PlanetData = Record<string, unknown> & { planet: Planet; open: number; selected: boolean; dimmed: boolean };
type FlowNode = Node<PlanetData, "planet">;
const icons = { core: Orbit, brand: Gem, workstream: Layers3, project: FolderKanban, person: Users, resource: Link2 };
const PlanetView = memo(function PlanetView({ data }: NodeProps<FlowNode>) {
  const { planet, open, selected, dimmed } = data; const Icon = icons[planet.kind];
  return <div className={`${styles.planet} ${styles[planet.color]} ${planet.kind === "core" ? styles.sun : ""} ${selected ? styles.chosen : ""} ${dimmed ? styles.dimmed : ""}`}>
    <Handle type="target" position={Position.Left} id="in" className={styles.handle} />
    <Handle type="target" position={Position.Right} id="in-right" className={`${styles.handle} ${styles.secondaryHandle}`} />
    <div className={styles.orbitRing} aria-hidden="true" />
    <div className={styles.planetSphere}><Icon size={planet.kind === "core" ? 34 : 26} strokeWidth={1.5} aria-hidden="true" /></div>
    {open > 0 ? <span className={styles.satellite}>{open}</span> : null}
    <div className={styles.planetCaption}><strong>{planet.label}</strong><span>{planet.subtitle}</span></div>
    <Handle type="source" position={Position.Right} id="out" className={styles.handle} />
    <Handle type="source" position={Position.Left} id="out-left" className={`${styles.handle} ${styles.secondaryHandle}`} />
  </div>;
});
const nodeTypes = { planet: PlanetView };

export default function FlatGalaxyCanvas({ document, selectedId, relatedOnly, onSelect, onMove, onConnect, onEdge, onAdd, fitRequest = 0 }: {
  document: WorkbenchDocument; selectedId: string; relatedOnly: boolean;
  onSelect: (id: string) => void; onMove: (id: string, x: number, y: number) => void;
  onConnect: (connection: FlowConnection) => void; onEdge: (id: string) => void;
  onAdd: (position?: { x: number; y: number }) => void;
  fitRequest?: number;
}) {
  const instance = useRef<ReactFlowInstance<FlowNode> | null>(null);
  const neighbors = useMemo(() => {
    const ids = new Set([selectedId]);
    document.edges.filter(e => !e.archived).forEach(e => { if (e.source === selectedId) ids.add(e.target); if (e.target === selectedId) ids.add(e.source); });
    return ids;
  }, [document.edges, selectedId]);
  const sourceNodes = useMemo<FlowNode[]>(() => document.nodes.filter(n => !n.archived && (!relatedOnly || neighbors.has(n.id))).map(n => ({
    id: n.id, type: "planet", position: { x: n.x, y: n.y }, selected: n.id === selectedId, ariaLabel: `星球：${n.label}`, dragHandle: `.${styles.planet}`,
    data: { planet: n, open: document.jobs.filter(j => (n.id === "core" || j.nodeId === n.id || j.relatedNodeIds.includes(n.id)) && !j.archived && j.status !== "done").length, selected: n.id === selectedId, dimmed: selectedId !== "core" && !neighbors.has(n.id) },
  })), [document.nodes, document.jobs, selectedId, relatedOnly, neighbors]);
  const [nodes, setNodes] = useNodesState<FlowNode>(sourceNodes);
  useEffect(() => { setNodes(sourceNodes); }, [sourceNodes, setNodes]);
  useEffect(() => { void instance.current?.fitView({ padding: .16, duration: 0 }); }, [fitRequest]);
  const shown = new Set(sourceNodes.map(n => n.id));
  const edges = document.edges.filter(e => !e.archived && shown.has(e.source) && shown.has(e.target)).map(e => {
    const highlighted = e.source === selectedId || e.target === selectedId;
    const from = document.nodes.find(n => n.id === e.source)!, to = document.nodes.find(n => n.id === e.target)!;
    return { ...e, sourceHandle: to.x >= from.x ? "out" : "out-left", targetHandle: to.x >= from.x ? "in" : "in-right", type: "straight", label: highlighted && selectedId !== "core" ? e.label : undefined,
      className: highlighted ? styles.litEdge : styles.edge, style: { opacity: selectedId !== "core" && !highlighted ? .18 : .7 },
      labelStyle: { fill: "var(--wb-ink)", fontSize: 11 }, labelBgStyle: { fill: "var(--wb-space)" }, labelBgPadding: [8, 5] as [number, number], labelBgBorderRadius: 5,
      ariaLabel: `${e.source} → ${e.target}：${e.label}` };
  });
  const handleChanges = (changes: NodeChange<FlowNode>[]) => {
    setNodes(current => applyNodeChanges(changes, current));
    // Keyboard nudges are durable too. Pointer moves save only on drag stop.
    for (const c of changes) if (c.type === "position" && c.position && !c.dragging) onMove(c.id, c.position.x, c.position.y);
  };
  return <div className={styles.flatLayer}>
    <ReactFlow<FlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={handleChanges}
      onInit={i => { instance.current = i; requestAnimationFrame(() => { void i.fitView({ padding: .16, duration: 0 }); }); }} onNodeClick={(_, n) => onSelect(n.id)}
      onNodeDragStop={(_, n) => onMove(n.id, n.position.x, n.position.y)} onConnect={onConnect}
      onEdgeClick={(_, e) => onEdge(e.id)} onPaneContextMenu={event => { event.preventDefault(); onAdd(instance.current?.screenToFlowPosition({ x: event.clientX, y: event.clientY })); }}
      fitView fitViewOptions={{ padding: .18 }} minZoom={.25} maxZoom={1.7} nodesConnectable deleteKeyCode={null}
      proOptions={{ hideAttribution: false }} aria-label="可編輯 Alyssa 工作星球網絡" colorMode="dark">
      <Background color="var(--wb-grid)" gap={28} size={.8} />
      <Controls position="bottom-left" showInteractive={false} />
      <MiniMap position="bottom-right" nodeColor="var(--wb-edge)" maskColor="var(--wb-map-mask)" pannable zoomable ariaLabel="星圖縮圖" />
    </ReactFlow>
  </div>;
}
