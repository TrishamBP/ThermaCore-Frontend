import type { LayoutObject } from "@/lib/api/schemas/twin";

export type TreeNode = { object: LayoutObject; children: TreeNode[] };

export type LayoutIndex = {
  byId: ReadonlyMap<string, LayoutObject>;
  objectIdByAsset: ReadonlyMap<string, string>;
  /** Servers sorted by id: instance index i ↔ servers[i] (deterministic per layout_version). */
  servers: readonly LayoutObject[];
  serverIndex: ReadonlyMap<string, number>;
  racks: readonly LayoutObject[];
  aisles: readonly LayoutObject[];
  rooms: readonly LayoutObject[];
  coolingUnits: readonly LayoutObject[];
  roots: readonly TreeNode[];
  unknownTypes: readonly LayoutObject[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
};

const KNOWN = new Set(["facility", "room", "aisle", "rack", "server", "cooling_unit"]);
const byIdAsc = (a: LayoutObject, b: LayoutObject) => a.id.localeCompare(b.id, "en", { numeric: true });

/** Builds the scene index from backend layout objects. Pure and deterministic. */
export function indexLayout(objects: readonly LayoutObject[]): LayoutIndex {
  const byId = new Map<string, LayoutObject>();
  for (const o of objects) byId.set(o.id, o);

  const objectIdByAsset = new Map<string, string>();
  for (const o of objects) if (o.asset_id) objectIdByAsset.set(o.asset_id, o.id);

  const ofType = (t: string) => objects.filter((o) => o.type === t).sort(byIdAsc);
  const servers = ofType("server");
  const serverIndex = new Map(servers.map((s, i) => [s.id, i] as const));

  // Tree from parent_id; objects with a missing parent become roots (and are reported).
  const nodes = new Map<string, TreeNode>();
  for (const o of [...objects].sort(byIdAsc)) nodes.set(o.id, { object: o, children: [] });
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const pid = node.object.parent_id;
    const parent = pid ? nodes.get(pid) : undefined;
    if (parent && pid && pid !== node.object.id && !isAncestor(nodes, node.object.id, pid)) parent.children.push(node);
    else roots.push(node);
  }

  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const o of objects) {
    if (o.type === "facility") continue;
    const half = [o.dimensions.width / 2, o.dimensions.height / 2, o.dimensions.depth / 2] as const;
    const p = [o.position.x, o.position.y, o.position.z] as const;
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, p[i]! - half[i]!);
      max[i] = Math.max(max[i]!, p[i]! + half[i]!);
    }
  }
  const empty = !Number.isFinite(min[0]);

  return {
    byId,
    objectIdByAsset,
    servers,
    serverIndex,
    racks: ofType("rack"),
    aisles: ofType("aisle"),
    rooms: ofType("room"),
    coolingUnits: ofType("cooling_unit"),
    roots,
    unknownTypes: objects.filter((o) => !KNOWN.has(o.type)),
    bounds: empty ? { min: [-1, 0, -1], max: [1, 1, 1] } : { min, max },
  };
}

function isAncestor(nodes: Map<string, TreeNode>, id: string, candidateParent: string): boolean {
  // Guards against cycles: walk up from the candidate parent; if we reach `id`, linking would create a cycle.
  let cur: string | null | undefined = candidateParent;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    if (cur === id) return true;
    seen.add(cur);
    cur = nodes.get(cur)?.object.parent_id;
  }
  return false;
}

/** Ancestor chain (nearest first) of an object, by parent_id. */
export function ancestors(index: LayoutIndex, objectId: string): LayoutObject[] {
  const out: LayoutObject[] = [];
  let cur = index.byId.get(objectId)?.parent_id;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const o = index.byId.get(cur);
    if (!o) break;
    out.push(o);
    cur = o.parent_id;
  }
  return out;
}

/** Layout rotation units are not documented by the backend (all values are 0 today); treated as degrees. */
export function rotationRadians(r: LayoutObject["rotation"]): [number, number, number] {
  const k = Math.PI / 180;
  return [r.x * k, r.y * k, r.z * k];
}
