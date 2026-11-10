"use client";

import { useEffect, useMemo, useRef, type ComponentRef, type RefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { AdditiveBlending, BackSide, Color, Float32BufferAttribute, Group, Plane, QuadraticBezierCurve3, SphereGeometry, Vector3 } from "three";
import type { Planet, WorkbenchDocument } from "@/lib/workbench/model";
import { planetRadius, spaceColors, spatialPositions, stableSeed, type SpacePoint } from "@/lib/workbench/spatial";
import styles from "./Workbench.module.css";

type Controls = ComponentRef<typeof OrbitControls>;
type Props = {
  document: WorkbenchDocument; selectedId: string; relatedOnly: boolean; allLines: boolean;
  onSelect: (id: string) => void; onMove: (id: string, point: SpacePoint) => void;
  onEdge: (id: string) => void; onReady: () => void;
  cameraRequest: { action: string; serial: number };
};
const xyz = (p: SpacePoint): [number, number, number] => [p.x, p.y, p.z];

function SceneReady({ onReady }: { onReady: () => void }) {
  const count = useRef(0); const invalidate = useThree(s => s.invalidate);
  useFrame(() => { count.current++; if (count.current < 4) invalidate(); else if (count.current === 4) queueMicrotask(onReady); });
  return null;
}

function CameraRig({ controls, positions, selectedId, request }: {
  controls: RefObject<Controls | null>; positions: Map<string, SpacePoint>; selectedId: string; request: Props["cameraRequest"];
}) {
  const { camera, size, invalidate } = useThree();
  const latest = useRef({ positions, selectedId, request }); latest.current = { positions, selectedId, request };
  useEffect(() => {
    const { positions: map, selectedId: id, request: command } = latest.current;
    const values = [...map.values()]; if (!values.length || !controls.current) return;
    const minX = Math.min(...values.map(p => p.x)) - 2, maxX = Math.max(...values.map(p => p.x)) + 2;
    const minY = Math.min(...values.map(p => p.y)) - 2, maxY = Math.max(...values.map(p => p.y)) + 2;
    const selected = map.get(id);
    const center = command.action === "selected" && selected ? new Vector3(...xyz(selected)) : new Vector3((minX + maxX) / 2, (minY + maxY) / 2, 0);
    const aspect = Math.max(size.width / size.height, .9);
    const distance = command.action === "selected" ? 12 : Math.max((maxY - minY) / 2, (maxX - minX) / 2 / aspect) / Math.tan(Math.PI / 8) * 1.16 + 4;
    camera.position.set(center.x, center.y + 1.3, center.z + distance);
    controls.current.target.copy(center); camera.lookAt(center); controls.current.update(); invalidate();
  }, [camera, controls, invalidate, request.serial, size.width, size.height]);
  return null;
}

function Starfield() {
  const points = useMemo(() => {
    const values = new Float32Array(2600 * 3);
    for (let i = 0; i < 2600; i++) {
      const angle = stableSeed(`angle-${i}`) * Math.PI * 2;
      const polar = Math.acos(stableSeed(`polar-${i}`) * 2 - 1);
      const radius = 65 + stableSeed(`radius-${i}`) * 100;
      values[i * 3] = Math.sin(polar) * Math.cos(angle) * radius;
      values[i * 3 + 1] = Math.sin(polar) * Math.sin(angle) * radius;
      values[i * 3 + 2] = Math.cos(polar) * radius;
    }
    return values;
  }, []);
  return <points renderOrder={-5}><bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry><pointsMaterial color="#d8e1ff" size={.095} transparent opacity={.7} sizeAttenuation depthWrite={false} /></points>;
}

function OrbitField() {
  const paths = useMemo(() => [0, 1, 2].map(j => Array.from({ length: 129 }, (_, i) => {
    const angle = i / 128 * Math.PI * 2;
    return [Math.cos(angle) * (12 + j * 4), Math.sin(angle) * (6 + j * 2), -4 + Math.sin(angle * 2) * 1.4] as [number, number, number];
  })), []);
  return <group rotation={[.12, -.08, -.1]}>{paths.map((path, i) => <Line key={i} points={path} color="#6883b9" lineWidth={.65} transparent opacity={.12} depthWrite={false} />)}</group>;
}

function PlanetBody({ planet, point, selected, dimmed, openJobs, controls, onSelect, onMove }: {
  planet: Planet; point: SpacePoint; selected: boolean; dimmed: boolean; openJobs: number;
  controls: RefObject<Controls | null>; onSelect: Props["onSelect"]; onMove: Props["onMove"];
}) {
  const group = useRef<Group>(null); const invalidate = useThree(s => s.invalidate);
  const drag = useRef<{ plane: Plane; offset: Vector3; x: number; y: number; moved: boolean } | null>(null);
  const radius = planetRadius(planet); const color = spaceColors[planet.color];
  const geometry = useMemo(() => {
    const g = new SphereGeometry(radius, 56, 36); const p = g.attributes.position;
    const colors: number[] = []; const base = new Color(color), light = new Color("#f0e6ff"), dark = new Color("#11142d");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / radius, y = p.getY(i) / radius, z = p.getZ(i) / radius;
      const waves = Math.sin(y * 20 + Math.sin(x * 5 + z * 7) * 1.3) * .5 + .5;
      const c = base.clone().lerp(dark, .12 + waves * .22).lerp(light, Math.max(0, y) * .13);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new Float32BufferAttribute(colors, 3)); return g;
  }, [radius, color]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const atmosphere = useMemo(() => ({ color: { value: new Color(color) }, strength: { value: selected ? .65 : .32 } }), [color, selected]);
  const endDrag = (event: ThreeEvent<PointerEvent>, cancel = false) => {
    if (!drag.current || !group.current) return;
    const completed = drag.current; drag.current = null;
    event.stopPropagation();
    const target = event.target as Element;
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
    if (controls.current) controls.current.enabled = true;
    if (cancel) group.current.position.set(...xyz(point));
    else if (completed.moved) onMove(planet.id, { x: group.current.position.x, y: group.current.position.y, z: group.current.position.z });
    else onSelect(planet.id);
    invalidate();
  };
  return <group ref={group} position={xyz(point)}>
    <mesh geometry={geometry}
      onPointerDown={event => {
        if (event.button !== 0 || !group.current) return;
        event.stopPropagation();
        const plane = new Plane().setFromNormalAndCoplanarPoint(event.camera.getWorldDirection(new Vector3()), group.current.position);
        const hit = event.ray.intersectPlane(plane, new Vector3()); if (!hit) return;
        drag.current = { plane, offset: group.current.position.clone().sub(hit), x: event.clientX, y: event.clientY, moved: false };
        if (controls.current) controls.current.enabled = false;
        (event.target as Element).setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (!drag.current || !group.current) return;
        event.stopPropagation();
        if (Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) < 4 && !drag.current.moved) return;
        const hit = event.ray.intersectPlane(drag.current.plane, new Vector3()); if (!hit) return;
        drag.current.moved = true; group.current.position.copy(hit.add(drag.current.offset).clampScalar(-499, 499)); invalidate();
      }} onPointerUp={event => endDrag(event)} onPointerCancel={event => endDrag(event, true)} onLostPointerCapture={event => { if (drag.current) endDrag(event, true); }}>
      <meshStandardMaterial vertexColors roughness={.58} metalness={.18} emissive={color} emissiveIntensity={selected ? .18 : .035} transparent={dimmed} opacity={dimmed ? .42 : 1} />
    </mesh>
    <mesh scale={1.14}>
      <sphereGeometry args={[radius, 40, 24]} />
      <shaderMaterial transparent depthWrite={false} side={BackSide} blending={AdditiveBlending} uniforms={atmosphere}
        vertexShader="varying vec3 vNormal; varying vec3 vView; void main(){vec4 view=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-view.xyz);gl_Position=projectionMatrix*view;}"
        fragmentShader="uniform vec3 color; uniform float strength; varying vec3 vNormal; varying vec3 vView; void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),2.4);gl_FragColor=vec4(color,rim*strength);}" />
    </mesh>
    {(planet.kind === "core" || planet.kind === "brand" || selected) ? <group rotation={[.95, -.35, -.22]}>
      <mesh><torusGeometry args={[radius * 1.48, selected ? .014 : .009, 6, 100]} /><meshBasicMaterial color={color} transparent opacity={selected ? .62 : .25} depthWrite={false} /></mesh>
      {planet.kind === "core" ? <mesh rotation={[.2, .1, .6]}><torusGeometry args={[radius * 1.85, .009, 6, 120]} /><meshBasicMaterial color={color} transparent opacity={.25} depthWrite={false} /></mesh> : null}
    </group> : null}
    <Html position={[0, -radius - .34, 0]} center zIndexRange={[16, 2]} style={{ pointerEvents: "auto" }}>
      <button className={`${styles.spaceLabel} ${selected ? styles.spaceLabelSelected : ""} ${dimmed ? styles.spaceLabelDimmed : ""}`}
        aria-label={`星球：${planet.label}`} aria-pressed={selected} data-world-position={xyz(point).map(v => v.toFixed(2)).join(",")}
        onClick={() => onSelect(planet.id)} onKeyDown={event => {
          const move: Record<string, [number, number]> = { ArrowLeft: [-.5, 0], ArrowRight: [.5, 0], ArrowUp: [0, .5], ArrowDown: [0, -.5] };
          if (!move[event.key]) return; event.preventDefault(); const [x, y] = move[event.key];
          onMove(planet.id, { x: Math.max(-499, Math.min(499, point.x + x)), y: Math.max(-499, Math.min(499, point.y + y)), z: point.z });
        }}>
        <strong>{planet.label}{openJobs > 0 ? <i>{openJobs}</i> : null}</strong><span>{planet.subtitle}</span>
      </button>
    </Html>
  </group>;
}

