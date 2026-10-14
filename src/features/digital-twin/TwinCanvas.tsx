"use client";

import { Edges, Grid, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import * as THREE from "three";

import type { LayoutObject, Overlay, OverlayType } from "@/lib/api/schemas/twin";
import { TONE_HEX, severityRank, toneOf } from "@/lib/status";

import type { LayoutIndex } from "./lib/layout";
import { rotationRadians } from "./lib/layout";
import type { LiveStore } from "./lib/live-store";
import { serverAppearance } from "./lib/overlay-scale";
import { LabelProjector, type HoverStore } from "./SceneLabels";
import { Airflow, type ServerFlow } from "./Airflow";
import { glowTexture } from "./textures";

export type CameraPreset = "overview" | "top" | "focus" | `aisle:${string}`;
export type CameraCommand = { preset: CameraPreset; nonce: number };

export type TwinCanvasProps = {
  index: LayoutIndex;
  overlayType: OverlayType;
  overlay: Overlay | undefined;
  live: LiveStore;
  selectedId: string | null;
  onSelect: (objectId: string | null) => void;
  camera: CameraCommand;
  reducedMotion: boolean;
  onContextLost: () => void;
  labelContainer: RefObject<HTMLDivElement | null>;
  hover: HoverStore;
  /** Illustrative airflow particles (speed from measured CFM; direction assumed). */
  airflow: boolean;
  flows: ReadonlyMap<string, ServerFlow>;
};

const BG = "#050a18";
const ACCENT = "#fbff12";
const CABINET = "#0d1834";
const FRAME = "#3a4c7a";
const BODY_DARK = new THREE.Color("#0b1430");

function pos(o: LayoutObject): [number, number, number] {
  return [o.position.x, o.position.y, o.position.z];
}

/** Drag-vs-click guard: orbiting should not select. */
const isClick = (e: ThreeEvent<MouseEvent>) => e.delta <= 4;

export default function TwinCanvas(props: TwinCanvasProps) {
  const { index } = props;
  const center = useMemo(() => {
    const { min, max } = index.bounds;
    return new THREE.Vector3((min[0] + max[0]) / 2, 0, (min[2] + max[2]) / 2);
  }, [index]);

  return (
    <Canvas
      frameloop={props.airflow && !props.reducedMotion ? "always" : "demand"}
      dpr={[1, 2]}
      shadows={false}
      camera={{ position: [center.x + 7, 5.8, center.z - 9], fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          props.onContextLost();
        });
      }}
    >
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 28, 70]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#9fb4ff", BG, 0.4]} />
      <directionalLight position={[8, 16, -6]} intensity={1.15} />
      <directionalLight position={[-10, 8, 10]} intensity={0.35} color="#7dd3fc" />

      <Floor index={index} />
      {index.aisles.map((a) => <Aisle key={a.id} obj={a} />)}
      <Racks {...props} />
      <Servers {...props} />
      {props.airflow && <Airflow index={index} flows={props.flows} animate={!props.reducedMotion} />}
      {index.coolingUnits.map((c) => (
        <CoolingUnit key={c.id} obj={c} selected={props.selectedId === c.id} onSelect={props.onSelect} />
      ))}
      <SelectionOutline index={index} selectedId={props.selectedId} />
      <LabelProjector container={props.labelContainer} />
      <FrameRequester hover={props.hover} selectedId={props.selectedId} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        target={[center.x, 1, center.z]}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3}
        maxDistance={48}
      />
      <CameraRig index={index} center={center} command={props.camera} selectedId={props.selectedId} reducedMotion={props.reducedMotion} />
    </Canvas>
  );
}

