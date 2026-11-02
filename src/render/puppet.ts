// Loads the samurai made in Blender (art/fighters/samurai.blend, exported to public/models/samurai.glb) and reads
// it as flat paper. The file follows Marz's Blender model guide: 4 units tall, each paper piece its own flat object,
// stacked in layers, under a rig of empties (root > torso > head, arm_L > hand_L, arm_R > hand_R > sword,
// skirt_L and skirt_R). Every rig node becomes one piece the game turns on its pivot.
// How to make or change the fighter: docs/blender-pipeline.md.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loopsFromTriangles, type Pt } from './paper2d';

/** One flat shape. `role` is the Blender material name without "pc_" (robe, kimono, hakama...).
 *  `paper` shapes are cut paper (they get the ink line); the rest are prints on the paper in front of them. */
export interface Shape { pts: Pt[]; role: string; color: string; z: number; paper: boolean }
export interface Piece {
  name: PieceName;
  /** The pivot in the rest pose, in game units from the feet (x toward the rival, y up). */
  rest: THREE.Vector2;
  /** Back to front, in the piece's own frame (pivot at 0, z toward the camera). */
  shapes: Shape[];
}
export type Puppet = Record<PieceName, Piece>;

export const PIECE_NAMES = ['skirt_R', 'skirt_L', 'arm_R', 'hand_R', 'sword', 'torso', 'head', 'arm_L', 'hand_L'] as const;
export type PieceName = (typeof PIECE_NAMES)[number];
const RIG = new Set<string>(['root', ...PIECE_NAMES]);

/** The guide's model is 4 units tall; fighters stand about 2.1 m. */
export const SCALE = 2.1 / 4;
export const PUPPET_URL = '/models/samurai.glb';

function readPiece(node: THREE.Object3D, root: THREE.Object3D): Piece {
  const inv = node.matrixWorld.clone().invert(), v = new THREE.Vector3();
  const objects = new Map<THREE.Object3D, { loops: { pts: Pt[]; z: number }[]; role: string; color: string }[]>();
  // Each paper object hanging under this rig node (not under a deeper rig node). A Blender object with several
  // materials arrives as a group of meshes; they belong together, so the group is the paper object.
  const visit = (o: THREE.Object3D, owner: THREE.Object3D | null) => {
    for (const c of o.children) {
      if (RIG.has(c.name)) continue;
      const own = owner ?? c, m = c as THREE.Mesh;
      if (m.isMesh) {
        const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
        const M = inv.clone().multiply(m.matrixWorld), p = m.geometry.attributes.position, out = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(M); out.set([v.x, v.y, v.z], i * 3); }
        const list = objects.get(own) ?? []; objects.set(own, list);
        list.push({ loops: loopsFromTriangles(out, m.geometry.index ? m.geometry.index.array : null), role: (mat.name || 'paper').replace(/^pc_/, ''), color: '#' + (mat.color?.getHexString() ?? 'ffffff') });
      }
      visit(c, own);
    }
  };
  visit(node, null);
  const shapes: Shape[] = [];
  for (const parts of objects.values()) {
    // The paper is the object's back-most plane; anything in front of it is printed on it.
    const back = Math.min(...parts.flatMap((p) => p.loops.map((l) => l.z)));
    for (const { loops, role, color } of parts) for (const l of loops) {
      shapes.push({ pts: l.pts.map(([x, y]) => [x * SCALE, y * SCALE] as Pt), role, color, z: l.z * SCALE, paper: l.z - back < 0.002 });
    }
  }
  shapes.sort((a, b) => a.z - b.z);
  const w = node.getWorldPosition(new THREE.Vector3()).sub(root.getWorldPosition(new THREE.Vector3()));
  return { name: node.name as PieceName, rest: new THREE.Vector2(w.x * SCALE, w.y * SCALE), shapes };
}

let loading: Promise<Puppet> | null = null;
/** The fighter, loaded once. */
export function loadPuppet(url = PUPPET_URL): Promise<Puppet> {
  loading ??= new GLTFLoader().loadAsync(url).then((gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const root = gltf.scene.getObjectByName('root') ?? gltf.scene;
    const out = {} as Puppet;
    for (const name of PIECE_NAMES) {
      const node = root.getObjectByName(name);
      if (!node) throw new Error(`samurai.glb has no rig node called "${name}"`);
      out[name] = readPiece(node, root);
    }
    return out;
  });
  return loading;
}