function SpaceScene(props: Props) {
  const controls = useRef<Controls>(null);
  const positions = useMemo(() => spatialPositions(props.document), [props.document]);
  const neighbors = new Set([props.selectedId]);
  props.document.edges.filter(e => !e.archived).forEach(e => { if (e.source === props.selectedId) neighbors.add(e.target); if (e.target === props.selectedId) neighbors.add(e.source); });
  const nodes = props.document.nodes.filter(n => !n.archived && (!props.relatedOnly || neighbors.has(n.id)));
  const shown = new Set(nodes.map(n => n.id));
  const lines = props.document.edges.filter(e => !e.archived && shown.has(e.source) && shown.has(e.target) && (props.allLines || e.source === props.selectedId || e.target === props.selectedId));
  return <>
    <ambientLight intensity={.42} /><hemisphereLight args={["#c4d2ff", "#181427", .8]} />
    <directionalLight position={[-14, 20, 26]} intensity={3.5} color="#fff0e7" /><directionalLight position={[18, -5, -15]} intensity={4} color="#7766e6" />
    <pointLight position={[-1.5, 0, 5]} intensity={20} distance={30} decay={2} color="#e5a1cc" />
    <Starfield /><OrbitField />
    {lines.map(edge => {
      const start = positions.get(edge.source)!, end = positions.get(edge.target)!;
      const lit = edge.source === props.selectedId || edge.target === props.selectedId;
      const a = new Vector3(...xyz(start)), b = new Vector3(...xyz(end));
      const delta = b.clone().sub(a); const perpendicular = new Vector3(-delta.y, delta.x, 0).normalize();
      const mid = a.clone().add(b).multiplyScalar(.5).addScaledVector(perpendicular, Math.min(delta.length() * .12, 1.4)); mid.z += 1.4;
      const curve = new QuadraticBezierCurve3(a, mid, b); const points = curve.getPoints(42);
      const node = props.document.nodes.find(n => n.id === edge.target)!;
      return <group key={edge.id}>
        <Line points={points} color={lit ? spaceColors[node.color] : "#5f719f"} transparent opacity={lit ? .48 : .13} lineWidth={lit ? 1.15 : .7} depthWrite={false} onClick={event => { event.stopPropagation(); props.onEdge(edge.id); }} />
      </group>;
    })}
    {nodes.map(planet => <PlanetBody key={planet.id} planet={planet} point={positions.get(planet.id)!} selected={props.selectedId === planet.id}
      dimmed={props.selectedId !== "core" && !neighbors.has(planet.id)} controls={controls} onSelect={props.onSelect} onMove={props.onMove}
      openJobs={props.document.jobs.filter(j => !j.archived && j.status !== "done" && (planet.id === "core" || j.nodeId === planet.id || j.relatedNodeIds.includes(planet.id))).length} />)}
    <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.12} minDistance={5} maxDistance={1500} maxPolarAngle={Math.PI * .86} minPolarAngle={.15} />
    <CameraRig controls={controls} positions={positions} selectedId={props.selectedId} request={props.cameraRequest} /><SceneReady onReady={props.onReady} />
  </>;
}

export default function SpatialGalaxyCanvas(props: Props) {
  return <div className={styles.spatialScene} data-testid="spatial-scene"><Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [0, 1.3, 40], fov: 45, near: .1, far: 5000 }}
    gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} onCreated={({ gl }) => gl.setClearColor("#000000", 0)}
    fallback={<p className={styles.sceneFallback}>3D 暫時未能開啟，請切換「2D 編排」繼續使用。</p>}>
    <SpaceScene {...props} />
  </Canvas></div>;
}
