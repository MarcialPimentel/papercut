// Loads the cut-out puppet made in Blender (art/fighters/puppet.blend, exported to public/models/puppet.glb)
// and reads each piece as flat paper: the base card's outline, the printed details on top, and its pin.
// How to make or change the puppet: docs/blender-pipeline.md.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loopsFromTriangles, type Pt } from './paper2d';

/** One flat shape on a piece. `role` is the Blender material name without "pc_" (gi, sash, ink...). */
export interface Shape { pts: Pt[]; role: string; color: string }
export interface Piece {
  name: string;
  /** The pin, where the piece turns, in the rest layout (metres; y up, z towards the camera). */
  rest: THREE.Vector3;
  /** The paper itself: these get the white sticker border and ink edge. */
  shells: Shape[];
  /** Printed on top of the paper, back to front. */
  details: Shape[];
}
export type Puppet = Record<PieceName, Piece>;

export const PIECE_NAMES = ['legB', 'footB', 'armBU', 'armBL', 'torso', 'head', 'legF', 'footF', 'sword', 'armFU', 'armFL'] as const;
export type PieceName = (typeof PIECE_NAMES)[number];

export const PUPPET_URL = '/models/puppet.glb';

function readPiece(node: THREE.Object3D): Piece {
  const shells: Shape[] = [], details: (Shape & { z: number })[] = [];
  node.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
    const role = (mat.name || 'paper').replace(/^pc_/, ''), color = '#' + (mat.color?.getHexString() ?? 'ffffff');
    const g = m.geometry, pos = g.attributes.position.array, index = g.index ? g.index.array : null;
    for (const loop of loopsFromTriangles(pos, index)) {
      if (Math.abs(loop.z) < 0.0005) shells.push({ pts: loop.pts, role, color });
      else details.push({ pts: loop.pts, role, color, z: loop.z });
    }
  });
  details.sort((a, b) => a.z - b.z);
  return { name: node.name, rest: node.position.clone(), shells, details: details.map(({ pts, role, color }) => ({ pts, role, color })) };
}

let loading: Promise<Puppet> | null = null;
/** The puppet, loaded once. */
export function loadPuppet(url = PUPPET_URL): Promise<Puppet> {
  loading ??= new GLTFLoader().loadAsync(url).then((gltf) => {
    const root = gltf.scene.getObjectByName('Kami') ?? gltf.scene;
    const out = {} as Puppet;
    for (const name of PIECE_NAMES) {
      const node = root.getObjectByName(name);
      if (!node) throw new Error(`puppet.glb has no piece called "${name}"`);
      out[name] = readPiece(node);
    }
    return out;
  });
  return loading;
}
