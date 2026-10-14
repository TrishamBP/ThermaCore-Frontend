"use client";

/**
 * ILLUSTRATIVE airflow particles. Not a CFD or airflow simulation:
 * - particle speed per server ∝ that server's measured airflow (airflow_cfm, magnitude only);
 * - colour goes from the server's measured inlet temperature to its measured exhaust temperature;
 * - direction is ASSUMED front (aisle side, −z) → back; the backend provides no flow direction.
 * Servers without data (null CFM / no telemetry / restricted) emit nothing.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { LayoutIndex } from "./lib/layout";
import { rotationRadians } from "./lib/layout";
import { glowTexture } from "./textures";

export type ServerFlow = { cfm: number | null; inlet: number | null; exhaust: number | null };

const PER_SERVER = 64;
const MIN_C = 18;
const MAX_C = 40;
/** Visual temperature ramp (blue → cyan → green → amber → red); not equipment limits. */
const RAMP = ["#38bdf8", "#22d3ee", "#2ee59d", "#ff9f1c", "#ff4d5e"].map((c) => new THREE.Color(c));

export function rampColor(tempC: number, out: THREE.Color): THREE.Color {
  const t = Math.min(1, Math.max(0, (tempC - MIN_C) / (MAX_C - MIN_C))) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t));
  return out.copy(RAMP[i]!).lerp(RAMP[i + 1]!, t - i);
}

/** Deterministic pseudo-random in [0,1) (stable particle layout across renders). */
function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function Airflow({ index, flows, animate }: { index: LayoutIndex; flows: ReadonlyMap<string, ServerFlow>; animate: boolean }) {
  const servers = index.servers;
  const count = servers.length * PER_SERVER;
  const invalidate = useThree((s) => s.invalidate);
  const texture = useMemo(() => glowTexture(), []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => texture.dispose(), [texture]);

  // Per-particle constants: phase, lateral and vertical offsets.
  const seeds = useMemo(() => {
    const s = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      s[i * 3] = hash(i + 1);
      s[i * 3 + 1] = hash(i + 101.3);
      s[i * 3 + 2] = hash(i + 517.7);
    }
    return s;
  }, [count]);
  const phase = useRef<Float32Array>(new Float32Array(0));

  // Per-server parameters derived from measured values.
  const params = useMemo(() => {
    const maxCfm = Math.max(1, ...servers.map((s) => flows.get(s.id)?.cfm ?? 0));
    return servers.map((s) => {
      const f = flows.get(s.id);
      const active = f?.cfm !== null && f?.cfm !== undefined && f.cfm > 0;
      const inlet = rampColor(f?.inlet ?? 22, new THREE.Color());
      const exhaust = rampColor(f?.exhaust ?? f?.inlet ?? 28, new THREE.Color());
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotationRadians(s.rotation)));
      return { active, speed: active ? 0.08 + 0.42 * (f!.cfm! / maxCfm) : 0, inlet, exhaust, q, s };
    });
  }, [servers, flows]);

  const tmp = useMemo(() => ({ v: new THREE.Vector3(), c: new THREE.Color() }), []);

  const write = (dt: number) => {
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = geometry.getAttribute("color") as THREE.BufferAttribute;
    if (phase.current.length !== count) phase.current = seeds.filter((_, i) => i % 3 === 0);
    const ph = phase.current;
    params.forEach((p, si) => {
      const { width, height, depth } = p.s.dimensions;
      const z0 = -depth / 2 - 1.1;
      const z1 = depth / 2 + 1.5;
      for (let k = 0; k < PER_SERVER; k++) {
        const i = si * PER_SERVER + k;
        if (!p.active) {
          pos.setXYZ(i, 0, -100, 0);
          col.setXYZ(i, 0, 0, 0);
          continue;
        }
        let t = ph[i]! + dt * p.speed;
        t -= Math.floor(t);
        ph[i] = t;
        const u = seeds[i * 3 + 1]! - 0.5;
        const w = seeds[i * 3 + 2]! - 0.5;
        const z = z0 + (z1 - z0) * t;
        // Converge into the server face, spread slightly after the exhaust.
        const spread = z < -depth / 2 ? 1.25 - 0.5 * (t / 0.3) : z > depth / 2 ? 0.8 + (t - 0.7) * 1.2 : 0.75;
        tmp.v.set(u * width * spread, w * height * 0.9 * spread, z).applyQuaternion(p.q);
        pos.setXYZ(i, p.s.position.x + tmp.v.x, p.s.position.y + tmp.v.y, p.s.position.z + tmp.v.z);
        const heat = THREE.MathUtils.smoothstep(z, -depth / 2, depth / 2);
        tmp.c.copy(p.inlet).lerp(p.exhaust, heat);
        const fade = Math.sin(Math.PI * t); // additive blending: darker = more transparent
        col.setXYZ(i, tmp.c.r * fade, tmp.c.g * fade, tmp.c.b * fade);
      }
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
  };

  // Static frame (reduced motion / paused) whenever inputs change.
  useEffect(() => {
    write(0);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- write reads the latest params
  }, [params, invalidate]);

  useFrame((_, dt) => {
    if (animate) write(Math.min(dt, 0.05));
  });

  return (
    <points geometry={geometry} raycast={() => null} frustumCulled={false}>
      <pointsMaterial
        size={0.16}
        map={texture}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}