function Floor({ index }: { index: LayoutIndex }) {
  return (
    <>
      {index.rooms.map((r) => {
        const [x, , z] = pos(r);
        const { width, height, depth } = r.dimensions;
        const floorY = r.position.y - height / 2;
        return (
          <group key={r.id}>
            <mesh position={[x, floorY - 0.001, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
              <planeGeometry args={[width, depth]} />
              <meshStandardMaterial color="#09122a" roughness={0.9} metalness={0.05} />
            </mesh>
            <Grid
              position={[x, floorY + 0.002, z]}
              args={[width, depth]}
              cellSize={0.6}
              cellThickness={0.6}
              cellColor="#14234a"
              sectionSize={3}
              sectionThickness={1}
              sectionColor="#1f3466"
              fadeDistance={60}
              fadeStrength={1}
            />
            <lineSegments position={[x, r.position.y, z]} raycast={() => null}>
              <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
              <lineBasicMaterial color="#22325a" transparent opacity={0.7} />
            </lineSegments>
          </group>
        );
      })}
    </>
  );
}

function Aisle({ obj }: { obj: LayoutObject }) {
  const { width, depth } = obj.dimensions;
  return (
    <group position={pos(obj)} rotation={rotationRadians(obj.rotation)}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#10204a" transparent opacity={0.75} roughness={0.8} />
      </mesh>
      {[-depth / 2, depth / 2].map((z) => (
        <mesh key={z} position={[0, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <planeGeometry args={[width, 0.03]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function useLiveSnapshot(live: LiveStore) {
  return useSyncExternalStore(live.subscribe, live.getSnapshot, live.getSnapshot);
}

function Racks({ index, live, selectedId, onSelect }: TwinCanvasProps) {
  const snap = useLiveSnapshot(live);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [snap, invalidate]);
  const [hovered, setHovered] = useState<string | null>(null);
  const glow = useMemo(() => glowTexture(), []);
  useEffect(() => () => glow.dispose(), [glow]);

  // Worst thermal status of the servers inside each rack (from live state) → status strip on the rack top.
  const worst = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of index.servers) {
      if (!s.parent_id) continue;
      const a = snap.assets.get(s.id);
      const st = a?.thermalStatus ?? "UNKNOWN";
      const prev = m.get(s.parent_id);
      if (!prev || severityRank(st) > severityRank(prev)) m.set(s.parent_id, st);
    }
    return m;
  }, [index, snap]);

  return (
    <>
      {index.racks.map((r) => {
        const { width: w, height: h, depth: d } = r.dimensions;
        const t = 0.025;
        const selected = selectedId === r.id;
        const status = worst.get(r.id) ?? "UNKNOWN";
        const handlers = {
          onClick: (e: ThreeEvent<MouseEvent>) => {
            if (!isClick(e)) return;
            e.stopPropagation();
            onSelect(r.id);
          },
          onPointerOver: (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setHovered(r.id);
            document.body.style.cursor = "pointer";
          },
          onPointerOut: () => {
            setHovered(null);
            document.body.style.cursor = "";
          },
        };
        const edge = selected ? ACCENT : hovered === r.id ? "#d9dc6a" : FRAME;
        // Open front (−z, facing the aisle) so the servers inside stay visible and clickable.
        const panels: { p: [number, number, number]; s: [number, number, number] }[] = [
          { p: [-w / 2 + t / 2, 0, 0], s: [t, h, d] },
          { p: [w / 2 - t / 2, 0, 0], s: [t, h, d] },
          { p: [0, 0, d / 2 - t / 2], s: [w, h, t] },
          { p: [0, h / 2 - t / 2, 0], s: [w, t, d] },
          { p: [0, -h / 2 + t / 2, 0], s: [w, t, d] },
        ];
        return (
          <group key={r.id} position={pos(r)} rotation={rotationRadians(r.rotation)}>
            {panels.map((pnl, i) => (
              <mesh key={i} position={pnl.p} {...handlers}>
                <boxGeometry args={pnl.s} />
                <meshStandardMaterial color={CABINET} metalness={0.55} roughness={0.45} transparent opacity={0.92} />
              </mesh>
            ))}
            <mesh raycast={() => null}>
              <boxGeometry args={[w, h, d]} />
              <meshBasicMaterial visible={false} />
              <Edges color={edge} threshold={15} />
            </mesh>
            <mesh position={[0, -h / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
              <planeGeometry args={[w * 3.2, d * 2.4]} />
              <meshBasicMaterial
                map={glow}
                color={TONE_HEX[toneOf(status)]}
                transparent
                opacity={selected ? 0.75 : 0.4}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <mesh position={[0, h / 2 + 0.006, -d / 2 + 0.04]} raycast={() => null}>
              <boxGeometry args={[w * 0.92, 0.012, 0.05]} />
              <meshBasicMaterial color={TONE_HEX[toneOf(status)]} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function Servers({ index, overlay, overlayType, live, onSelect, hover: hoverStore }: TwinCanvasProps) {
  const body = useRef<THREE.InstancedMesh>(null);
  const led = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const [hover, setHover] = useState<number | null>(null);
  const count = index.servers.length;

  // Geometry: one matrix per server, built once per layout (instance i ↔ index.servers[i]).
  useLayoutEffect(() => {
    const b = body.current;
    const l = led.current;
    if (!b || !l) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    index.servers.forEach((s, i) => {
      const { width, height, depth } = s.dimensions;
      q.setFromEuler(new THREE.Euler(...rotationRadians(s.rotation)));
      m.compose(new THREE.Vector3(...pos(s)), q, new THREE.Vector3(width, height, depth));
      b.setMatrixAt(i, m);
      const front = new THREE.Vector3(0, 0, -depth / 2 - 0.004).applyQuaternion(q).add(new THREE.Vector3(...pos(s)));
      m.compose(front, q, new THREE.Vector3(width * 0.9, height * 0.42, 0.006));
      l.setMatrixAt(i, m);
    });
    b.instanceMatrix.needsUpdate = true;
    l.instanceMatrix.needsUpdate = true;
    b.computeBoundingSphere();
    l.computeBoundingSphere();
    invalidate();
  }, [index, invalidate]);

  // Colours: recomputed on overlay change and on every live update, written straight to the GPU buffers.
  useEffect(() => {
    const b = body.current;
    const l = led.current;
    if (!b || !l) return;
    const items = new Map((overlay?.items ?? []).map((it) => [it.object_id, it]));
    const c = new THREE.Color();
    const dark = new THREE.Color();
    const apply = () => {
      const snap = live.getSnapshot();
      index.servers.forEach((s, i) => {
        const a = serverAppearance(overlayType, items.get(s.id), snap.assets.get(s.id), overlay?.bands ?? null);
        c.set(a.color);
        dark.copy(BODY_DARK).lerp(c, a.unavailable ? 0.25 : 0.45);
        b.setColorAt(i, dark);
        l.setColorAt(i, a.unavailable ? dark : c);
      });
      if (b.instanceColor) b.instanceColor.needsUpdate = true;
      if (l.instanceColor) l.instanceColor.needsUpdate = true;
      invalidate();
    };
    apply();
    return live.subscribe(apply);
  }, [index, overlay, overlayType, live, invalidate]);


  const handlers = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (!isClick(e) || e.instanceId === undefined) return;
      e.stopPropagation();
      const s = index.servers[e.instanceId];
      if (s) onSelect(s.id);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && e.instanceId !== hover) {
        setHover(e.instanceId);
        hoverStore.set(index.servers[e.instanceId]?.id ?? null);
        document.body.style.cursor = "pointer";
        invalidate();
      }
    },
    onPointerOut: () => {
      setHover(null);
      hoverStore.set(null);
      document.body.style.cursor = "";
      invalidate();
    },
  };

  if (count === 0) return null;
  return (
    <>
      <instancedMesh ref={body} args={[undefined, undefined, count]} {...handlers}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.42} metalness={0.35} />
      </instancedMesh>
      <instancedMesh ref={led} args={[undefined, undefined, count]} {...handlers}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function CoolingUnit({ obj, selected, onSelect }: { obj: LayoutObject; selected: boolean; onSelect: (id: string) => void }) {
  const { width: w, height: h, depth: d } = obj.dimensions;
  return (
    <group position={pos(obj)} rotation={rotationRadians(obj.rotation)}>
      <mesh
        onClick={(e) => {
          if (!isClick(e)) return;
          e.stopPropagation();
          onSelect(obj.id);
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#142245" metalness={0.5} roughness={0.5} />
        <Edges color={selected ? ACCENT : "#5a71aa"} threshold={15} />
      </mesh>
      {[-0.6, -0.2, 0.2, 0.6].map((y) => (
        <mesh key={y} position={[w / 2 + 0.003, y * h * 0.6, 0]} rotation={[0, Math.PI / 2, 0]} raycast={() => null}>
          <planeGeometry args={[d * 0.8, 0.05]} />
          <meshBasicMaterial color="#22325a" />
        </mesh>
      ))}
    </group>
  );
}

function SelectionOutline({ index, selectedId }: { index: LayoutIndex; selectedId: string | null }) {
  const obj = selectedId ? index.byId.get(selectedId) : undefined;
  if (!obj || obj.type !== "server") return null;
  const { width, height, depth } = obj.dimensions;
  return (
    <group position={pos(obj)} rotation={rotationRadians(obj.rotation)}>
      <mesh raycast={() => null} scale={[1.08, 1.6, 1.04]}>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial visible={false} />
        <Edges color={ACCENT} threshold={15} />
      </mesh>
      <mesh position={[0, 0, -depth / 2 - 0.02]} raycast={() => null}>
        <planeGeometry args={[width * 1.1, height * 2.2]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.12} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function CameraRig({ index, center, command, selectedId, reducedMotion }: {
  index: LayoutIndex; center: THREE.Vector3; command: CameraCommand; selectedId: string | null; reducedMotion: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef<{ fromP: THREE.Vector3; toP: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t: number } | null>(null);

  useEffect(() => {
    if (!controls || command.nonce === 0) return;
    let toP: THREE.Vector3;
    let toT: THREE.Vector3;
    const preset = command.preset;
    if (preset === "top") {
      toP = new THREE.Vector3(center.x, 24, center.z + 0.01);
      toT = new THREE.Vector3(center.x, 0, center.z);
    } else if (preset === "focus" && selectedId && index.byId.get(selectedId)) {
      const o = index.byId.get(selectedId)!;
      toT = new THREE.Vector3(o.position.x, Math.max(0.8, o.position.y), o.position.z);
      const dist = o.type === "server" ? 2.6 : o.type === "rack" ? 4 : 9;
      toP = toT.clone().add(new THREE.Vector3(dist * 0.55, dist * 0.45, -dist));
    } else if (preset.startsWith("aisle:")) {
      const a = index.byId.get(preset.slice(6));
      if (!a) return;
      toP = new THREE.Vector3(a.position.x + a.dimensions.width / 2 + 1.5, 1.7, a.position.z);
      toT = new THREE.Vector3(a.position.x - 2, 1, a.position.z);
    } else {
      toP = new THREE.Vector3(center.x + 7, 5.8, center.z - 9);
      toT = new THREE.Vector3(center.x, 1, center.z);
    }
    if (reducedMotion) {
      camera.position.copy(toP);
      controls.target.copy(toT);
      controls.update();
      invalidate();
      return;
    }
    anim.current = { fromP: camera.position.clone(), toP, fromT: controls.target.clone(), toT, t: 0 };
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per command
  }, [command.nonce]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / 0.7);
    const k = 1 - Math.pow(1 - a.t, 3);
    camera.position.lerpVectors(a.fromP, a.toP, k);
    controls.target.lerpVectors(a.fromT, a.toT, k);
    controls.update();
    if (a.t >= 1) anim.current = null;
    else invalidate();
  });
  return null;
}

/** Lets the DOM label overlay request a frame (so newly mounted labels get positioned). */
function FrameRequester({ hover, selectedId }: { hover: HoverStore; selectedId: string | null }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    hover.setFrameRequester(invalidate);
    return () => {
      hover.setFrameRequester(null);
    };
  }, [hover, invalidate]);
  useEffect(() => {
    invalidate();
  }, [selectedId, invalidate]);
  return null;
}
