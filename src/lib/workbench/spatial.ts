import type { Planet, PlanetColor, WorkbenchDocument } from "./model";

export type SpacePoint = { x: number; y: number; z: number };
export const spaceColors: Record<PlanetColor, string> = {
  rose: "#eda6c7", blue: "#76d8ef", amber: "#edbd79", mint: "#83d6bd", violet: "#b7a0f5", slate: "#a9bcdf",
};
export function stableSeed(id: string) {
  let value = 2166136261;
  for (let i = 0; i < id.length; i++) value = Math.imul(value ^ id.charCodeAt(i), 16777619);
  return (value >>> 0) / 4294967295;
}
export function planetRadius(planet: Planet) {
  return { core: 1.18, brand: .83, workstream: .67, project: .59, person: .46, resource: .43 }[planet.kind];
}

// A presentation layout for the existing graph. It never rewrites legacy 2D
// positions or business records. Explicit 3D moves take precedence and persist.
export function spatialPositions(document: WorkbenchDocument): Map<string, SpacePoint> {
  const active = document.nodes.filter(n => !n.archived);
  const result = new Map<string, SpacePoint>();
  const groups = [active.filter(n => n.kind === "brand"), active.filter(n => n.kind === "workstream")];
  result.set("core", { x: -1.5, y: 0, z: 2 });
  groups.forEach((nodes, group) => nodes.forEach((n, i) => {
    const t = nodes.length < 2 ? .5 : i / (nodes.length - 1);
    const angle = (group === 0 ? 1.95 + t * 2.4 : 1.27 - t * 2.54);
    result.set(n.id, { x: group === 0 ? -1.5 + Math.cos(angle) * 12.5 : 2 + Math.cos(angle) * 8,
      y: Math.sin(angle) * 8.2, z: (stableSeed(n.id) - .5) * 4 });
  }));
  const children = new Map<string, number>();
  const others = active.filter(n => !result.has(n.id));
  others.forEach((n, i) => {
    const linked = document.edges.filter(e => !e.archived && (e.source === n.id || e.target === n.id))
      .map(e => active.find(p => p.id === (e.source === n.id ? e.target : e.source)))
      .find(p => p && (p.kind === "workstream" || p.kind === "brand"));
    const parent = linked ? result.get(linked.id) : undefined;
    const sibling = children.get(linked?.id ?? "unbound") ?? 0; children.set(linked?.id ?? "unbound", sibling + 1);
    result.set(n.id, parent ? { x: parent.x + (parent.x > 0 ? 4 : -3.5) + Math.floor(sibling / 3) * 3,
      y: parent.y + ((sibling % 3) - .5) * 1.9, z: parent.z + (stableSeed(n.id) - .5) * 3 } :
      { x: -4 + (i % 5) * 3.2, y: -10.5 - Math.floor(i / 5) * 2.6, z: (stableSeed(n.id) - .5) * 4 });
  });
  for (const n of active) if (n.space) result.set(n.id, { ...n.space });
  return result;
}
